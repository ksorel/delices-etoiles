// ════════════════════════════════════════════════════════════
//  assistant.js — Assistant IA Délices Étoiles
//  Utilise l'API Anthropic pour répondre aux questions admin
// ════════════════════════════════════════════════════════════

const SYSTEM_PROMPTS = {
  admin: `Tu es l'assistant IA intégré à la plateforme digitale du restaurant Délices Étoiles, situé à Grand-Bassam en Côte d'Ivoire.

Tu aides uniquement le gérant et l'administrateur du restaurant à utiliser l'application d'administration.

CONTEXTE DE L'APPLICATION :
- URL : https://delices-etoiles.web.app
- Admin : /admin — back-office complet du gérant
- Dashboard staff : /dashboard — gestion des commandes en temps réel
- PWA client : / — menu client, commandes salle et livraison

SECTIONS DE L'ADMIN : Articles, Zones livraison, Stocks boissons (casiers 24 btl), Utilisateurs (identifiants courts), Plan de salle, QR Codes, Plat du jour, Statistiques, Paiements, Configuration.

RÔLES : admin 👑, serveur 🪑, bar 🍺, cuisine 👨‍🍳, livreur 🚴, caissier 💳
Connexion staff : identifiant court (ex: cuisine01) + MDP — PAS d'email.

RÉPONSES : Toujours en français. Concis, étapes numérotées.`,

  dashboard: `Tu es l'assistant IA du dashboard Délices Étoiles, restaurant à Grand-Bassam, Côte d'Ivoire.

Tu aides le staff (serveurs, cuisine, bar, livreurs, caissiers) à utiliser le dashboard de gestion des commandes.

FONCTIONNALITÉS DU DASHBOARD :
- Commandes en temps réel avec filtres par statut
- Flux salle : Commencer → Prêt → Valider paiement → Servi
- Flux livraison : Commencer → Prêt → Parti en livraison → Livré + Encaissé
- Plan de salle : voir les tables occupées
- Son : alerte sonore à chaque nouvelle commande
- Modes paiement : Espèces, Wave CI, Orange Money, MTN

RÔLES ET ACCÈS :
- Cuisine/Bar : voient leurs commandes, changent les statuts
- Serveur : voit toutes les commandes salle, peut encaisser
- Livreur : voit les commandes livraison, confirme la livraison + encaissement
- Caissier : encaissement et factures
- Admin : accès complet

RÉPONSES : Toujours en français. Court et pratique.`,

  client: `Tu es l'assistant du restaurant Délices Étoiles, situé à Grand-Bassam en Côte d'Ivoire.

Tu aides les clients à commander, choisir des plats et suivre leurs commandes.

INFORMATIONS RESTAURANT :
- Délices Étoiles — Resto & Traiteur
- Grand-Bassam, Côte d'Ivoire
- Commandes salle (QR code) et livraison disponibles
- Paiement : Espèces, Wave CI, Orange Money, MTN

CE QUE TU PEUX FAIRE :
- Recommander des plats selon les goûts
- Expliquer comment commander
- Aider à suivre une commande
- Informer sur les zones et frais de livraison

RÉPONSES : Toujours en français. Chaleureux et accueillant. Court et utile.`,
};

const SYSTEM_PROMPT = SYSTEM_PROMPTS.admin; // défaut admin

const CONTEXT_TYPE = 'admin'; // sera remplacé à l'init

