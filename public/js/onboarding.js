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
    const step = this.steps[index];
    // offsetParent === null détecte un élément display:none (ex: sections
    // réservées au propriétaire, masquées pour une session gérant) — dans ce
    // cas on retombe sur l'affichage centré plutôt qu'un cadre invisible
    // planté en haut à gauche de l'écran.
    let target = step.target ? document.querySelector(step.target) : null;
    if (target && target.offsetParent === null) target = null;
    const total  = this.steps.length;

    // Mettre en évidence l'élément cible — on scrolle D'ABORD (instantané,
    // pas "smooth") puis on mesure : sinon, sur un long menu, le cadre se
    // positionnait sur les coordonnées d'AVANT le défilement (animé, donc
    // pas encore terminé au moment de la mesure) et ne suivait jamais la
    // cible réelle une fois le scroll achevé.
    if (target) {
      target.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      const r   = target.getBoundingClientRect();
      const pad = 6;
      Object.assign(this.spotlight.style, {
        display: 'block',
        top:    (r.top    - pad) + 'px',
        left:   (r.left   - pad) + 'px',
        width:  (r.width  + pad * 2) + 'px',
        height: (r.height + pad * 2) + 'px',
      });
    } else {
      this.spotlight.style.display = 'none';
    }

    // Dots de progression — masqués au-delà de 10 étapes (le tour Admin en
    // compte 16) : ils poussaient les boutons Passer/Suivant hors de la
    // bulle, faute de place. Le texte "Étape X sur Y" reste toujours affiché.
    const dots = total > 10 ? '' : Array.from({ length: total }, (_, i) =>
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
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;flex-wrap:wrap">
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">${dots}</div>
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
    text: 'Ce tableau de bord vous permet de gérer les commandes, réservations et le plan de salle en temps réel. Ce tour rapide vous explique les fonctions essentielles en moins de 2 minutes.' },
  { target: '#role-badge', position: 'bottom',
    title: '🏷️ Votre rôle',
    text: 'Ce badge indique votre ou vos rôles (Serveur, Bar, Cuisine, Livreur, Caissier...). Les onglets et boutons affichés s\'adaptent automatiquement à ce que votre rôle autorise.' },
  { target: '.filters', position: 'bottom',
    title: '🔍 Filtrer les commandes',
    text: 'Utilisez ces boutons pour afficher uniquement les commandes en attente, en préparation, prêtes ou livrées. Très utile en période de rush.' },
  { target: '[data-filter="reservations"]', position: 'bottom',
    title: '📅 Réservations',
    text: 'Consultez et confirmez/refusez les demandes de réservation de table reçues depuis le portail client.' },
  { target: '#fp-btn', position: 'bottom',
    title: '🗺️ Plan de salle',
    text: 'Visualisez l\'état de vos tables en un coup d\'œil. Touchez une table pour filtrer directement les commandes qui lui sont liées.' },
  { target: '.orders-grid', position: 'top',
    title: '📋 Les cartes de commande',
    text: 'Chaque carte représente une commande : table, articles, mode de paiement, statut. Un badge 🎁 apparaît quand une récompense fidélité est disponible pour ce client — marquez-la comme utilisée si c\'est un texte libre (une réduction en % s\'applique déjà automatiquement au total, visible sur la carte).' },
  { target: '#sound-btn', position: 'bottom',
    title: '🔔 Alerte sonore',
    text: 'Activez le son pour être averti à chaque nouvelle commande, même si vous n\'êtes pas devant l\'écran. Indispensable en cuisine.' },
  { target: '#staff-order-btn', position: 'bottom',
    title: '➕ Commande serveur',
    text: 'En tant que serveur ou admin, saisissez une commande directement depuis le dashboard au nom d\'un client — pratique s\'il n\'a pas de téléphone pour scanner le QR code.' },
  { target: null, position: 'center',
    title: '📲 Installer sur tablette/téléphone',
    text: 'Depuis le menu de votre navigateur (⋮ sur Android, partage sur iPhone), choisissez « Installer l\'application » ou « Ajouter à l\'écran d\'accueil » pour lancer le Dashboard en un tap, comme une vraie application.' },
];

