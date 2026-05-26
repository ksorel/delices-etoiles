// ════════════════════════════════════════════════════════════
//  onboarding.js — Tour guidé Délices Étoiles
// ════════════════════════════════════════════════════════════

class Onboarding {
  constructor(steps, storageKey) {
    this.steps      = steps;
    this.storageKey = storageKey;
    this.current    = 0;
    this.active     = false;
    this.backdrop   = null;
    this.spotlight  = null;
    this.bubble     = null;
  }

  start(force = false) {
    if (!force && localStorage.getItem(this.storageKey)) {
      return; // Le bouton dans le header/sidebar suffit
    }
    this.current = 0;
    this.active  = true;
    this._createElements();
    this._showStep(0);
  }

  _createElements() {
    // Supprimer s'ils existent déjà
    document.getElementById('ob-backdrop')?.remove();
    document.getElementById('ob-spotlight')?.remove();
    document.getElementById('ob-bubble')?.remove();

    // Backdrop semi-transparent — pointer-events:none pour laisser passer les clics sur la bulle
    this.backdrop = document.createElement('div');
    this.backdrop.id = 'ob-backdrop';
    Object.assign(this.backdrop.style, {
      position: 'fixed', inset: '0',
      background: 'rgba(43,29,22,.7)',
      zIndex: '9001',
      pointerEvents: 'none', // ← ne bloque PAS les clics
      transition: 'opacity .3s',
    });
    document.body.appendChild(this.backdrop);

    // Spotlight — cadre orange autour de l'élément cible
    this.spotlight = document.createElement('div');
    this.spotlight.id = 'ob-spotlight';
    Object.assign(this.spotlight.style, {
      position: 'fixed',
      borderRadius: '10px',
      border: '3px solid #F26522',
      boxShadow: '0 0 0 3000px rgba(43,29,22,.7)',
      zIndex: '9002',
      pointerEvents: 'none',
      transition: 'all .35s cubic-bezier(.4,0,.2,1)',
      display: 'none',
    });
    document.body.appendChild(this.spotlight);

    // Bulle — pointer-events:all pour que les boutons fonctionnent
    this.bubble = document.createElement('div');
    this.bubble.id = 'ob-bubble';
    Object.assign(this.bubble.style, {
      position: 'fixed',
      zIndex: '9999', // au-dessus de tout
      background: '#fff',
      borderRadius: '16px',
      padding: '20px 22px 16px',
      width: '340px',
      boxShadow: '0 8px 32px rgba(43,29,22,.3)',
      transition: 'all .3s cubic-bezier(.4,0,.2,1)',
      pointerEvents: 'all', // ← les boutons sont cliquables
    });
    document.body.appendChild(this.bubble);

    document.body.style.overflow = 'hidden';
  }