const SYSTEM_PROMPT_UNUSED = `Tu es l'assistant IA intégré à la plateforme digitale du restaurant Délices Étoiles, situé à Grand-Bassam en Côte d'Ivoire.

Tu aides uniquement le gérant et l'administrateur du restaurant à utiliser l'application d'administration.

CONTEXTE DE L'APPLICATION :
- URL : https://delices-etoiles.web.app
- Admin : /admin — back-office complet du gérant
- Dashboard staff : /dashboard — gestion des commandes en temps réel
- PWA client : / — menu client, commandes salle et livraison
- Base de données : Firebase Firestore
- Authentification : Firebase Auth avec rôles personnalisés

SECTIONS DE L'ADMIN :
1. 🍽️ Articles : ajouter/modifier/désactiver des articles, upload photos, prix entier/demi, catégories
2. 🚴 Zones livraison : Grand-Bassam (5 zones) et Abidjan (7 zones), frais configurables
3. 🍺 Stocks boissons : suivi en casiers (1 casier = 24 bouteilles), seuils alerte, décrémentation automatique à chaque commande, lien direct avec la disponibilité des articles dans le menu
4. 👥 Utilisateurs : créer employés avec identifiant court (ex: cuisine01), attribuer rôles, réinitialiser mots de passe, activer/désactiver
5. 🗺️ Plan de salle : grille drag & drop, renommer tables, synchronisé avec QR Codes
6. 📱 QR Codes : générés automatiquement par table, imprimables
7. ⭐ Plat du jour : 3 slots (Entrée/Plat/Dessert), carrousel sur le menu client
8. 📦 Statistiques : CA total et du jour, commandes servies
9. 💳 Paiements : historique espèces/Wave/Orange Money/MTN
10. ⚙️ Configuration : nom du restaurant, identifiant resto (multi-restaurant), numéro du gérant affiché sur le login dashboard

RÔLES DISPONIBLES :
- admin (👑 ADMINISTRATION) : accès complet
- serveur (🪑 SERVEUR) : dashboard + commandes + plan salle
- bar (🍺 BAR) : dashboard + commandes + plan salle
- cuisine (👨‍🍳 CUISINE) : dashboard lecture + changer statuts, filtre auto "En préparation"
- livreur (🚴 LIVREUR) : dashboard lecture + changer statuts, filtre auto "Livraison"
- caissier (💳 CAISSIER) : dashboard + encaissement + factures

CONNEXION STAFF :
- Employés : identifiant court (ex: cuisine01) + mot de passe — PAS d'email
- Admin : email Gmail complet + mot de passe
- Mot de passe oublié : Admin → 👥 Utilisateurs → bouton 🔑 MDP → saisir nouveau mot de passe

RÉPONSES :
- Réponds toujours en français
- Sois concis et pratique — donne des étapes numérotées
- Si tu ne sais pas, dis-le honnêtement
- Ne donne jamais d'informations sur l'infrastructure technique interne
- Adapte ton niveau de détail à la question`;

class AIAssistant {
  constructor(contextType = 'admin') {
    this.contextType = contextType;
    this.isOpen    = false;
    this.history   = [];
    this.isLoading = false;
    this.panel     = null;
    this.fab       = null;
  }

  init() {
    this._injectCSS();
    this._createFAB();
    this._createPanel();
    this._addWelcomeMessage();
  }

  _injectCSS() {
    if (document.getElementById('ai-assistant-css')) return;
    const style = document.createElement('style');
    style.id = 'ai-assistant-css';
    style.textContent = `
      .ai-fab {
        position: fixed;
        bottom: 24px;
        right: 16px;
        z-index: 8000;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #F26522;
        color: #fff;
        border: none;
        cursor: pointer;
        font-size: 24px;
        box-shadow: 0 4px 20px rgba(242,101,34,.45);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform .2s, box-shadow .2s;
      }
      .ai-fab:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(242,101,34,.55); }
      .ai-notif {
        position: absolute;
        top: -4px; right: -4px;
        background: #2B1D16;
        color: #fff;
        font-size: 9px;
        font-weight: 800;
        padding: 2px 5px;
        border-radius: 10px;
        letter-spacing: .04em;
      }
      .ai-panel {
        position: fixed;
        bottom: 90px;
        right: 16px;
        width: 340px;
        max-height: 520px;
        background: #fff;
        border-radius: 20px;
        box-shadow: 0 8px 40px rgba(43,29,22,.22);
        display: flex;
        flex-direction: column;
        z-index: 8001;
        opacity: 0;
        pointer-events: none;
        transform: translateY(16px) scale(.97);
        transition: opacity .25s, transform .25s;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .ai-panel.open {
        opacity: 1;
        pointer-events: all;
        transform: translateY(0) scale(1);
      }
      .ai-head {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
        background: linear-gradient(135deg,#2B1D16,#4A3020);
        flex-shrink: 0;
      }
      .ai-avatar {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: rgba(255,255,255,.15);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
        overflow: hidden;
      }
      .ai-head-title { font-size: 14px; font-weight: 800; color: #fff; }
      .ai-head-sub   { font-size: 11px; color: rgba(255,255,255,.6); margin-top: 1px; }
      .ai-head-close {
        margin-left: auto;
        background: rgba(255,255,255,.15);
        border: none;
        color: #fff;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .ai-messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 200px;
      }
      .ai-msg {
        max-width: 90%;
        padding: 10px 13px;
        border-radius: 14px;
        font-size: 13px;
        line-height: 1.5;
        word-break: break-word;
      }
      .ai-msg.bot {
        background: #F5F0EB;
        color: #2B1D16;
        border-bottom-left-radius: 4px;
        align-self: flex-start;
      }
      .ai-msg.user {
        background: #F26522;
        color: #fff;
        border-bottom-right-radius: 4px;
        align-self: flex-end;
      }
      .ai-typing {
        align-self: flex-start;
        padding: 10px 13px;
        background: #F5F0EB;
        border-radius: 14px;
        border-bottom-left-radius: 4px;
      }
      .ai-dots { display: flex; gap: 4px; }
      .ai-dots span {
        width: 6px; height: 6px;
        background: #7A6356;
        border-radius: 50%;
        animation: ai-bounce .9s infinite;
      }
      .ai-dots span:nth-child(2) { animation-delay: .15s; }
      .ai-dots span:nth-child(3) { animation-delay: .3s; }
      @keyframes ai-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
      .ai-suggestions {
        padding: 0 10px 6px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .ai-sug {
        background: #FFF0E8;
        border: 1px solid #FDDCCC;
        color: #C94E10;
        border-radius: 20px;
        padding: 5px 12px;
        font-size: 12px;
        cursor: pointer;
        white-space: nowrap;
        transition: background .15s;
      }
      .ai-sug:hover { background: #FDDCCC; }
      .ai-input-row {
        display: flex;
        gap: 8px;
        padding: 10px 12px;
        border-top: 1px solid #F0E8E0;
        flex-shrink: 0;
      }
      .ai-input {
        flex: 1;
        border: 1.5px solid #E0D4C8;
        border-radius: 10px;
        padding: 8px 12px;
        font-size: 13px;
        resize: none;
        outline: none;
        font-family: inherit;
        transition: border .15s;
      }
      .ai-input:focus { border-color: #F26522; }
      .ai-send {
        background: #F26522;
        color: #fff;
        border: none;
        border-radius: 10px;
        width: 36px;
        height: 36px;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        align-self: flex-end;
        transition: background .15s;
      }
      .ai-send:hover { background: #C94E10; }
      @media(max-width:480px) {
        .ai-panel { width: calc(100vw - 32px); right: 16px; bottom: 80px; }
      }
    `;
    document.head.appendChild(style);
  }

