// ════════════════════════════════════════════════════════════
//  assistant.js — Assistant IA Délices Étoiles
//  Utilise l'API Anthropic pour répondre aux questions admin
// ════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `Tu es l'assistant IA intégré à la plateforme digitale du restaurant Délices Étoiles, situé à Grand-Bassam en Côte d'Ivoire.

Tu aides uniquement le gérant et l'administrateur du restaurant à utiliser l'application d'administration.

CONTEXTE DE L'APPLICATION :
- URL : https://delices-etoiles.web.app
- Admin : /admin (gestion menu, stocks, zones, statistiques, paiements, QR codes, plat du jour)
- Dashboard staff : /dashboard (gestion des commandes en temps réel)
- PWA client : / (menu client, commandes salle et livraison)
- Base de données : Firebase Firestore
- Authentification : Firebase Auth avec rôles (admin, serveur, bar, cuisine, livreur)

FONCTIONNALITÉS PRINCIPALES :
1. Menu : ajouter/modifier/supprimer des articles, upload photos, prix entier/demi, catégories dynamiques
2. Stocks : gestion des boissons (bières/eaux/jus/spiritueux), seuils d'alerte, bons de commande fournisseurs
3. Zones de livraison : Grand-Bassam (5 zones) et Abidjan (7 zones), frais configurables
4. Statistiques : CA nourriture vs boissons, top plats, filtres périodiques
5. Paiements : historique des règlements, espèces/Wave/Orange Money/MTN
6. QR Codes : 20 tables générées, imprimables
7. Plat du jour : sélection depuis le menu, publication en 1 clic
8. Sessions de table : plusieurs additions possibles par table
9. Commande serveur : le staff peut commander depuis le dashboard
10. Notifications FCM : client notifié quand sa commande est prête

RÔLES DISPONIBLES : admin (tout), serveur (dashboard + commandes), bar (dashboard + commandes), cuisine (dashboard lecture seule), livreur (dashboard lecture seule)