  _showStep(index) {
    const step   = this.steps[index];
    const target = step.target ? document.querySelector(step.target) : null;
    const total  = this.steps.length;

    // Mettre en évidence l'élément cible
    if (target) {
      const r   = target.getBoundingClientRect();
      const pad = 6;
      Object.assign(this.spotlight.style, {
        display: 'block',
        top:    (r.top    - pad) + 'px',
        left:   (r.left   - pad) + 'px',
        width:  (r.width  + pad * 2) + 'px',
        height: (r.height + pad * 2) + 'px',
      });
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      this.spotlight.style.display = 'none';
    }

    // Dots de progression
    const dots = Array.from({ length: total }, (_, i) =>
      `<div style="width:7px;height:7px;border-radius:50%;background:${i === index ? '#F26522' : '#E0D4C8'};
       transform:${i === index ? 'scale(1.3)' : 'scale(1)'};transition:all .2s;flex-shrink:0"></div>`
    ).join('');

    const isLast = index === total - 1;

    // Contenu de la bulle
    this.bubble.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:#F26522;letter-spacing:.08em;
                  text-transform:uppercase;margin-bottom:5px">
        Étape ${index + 1} sur ${total}
      </div>
      <div style="font-size:15px;font-weight:800;color:#2B1D16;margin-bottom:6px;line-height:1.3">
        ${step.title}
      </div>
      <div style="font-size:13px;color:#7A6356;line-height:1.6;margin-bottom:16px">
        ${step.text}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px">
        <div style="display:flex;gap:5px;align-items:center">${dots}</div>
        <div style="display:flex;gap:6px;align-items:center">
          <button id="ob-skip-btn"
            style="font-size:12px;color:#7A6356;background:none;border:none;
                   cursor:pointer;padding:6px 8px;border-radius:6px;white-space:nowrap">
            Passer
          </button>
          ${index > 0 ? `<button id="ob-prev-btn"
            style="width:34px;height:34px;background:#F0EBE6;color:#2B1D16;border:none;
                   border-radius:8px;font-size:16px;cursor:pointer;display:flex;
                   align-items:center;justify-content:center;flex-shrink:0;
                   transition:background .15s;">←</button>` : ''}
          <button id="ob-next-btn"
            style="background:#F26522;color:#fff;border:none;border-radius:8px;
                   padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;
                   white-space:nowrap;transition:background .15s;flex-shrink:0">
            ${isLast ? 'Terminer ✓' : 'Suivant →'}
          </button>
        </div>
      </div>`;

    // Attacher les événements
    document.getElementById('ob-skip-btn').addEventListener('click', () => this.skip());
    document.getElementById('ob-next-btn').addEventListener('click', () => this.next());
    document.getElementById('ob-next-btn').addEventListener('mouseover', function() { this.style.background = '#C94E10'; });
    document.getElementById('ob-next-btn').addEventListener('mouseout',  function() { this.style.background = '#F26522'; });
    const prevBtn = document.getElementById('ob-prev-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prev());
      prevBtn.addEventListener('mouseover', function() { this.style.background = '#E0D4C8'; });
      prevBtn.addEventListener('mouseout',  function() { this.style.background = '#F5F0EB'; });
    }

    // Positionner la bulle
    this._positionBubble(target, step.position || 'bottom');
  }

  _positionBubble(target, position) {
    // Mesurer la hauteur réelle de la bulle après injection du HTML
    const bw  = 360;
    const bh  = this.bubble.offsetHeight || 220;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;
    const pad = 16;

    let top, left;

    if (!target) {
      top  = vh / 2 - bh / 2;
      left = vw / 2 - bw / 2;
    } else {
      const r = target.getBoundingClientRect();
      if (position === 'bottom') {
        top  = r.bottom + pad;
        left = r.left;
      } else if (position === 'top') {
        top  = r.top - bh - pad;
        left = r.left;
      } else if (position === 'right') {
        top  = r.top;
        left = r.right + pad;
      } else {
        top  = r.top;
        left = r.left - bw - pad;
      }
    }

    // Clamp dans le viewport — toujours entièrement visible
    const realBH = this.bubble.offsetHeight || bh;
    top  = Math.max(pad, Math.min(top,  vh - realBH - pad));
    left = Math.max(pad, Math.min(left, vw - bw - pad));

    this.bubble.style.top  = top  + 'px';
    this.bubble.style.left = left + 'px';
  }

  prev() {
    if (this.current > 0) {
      this.current--;
      this._showStep(this.current);
    }
  }

  next() {
    if (this.current < this.steps.length - 1) {
      this.current++;
      this._showStep(this.current);
    } else {
      this.finish();
    }
  }

  skip()   { this.finish(); }

  finish() {
    this.active = false;
    localStorage.setItem(this.storageKey, '1');
    this.backdrop?.remove();
    this.spotlight?.remove();
    this.bubble?.remove();
    document.body.style.overflow = '';
    // Pas de bouton flottant — les boutons dans header/sidebar suffisent
  }

  _addRestartButton() {
    if (document.getElementById('ob-restart')) return;
    const btn = document.createElement('button');
    btn.id        = 'ob-restart';
    btn.innerHTML = '🗺️ Tour guidé';
    Object.assign(btn.style, {
      position: 'fixed', bottom: '24px', left: '24px',
      background: 'rgba(43,29,22,.85)', color: '#fff',
      border: 'none', borderRadius: '24px',
      padding: '8px 16px', fontSize: '12px', fontWeight: '600',
      cursor: 'pointer', zIndex: '7999',
      display: 'flex', alignItems: 'center', gap: '6px',
    });
    btn.addEventListener('click', () => { btn.remove(); this.start(true); });
    document.body.appendChild(btn);
  }
}

// ── Étapes Dashboard ──────────────────────────────────────
export const DASHBOARD_STEPS = [
  { target: null, position: 'center',
    title: '👋 Bienvenue sur le Dashboard !',
    text: 'Ce tableau de bord vous permet de gérer les commandes en temps réel. Ce tour rapide vous explique les fonctions essentielles en moins de 2 minutes.' },
  { target: '.filters', position: 'bottom',
    title: '🔍 Filtrer les commandes',
    text: 'Utilisez ces boutons pour afficher uniquement les commandes en attente, en préparation, prêtes ou livrées. Très utile en période de rush.' },
  { target: '.orders-grid', position: 'top',
    title: '📋 Les cartes de commande',
    text: 'Chaque carte représente une commande. Elle affiche la table, les articles, le mode de paiement et le statut. Les nouvelles commandes apparaissent automatiquement.' },
  { target: '#sound-btn', position: 'bottom',
    title: '🔔 Alerte sonore',
    text: 'Activez le son pour être averti à chaque nouvelle commande, même si vous n\'êtes pas devant l\'écran. Indispensable en cuisine.' },
  { target: '#staff-order-btn', position: 'bottom',
    title: '➕ Commande serveur',
    text: 'En tant que serveur ou admin, saisissez une commande directement depuis le dashboard au nom d\'un client.' },
];

// ── Étapes Admin ──────────────────────────────────────────
export const ADMIN_STEPS = [
  { target: null, position: 'center',
    title: '👋 Bienvenue dans l\'Administration !',
    text: 'Ce panneau vous permet de gérer le restaurant : menu, stocks, zones, statistiques, paiements. Suivez ce tour pour maîtriser les fonctions essentielles.' },
  { target: '.sidebar', position: 'right',
    title: '🗂️ Menu de navigation',
    text: 'Toutes les sections sont accessibles depuis cette barre latérale. Tableau de bord, Menu, Zones, Stocks, Statistiques, Paiements et plus encore.' },
  { target: '[onclick*="\'menu\'"]', position: 'right',
    title: '🍽️ Gestion du menu',
    text: 'Ajoutez, modifiez ou désactivez des articles. Uploadez les photos depuis le formulaire d\'édition. Les articles désactivés disparaissent immédiatement du menu client.' },
  { target: '[onclick*="\'stocks\'"]', position: 'right',
    title: '📦 Gestion des stocks',
    text: 'Suivez les stocks des boissons en temps réel. Quand le stock atteint 0, l\'article est automatiquement masqué du menu. Entrez les livraisons dans l\'onglet "Entrée de stock".' },
  { target: '[onclick*="\'stats\'"]', position: 'right',
    title: '📈 Statistiques',
    text: 'Consultez le chiffre d\'affaires nourriture vs boissons, les plats les plus commandés et l\'évolution journalière. Filtrez par période en haut de la page.' },
  { target: '[onclick*="\'paiements\'"]', position: 'right',
    title: '💳 Paiements',
    text: 'Historique complet de tous les règlements encaissés par mode de paiement (espèces, Wave, Orange Money, MTN). Les paiements sont enregistrés depuis le dashboard.' },
];

// ── API publique ──────────────────────────────────────────
export function startOnboarding(type) {
  const steps = type === 'admin' ? ADMIN_STEPS : DASHBOARD_STEPS;
  const key   = type === 'admin' ? 'ob_admin_done' : 'ob_dash_done';
  window._ob  = new Onboarding(steps, key);
  window._ob.start();
}

export function forceOnboarding(type) {
  const steps = type === 'admin' ? ADMIN_STEPS : DASHBOARD_STEPS;
  const key   = type === 'admin' ? 'ob_admin_done' : 'ob_dash_done';
  window._ob  = new Onboarding(steps, key);
  window._ob.start(true);
}