  _createFAB() {
    this.fab = document.createElement('button');
    this.fab.className   = 'ai-fab ai-fab--' + this.contextType;
    this.fab.title       = 'Assistant — Posez vos questions';
    // On client: position bottom-right above the cart bar
    this.fab.innerHTML = this.contextType === 'client'
      ? '💬'
      : '💬<span class="ai-notif">IA</span>';
    this.fab.onclick = () => this.toggle();
    document.body.appendChild(this.fab);
  }

  _createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'ai-panel ai-panel--' + this.contextType;
    if (this.contextType === 'client') {
      this.panel.style.bottom = '130px';
    }
    this.panel.innerHTML = `
      <div class="ai-head">
        <div class="ai-avatar">
          <img src="/img/icon-192.png" alt="Délices Étoiles"
               style="width:36px;height:36px;border-radius:50%;object-fit:cover"
               onerror="this.outerHTML='⭐'">
        </div>
        <div>
          <div class="ai-head-title">Assistant Délices Étoiles</div>
          <div class="ai-head-sub">Toujours disponible pour vous aider</div>
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

    // Réponses rapides locales pour le portail client
    if (this.contextType === 'client') {
      const q = msg.toLowerCase();
      if (q.includes('menu') && q.includes('jour') || q === 'voir le menu du jour') {
        this._appendMessage("bot", "📜 Le plat du jour est affiché en haut de la page dans le carrousel. Scrollez vers le haut pour le voir !");
        this._renderContextualSuggestions(msg);
        return;
      }
      if (q.includes('contacter') || q === 'nous contacter') {
        this._appendMessage("bot", "📬 Nos coordonnées sont affichées en bas du menu. Vous pouvez appeler directement en cliquant sur le numéro ou écrire un email.");
        this._renderContextualSuggestions(msg);
        return;
      }
      if (q.includes('suivre') && q.includes('commande') || q === 'suivre ma commande') {
        this._appendMessage("bot", "📍 Si vous avez passé une commande, le bouton Suivre ma commande s'affiche sur la page de confirmation. Retrouvez-le via le bouton orange si vous avez rechargé la page.");
        this._renderContextualSuggestions(msg);
        return;
      }
    }

    this.history.push({ role: 'user', content: msg });
    this._setLoading(true);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system:     SYSTEM_PROMPTS[this.contextType] || SYSTEM_PROMPTS.admin,
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
export function initAssistant(contextType = 'admin') {
  window._ai = new AIAssistant(contextType);
  window._ai.init();
}