// ── Étapes Admin ──────────────────────────────────────────
export const ADMIN_STEPS = [
  { target: null, position: 'center',
    title: '👋 Bienvenue dans l\'Administration !',
    text: 'Ce panneau vous permet de gérer tout le réseau : établissements, menu, stocks, personnel, fidélité, traiteur, statistiques et bien plus. Suivez ce tour pour repérer où se trouve chaque fonction.' },

  { target: '.sidebar', position: 'right',
    title: '🗂️ Navigation',
    text: 'Toutes les sections sont accessibles depuis cette barre latérale. Un gérant ne voit que ce qui concerne son établissement ; le propriétaire voit tout, y compris les réglages réseau.' },

  { target: '[onclick*="etablissements"]', position: 'right',
    title: '🏢 Établissements',
    text: 'Créez et modifiez les établissements du réseau : nom, logo, adresse, réseaux sociaux, activation/désactivation. Le sélecteur en haut de l\'écran permet de basculer entre eux ou de tout voir en même temps.' },

  { target: '[onclick*="\'menu\'"]', position: 'right',
    title: '🍽️ Gestion des articles',
    text: 'Ajoutez, modifiez ou désactivez des articles. Uploadez les photos depuis le formulaire d\'édition. Les articles désactivés disparaissent immédiatement du menu client.' },

  { target: '[onclick*="stocks"]', position: 'right',
    title: '🍺 Stocks boissons',
    text: 'Suivez les stocks en casiers (24 bouteilles). Quand le stock atteint 0, l\'article est automatiquement masqué du menu client. Ajoutez une entrée à chaque livraison fournisseur.' },

  { target: '[onclick*="users"]', position: 'right',
    title: '👥 Utilisateurs',
    text: 'Créez les comptes de vos employés avec un identifiant court (ex: cuisine01). Attribuez un ou plusieurs rôles : Serveur, Bar, Cuisine, Livreur, Caissier. Réinitialisez les mots de passe depuis ici.' },

  { target: '[onclick*="floorplan"]', position: 'right',
    title: '🗺️ Plan de salle',
    text: 'Configurez la disposition de vos tables (tap pour sélectionner, tap pour déplacer — fonctionne aussi bien à la souris qu\'au doigt). Les QR Codes sont automatiquement synchronisés avec les noms de tables.' },

  { target: '[onclick*="qrcodes"]', position: 'right',
    title: '📱 QR Codes',
    text: 'Générez et imprimez les QR Codes de chaque table, à scanner par les clients pour commander directement en salle.' },

  { target: '[onclick*="carrousel"]', position: 'right',
    title: '📢 Contenu affiché au client',
    text: 'Carrousel d\'accueil, Plat du jour et Infos & Actualités (annonces, recrutement, promotions) sont gérés depuis des pages dédiées de la barre latérale. Une promotion peut avoir une date d\'expiration et un bouton pour copier le message prêt pour WhatsApp. Les Avis clients laissés sur vos plats se modèrent depuis là aussi.' },

  { target: '[onclick*="candidatures"]', position: 'right',
    title: '📨 Candidatures',
    text: 'Les candidatures reçues via une annonce de recrutement (page Infos & Actualités du client, CV joint si le candidat en a fourni un) arrivent ici : consultez, changez le statut, contactez le candidat par téléphone ou WhatsApp en un clic.' },

  { target: '[onclick*="\'zones\'"]', position: 'right',
    title: '🗺️ Zones de livraison & Upselling',
    text: 'Zones livraison définit les secteurs livrables et leurs frais. Upselling (juste en dessous) configure les accompagnements/boissons suggérés automatiquement au client pendant sa commande.' },

  { target: '[onclick*="fidelite-reseau"]', position: 'right',
    title: '🎁 Fidélité',
    text: 'Réglez ici la récompense par défaut du réseau (tous les X jours, texte libre ou % de réduction). Chaque établissement peut personnaliser son propre réglage depuis sa Configuration. Une réduction en % se déduit automatiquement du panier du client dès qu\'elle est disponible ; un texte libre reste à appliquer par le staff.' },

  { target: '[onclick*="\'config\'"]', position: 'right',
    title: '⚙️ Configuration',
    text: 'Nom du restaurant, contacts affichés au client, modes de paiement acceptés, délai d\'expiration des commandes non traitées, et réglage fidélité propre à cet établissement.' },

  { target: '[onclick*="stats"]', position: 'right',
    title: '📈 Statistiques',
    text: 'Chiffre d\'affaires, panier moyen, répartition par type de service (salle/livraison/sur place) et par famille (nourriture/boissons), graphique — filtrable par période (7 jours, 30 jours, tout).' },

  { target: '[onclick*="paiements"]', position: 'right',
    title: '💳 Paiements & Comptabilité',
    text: 'Paiements liste tous les règlements encaissés. Comptabilité (en bas de la barre latérale, section Traiteur) résume revenus, dépenses et solde net.' },

  { target: '[onclick*="devis-demandes"]', position: 'right',
    title: '🎉 Traiteur',
    text: 'Demandes, Devis et Prestations gèrent le circuit événementiel de bout en bout. Un devis se compose de lignes que vous pouvez classer par catégorie (Entrée, Plat, Dessert, Boisson...) pour un rendu façon carte de menu, envoyé au client par lien.' },
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