RÉPONSES :
- Réponds toujours en français
- Sois concis et pratique — donne des étapes claires
- Si tu ne sais pas, dis-le honnêtement
- Ne donne jamais d'informations sur l'infrastructure technique interne
- Adapte ton niveau de détail à la question`;

class AIAssistant {
  constructor() {
    this.isOpen    = false;
    this.history   = [];
    this.isLoading = false;
    this.panel     = null;
    this.fab       = null;
  }

  init() {
    this._createFAB();
    this._createPanel();
    this._addWelcomeMessage();
  }

  _createFAB() {
    this.fab = document.createElement('button');
    this.fab.className   = 'ai-fab';
    this.fab.title       = 'Assistant IA — Posez vos questions';
    this.fab.innerHTML   = '💬<span class="ai-notif">IA</span>';
    this.fab.onclick     = () => this.toggle();
    document.body.appendChild(this.fab);
  }

  _createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'ai-panel';
    this.panel.innerHTML = `
      <div class="ai-head">
        <div class="ai-avatar">⭐</div>
        <div>
          <div class="ai-head-title">Assistant Délices Étoiles</div>
          <div class="ai-head-sub">Powered by Claude · Toujours disponible</div>
        </div>
        <button class="ai-head-close" onclick="window._ai.close()">×</button>
      </div>
      <div class="ai-messages" id="ai-messages"></div>
      <div class="ai-suggestions" id="ai-suggestions"></div>
      <div class="ai-input-row">
        <textarea class="ai-input" id="ai-input" rows="1"
          placeholder="Posez votre question…"
          onkeydown="window._ai.onKey(event)"
          oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,80)+'px'"></textarea>
        <button class="ai-send" id="ai-send" onclick="window._ai.send()">➤</button>
      </div>`;
    document.body.appendChild(this.panel);
  }

  _addWelcomeMessage() {
    const suggestions = [
      'Comment ajouter un article au menu ?',
      'Comment modifier les frais de livraison ?',
      'Comment voir les statistiques du mois ?',
      'Comment assigner un rôle à un employé ?',
      'Comment gérer les stocks des boissons ?',
    ];

    this._appendMessage('bot',
      '👋 Bonjour ! Je suis votre assistant pour la plateforme Délices Étoiles.\n\n' +
      'Posez-moi n\'importe quelle question sur l\'utilisation de l\'application — ' +
      'gestion du menu, stocks, commandes, statistiques, paiements…'
    );
    this._renderSuggestions(suggestions);
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.panel.classList.toggle('open', this.isOpen);
    if (this.isOpen) {
      setTimeout(() => document.getElementById('ai-input')?.focus(), 250);
    }
  }

  close() {
    this.isOpen = false;
    this.panel.classList.remove('open');
  }

  onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  async send(text = null) {
    const input = document.getElementById('ai-input');
    const msg   = (text || input?.value || '').trim();
    if (!msg || this.isLoading) return;

    if (input) { input.value = ''; input.style.height = 'auto'; }
    this._clearSuggestions();
    this._appendMessage('user', msg);

    this.history.push({ role: 'user', content: msg });
    this._setLoading(true);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system:     SYSTEM_PROMPT,
          messages:   this.history,
        }),
      });

      const data = await response.json();
      const reply = data.content?.[0]?.text || 'Je n\'ai pas pu traiter votre demande.';

      this.history.push({ role: 'assistant', content: reply });
      this._setLoading(false);
      this._appendMessage('bot', reply);

      // Garder l'historique à 20 messages max
      if (this.history.length > 20) {
        this.history = this.history.slice(-20);
      }

      // Suggestions contextuelles après la réponse
      this._renderContextualSuggestions(msg);

    } catch (e) {
      this._setLoading(false);
      this._appendMessage('bot', '❌ Erreur de connexion. Vérifiez votre connexion internet et réessayez.');
    }
  }

  _appendMessage(role, text) {
    const container = document.getElementById('ai-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `ai-msg ${role}`;
    // Formatage simple : sauts de ligne et gras
    div.innerHTML = text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  _setLoading(loading) {
    this.isLoading = loading;
    const sendBtn  = document.getElementById('ai-send');
    if (sendBtn) sendBtn.disabled = loading;

    const container = document.getElementById('ai-messages');
    if (!container) return;

    if (loading) {
      const typing = document.createElement('div');
      typing.className = 'ai-typing';
      typing.id        = 'ai-typing';
      typing.innerHTML = '<div class="ai-dots"><span></span><span></span><span></span></div>';
      container.appendChild(typing);
      container.scrollTop = container.scrollHeight;
    } else {
      document.getElementById('ai-typing')?.remove();
    }
  }

  _renderSuggestions(suggestions) {
    const el = document.getElementById('ai-suggestions');
    if (!el) return;
    el.innerHTML = suggestions.map(s =>
      `<button class="ai-sug" onclick="window._ai.send('${s.replace(/'/g, "\\x27")}')">${s}</button>`
    ).join('');
  }

  _clearSuggestions() {
    const el = document.getElementById('ai-suggestions');
    if (el) el.innerHTML = '';
  }

  _renderContextualSuggestions(lastQuestion) {
    const q = lastQuestion.toLowerCase();
    let sugs = [];

    if (q.includes('menu') || q.includes('article') || q.includes('plat')) {
      sugs = ['Comment uploader une photo ?', 'Comment désactiver un article ?', 'Comment créer une catégorie ?'];
    } else if (q.includes('stock') || q.includes('boisson') || q.includes('bière')) {
      sugs = ['Comment définir un seuil d\'alerte ?', 'Comment ajouter un fournisseur ?', 'Comment synchroniser les stocks ?'];
    } else if (q.includes('stat') || q.includes('ca') || q.includes('chiffre')) {
      sugs = ['Comment filtrer par mois ?', 'Comment voir le top des plats ?'];
    } else if (q.includes('livraison') || q.includes('zone')) {
      sugs = ['Comment modifier les frais ?', 'Comment ajouter une zone ?'];
    } else if (q.includes('paiement') || q.includes('wave') || q.includes('orange')) {
      sugs = ['Comment confirmer un paiement espèces ?', 'Comment voir l\'historique ?'];
    } else {
      sugs = ['Comment ajouter un article ?', 'Comment voir les statistiques ?', 'Comment gérer les stocks ?'];
    }

    setTimeout(() => this._renderSuggestions(sugs), 300);
  }
}

// ─── Export et initialisation ────────────────────────────
export function initAssistant() {
  window._ai = new AIAssistant();
  window._ai.init();
}
