// ════════════════════════════════════════════════════════════
//  app.js — Contrôleur principal de la PWA Délices Étoiles
//  SPA vanilla JS avec routage par hash (#menu #cart #checkout)
// ════════════════════════════════════════════════════════════
import { auth, db, RESTO_FROM_URL } from './config.js';
import { signInAnonymously }       from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { t, initLang, getLang, setLang, itemName, itemDesc } from './i18n.js';
import { fetchMenu, fetchZones, fetchUpsellRules, getOrCreateTable, fetchPlatDuJour, listenOrder,
         createSession, getOpenSessions, updateSessionStatus, getSessionOrders,
         getRestoId, setRestoId, fetchLieux, fetchLieu, fetchAccueilCarousel } from './db.js';
import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { requestNotificationPermission, listenForegroundMessages } from './fcm.js';
// ─── Panier inline (cart.js supprimé) ───────────────────────
const CART_KEY = 'de_cart';
let _cartItems = [];
function initCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    _cartItems = raw ? JSON.parse(raw) : [];
  } catch { _cartItems = []; }
}
function _cartPersist() {
  localStorage.setItem(CART_KEY, JSON.stringify(_cartItems));
}
function addItem(item, opts = {}) {
  const qty = opts.qty || 1;
  const prixFinal = item.price + (opts.prixFormat || 0);
  _cartItems.push({
    uid: Math.random().toString(36).slice(2),
    id: item.id, name_fr: item.name_fr,
    name_en: item.name_en || item.name_fr,
    price: prixFinal, category: item.category,
    imageUrl: item.imageUrl || null, qty,
    glace: opts.glace ?? null, format: opts.format || null,
    comment: (opts.comment || '').slice(0, 100),
    upsells: opts.upsells || [],
  });
  _cartPersist();
}
function getItems()  { return [..._cartItems]; }
function getCount()  { return _cartItems.reduce((s, i) => s + i.qty, 0); }
function getTotal()  { return _cartItems.reduce((s, i) => s + i.price * i.qty, 0); }
function isEmpty()   { return _cartItems.length === 0; }
function updateQty(uid, delta) {
  const idx = _cartItems.findIndex(i => i.uid === uid);
  if (idx === -1) return;
  _cartItems[idx].qty = Math.max(0, _cartItems[idx].qty + delta);
  if (_cartItems[idx].qty === 0) _cartItems.splice(idx, 1);
  _cartPersist();
}
function removeItem(uid) {
  _cartItems = _cartItems.filter(i => i.uid !== uid);
  _cartPersist();
}
function clearCart() { _cartItems = []; _cartPersist(); }
import { initUpselling, getUpsells, isBoisson, hasFormats, getPrixForFormat, getFormatLabels } from './upselling.js';
import { submitSalleOrder, submitLivraisonOrder, formatFCFA } from './order.js';
import { initAssistant } from './assistant.js';
// ─── État global de l'app ────────────────────────────────
const State = {
  mode:        'livraison',  // 'salle' | 'livraison'
  payments:    { especes:true, wave:true, orange:false, mtn:false },
  contacts:    null, // chargé depuis Firestore
  tableId:     null,
  uid:         null,
  menu:        [],
  zones:       [],
  platDuJour:  null,
  resto:       null,    // établissement courant {id, nom, commune, …}
  sessionId:   null,    // Session courante du client
  notifEnabled: false,  // Notifications push activées
  activeCategory: 'all',
  lang:        'fr',
};
// ─── Bannière mise à jour ────────────────────────────────
function showUpdateBanner(newSW) {
  // Créer la bannière si elle n'existe pas
  if (document.getElementById('update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.style.cssText = [
    'position:fixed', 'bottom:80px', 'left:50%',
    'transform:translateX(-50%)',
    'background:#2B1D16', 'color:#fff',
    'padding:12px 20px', 'border-radius:24px',
    'font-size:13px', 'font-weight:600',
    'z-index:400', 'display:flex', 'align-items:center', 'gap:12px',
    'box-shadow:0 4px 20px rgba(0,0,0,.3)',
    'white-space:nowrap'
  ].join(';');
  banner.innerHTML = `
    <span>🆕 Nouvelle version disponible</span>
    <button onclick="window._applyUpdate()" style="
      background:#F26522;color:#fff;border:none;
      padding:6px 14px;border-radius:16px;
      font-size:12px;font-weight:700;cursor:pointer">
      Mettre à jour
    </button>`;
  document.body.appendChild(banner);
  window._applyUpdate = () => {
    newSW.postMessage({ type: 'SKIP_WAITING' });
    banner.remove();
  };
}
// ─── Session salle ───────────────────────────────────────
async function initSalleSession() {
  let openSessions = [];
  try {
    openSessions = await getOpenSessions(State.tableId);
  } catch(e) { console.warn('Sessions:', e); }
  if (openSessions.length === 0) {
    // Aucune session → créer directement
    State.sessionId = await createSession(State.tableId, State.uid);
    navigate('menu');
  } else {
    // Sessions existantes → afficher le choix
    showSessionChoice(openSessions);
  }
}
function showSessionChoice(sessions) {
  const main = document.getElementById('view');
  if (!main) return;
  const sessionsHtml = sessions.map(s => {
    const time = s.createdAt?.toDate?.()?.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) || '';
    return `
      <div class="session-card" onclick="window.App.joinSession('${s.sessionId}')">
        <div class="session-card-icon">🪑</div>
        <div class="session-card-info">
          <div class="session-card-title">Addition en cours · #${s.sessionId}</div>
          <div class="session-card-sub">Ouverte à ${time} · Rejoindre cette addition</div>
        </div>
        <div class="session-card-arrow">›</div>
      </div>`;
  }).join('');
  main.innerHTML = `
    <div style="padding:24px 16px;max-width:480px;margin:0 auto">
      <div style="text-align:center;margin-bottom:28px">
        <div style="font-size:48px;margin-bottom:12px">🪑</div>
        <div style="font-size:22px;font-weight:800;color:var(--brown);margin-bottom:6px">
          Table ${State.tableId}
        </div>
        <div style="font-size:14px;color:var(--text-muted)">
          ${sessions.length} addition${sessions.length > 1 ? 's' : ''} en cours sur cette table
        </div>
      </div>
      <div style="margin-bottom:20px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
                    color:var(--text-muted);margin-bottom:10px">Additions en cours</div>
        ${sessionsHtml}
      </div>
      <div style="position:relative;text-align:center;margin-bottom:20px">
        <div style="height:1px;background:var(--border);position:absolute;top:50%;left:0;right:0"></div>
        <span style="position:relative;background:var(--bg);padding:0 12px;
                     font-size:13px;color:var(--text-muted)">ou</span>
      </div>
      <button class="btn btn-primary" onclick="window.App.newSession()">
        ➕ Nouvelle addition séparée
      </button>
      <p style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:10px;line-height:1.5">
        Choisissez "Nouvelle addition" si vous souhaitez payer séparément
      </p>
    </div>`;
}
// ─── Init ─────────────────────────────────────────────────
// ─── Cache menu localStorage ─────────────────────────────
const MENU_CACHE_KEY = 'de_menu_cache';
const MENU_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
function getMenuFromCache() {
  try {
    const raw = localStorage.getItem(MENU_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > MENU_CACHE_TTL) return null;
    return data;
  } catch { return null; }
}
function setMenuCache(menu) {
  try {
    localStorage.setItem(MENU_CACHE_KEY, JSON.stringify({ data: menu, ts: Date.now() }));
  } catch {}
}
async function init() {
  // 1. Service Worker — enregistré uniquement dans de vrais navigateurs
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.register('/sw.js');
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(newSW);
          }
        });
      });
      // Note : on ne fait PAS window.location.reload() sur controllerchange
      // car cela cause des boucles infinies sur certains navigateurs mobiles
    }
  } catch (e) {
    console.info('[SW] Non enregistré :', e.message);
  }
  // 2. Détecter WebView → bannière "Ouvrir dans Chrome/Safari"
  const params0 = new URLSearchParams(window.location.search);
  // Afficher la bannière dans toute WebView (pas seulement QR)
  if (isWebView()) {
    showOpenInBrowserBanner();
  }
  // 3. Langue (anciennement 2)
  initLang();
  State.lang = getLang();
  // 3. Détecter mode (table = salle)
  const params  = new URLSearchParams(window.location.search);
  const tableId = params.get('table');
  if (tableId) {
    State.mode    = 'salle';
    State.tableId = tableId;
    try { await getOrCreateTable(tableId); } catch (e) { console.warn(e); }
    // La session sera choisie/créée après l'auth et le chargement du menu
  }

  // 3bis. Porte de sélection du lieu (livraison / arrivée directe).
  // Pas en salle (QR) + lieu absent de l'URL → on demande de choisir avant de charger.
  if (State.mode !== 'salle' && !RESTO_FROM_URL && !_restoChosen) {
    renderRestoPicker();
    return;
  }

  await bootApp();
}

// Chargement des données + rendu, une fois le lieu déterminé.
async function bootApp() {
  // 4. Auth anonyme avec retry (WebViews lents à initialiser Firebase)
  const viewEl = document.getElementById('view');
  if (viewEl) viewEl.querySelector('p') && (viewEl.querySelector('p').textContent = 'Connexion...');
  State.uid = await authWithRetry();
  if (viewEl) viewEl.querySelector('p') && (viewEl.querySelector('p').textContent = 'Chargement du menu...');
  // 5. Charger le menu depuis localStorage d'abord (affichage instantané)
  // Charger les données depuis Firestore
  try {
    const [menu, zones, rules, pdj, cfg, restoDoc] = await Promise.all([
      withTimeout(fetchMenu(),        15000),
      withTimeout(fetchZones(),       15000),
      withTimeout(fetchUpsellRules(), 15000),
      withTimeout(fetchPlatDuJour(),  10000).catch(() => null),
      getDoc(doc(db, 'config', getRestoId()))
        .then(s => (s && s.exists && s.exists()) ? s : getDoc(doc(db, 'config', 'restaurant')))
        .catch(() => null),
      withTimeout(fetchLieu(getRestoId()), 8000).catch(() => null),
    ]);
    State.menu       = menu       || [];
    State.resto      = restoDoc   || null;
    State.zones      = zones      || [];
    State.platDuJour = pdj;
    initUpselling(rules || [], State.menu);
    // Charger config restaurant (paiements + contacts)
    if (cfg && cfg.exists && cfg.exists()) {
      const cfgData = cfg.data();
      if (cfgData.payments) State.payments = cfgData.payments;
      if (cfgData.contacts) State.contacts = cfgData.contacts;
    }
  } catch (e) {
    // Afficher l'erreur visible sur mobile pour diagnostic
    const view = document.getElementById('view');
    if (view) view.innerHTML = `
      <div style="padding:24px;font-family:monospace;font-size:12px;background:#fff;margin:16px;border-radius:8px;border:2px solid red">
        <strong style="color:red">ERREUR CHARGEMENT</strong><br><br>
        <strong>Message:</strong> ${e.message || e.code || String(e)}<br>
        <strong>Code:</strong> ${e.code || 'n/a'}<br>
        <strong>Type:</strong> ${e.name || 'n/a'}<br><br>
        <button onclick="location.reload()" style="background:#F26522;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:14px;cursor:pointer">
          Réessayer
        </button>
      </div>`;
    return;
  }
  // 6. Panier
  initCart();
  // Assistant IA client
  initAssistant('client');
  // 7. UI header
  updateHeader();
  // 8. Vérifier si commande récente à suivre (< 2h)
  const lastOrder = (() => {
    try {
      const d = JSON.parse(localStorage.getItem('de_last_order') || 'null');
      return d && (Date.now() - d.ts < 2 * 60 * 60 * 1000) ? d : null;
    } catch { return null; }
  })();
  // 9. Rendu initial
  // Détecter la route /devis?id=...&token=...
  if (window.location.pathname.startsWith('/devis') || 
      (window.location.search.includes('id=') && window.location.search.includes('token='))) {
    const params = new URLSearchParams(window.location.search);
    if (params.get('id') && params.get('token')) {
      navigate('devis-client');
      if (window._ai) window._ai.hide();
      return;
    }
  }

  if (State.mode === 'salle' && State.tableId) {
    await initSalleSession();
  } else if (lastOrder && !State.tableId) {
    // Proposer de reprendre le suivi
    navigate('menu'); // charger le menu d'abord
    setTimeout(function() {
      const resume = confirm('Vous avez une commande en cours. Voulez-vous suivre son état ?');
      if (resume) {
        window.App.openTrackingModal(lastOrder.orderId);
      } else {
        localStorage.removeItem('de_last_order');
      }
    }, 1000);
  } else {
    navigate('menu');
  }
  // Init carrousel PDJ si présent
  if (State.platDuJour?.isCarousel && State.platDuJour.slides?.length > 1) {
    setTimeout(() => window.App.pdjInit(State.platDuJour.slides.length), 300);
  }
  // 9. Écouter le hash
  window.addEventListener('hashchange', () => {
    const hash = location.hash.replace('#', '') || 'menu';
    if (hash !== 'checkout' && hash !== 'confirm') renderView(hash);
  });
}
// ─── Détection WebView ────────────────────────────────────
function isWebView() {
  const ua = navigator.userAgent || '';
  // Navigateurs intégrés connus
  if (/wv|WebView|FBAN|FBAV|Instagram|Snapchat|Line\/|MicroMessenger|Twitter|Pinterest|TikTok/.test(ua)) return true;
  // Android sans Chrome (Samsung Browser intégré appli photo, etc.)
  if (ua.includes('Android') && !ua.includes('Chrome/')) return true;
  // iOS sans Safari (WebView in-app)
  if (/iPhone|iPad/.test(ua) && !/Safari\//.test(ua)) return true;
  // Huawei AppGallery / HMS
  if (/HMSCore|HuaweiBrowser/.test(ua)) return false; // Huawei Browser est OK
  // Oppo, Vivo, Xiaomi integrated browsers
  if (/HeyTap|VivoBrowser|MiuiBrowser/.test(ua)) return true;
  return false;
}
// ─── Auth avec retry (3 tentatives) ──────────────────────
async function authWithRetry(attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      const cred = await signInAnonymously(auth);
      window._currentUser = cred.user; // Stocker pour l'upload Storage
      return cred.user.uid;
    } catch (e) {
      if (i < attempts - 1) {
        // Délai progressif : 500ms, 1000ms
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
      } else {
        console.warn('Auth anonyme échouée après', attempts, 'tentatives :', e.message);
      }
    }
  }
  // Continuer sans auth — le menu public ne nécessite pas d'auth
  return null;
}
// ─── Timeout helper ───────────────────────────────────────
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout ' + ms + 'ms')), ms)
    ),
  ]);
}
// ─── Bannière "Ouvrir dans le vrai navigateur" ───────────
function showOpenInBrowserBanner() {
  const pageUrl   = window.location.href;
  const intentUrl = 'intent://' + pageUrl.replace(/^https?:\/\//, '')
    + '#Intent;scheme=https;package=com.android.chrome;end';
  const isAndroid = /Android/.test(navigator.userAgent);
  const isIOS     = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const openUrl   = isAndroid ? intentUrl : pageUrl;
  const overlay = document.createElement('div');
  overlay.id = 'webview-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(43,29,22,.97);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;font-family:sans-serif;text-align:center';
  const btn = document.createElement('a');
  btn.href = openUrl;
  btn.textContent = '🟠 Ouvrir dans Chrome';
  btn.style.cssText = 'background:#F26522;color:#fff;padding:14px 32px;border-radius:24px;font-weight:800;font-size:16px;text-decoration:none;display:block;margin-bottom:12px;width:100%;max-width:280px;box-sizing:border-box';
  btn.addEventListener('click', function() {
    document.getElementById('webview-overlay')?.remove();
  });
  const skipBtn = document.createElement('button');
  skipBtn.textContent = 'Continuer quand même';
  skipBtn.style.cssText = 'background:none;border:none;color:rgba(255,255,255,.4);font-size:12px;margin-top:20px;cursor:pointer;text-decoration:underline';
  skipBtn.addEventListener('click', function() {
    document.getElementById('webview-overlay')?.remove();
  });
  let iosHint = '';
  if (isIOS) {
    const hint = document.createElement('div');
    hint.style.cssText = 'margin-top:16px;color:rgba(255,255,255,.5);font-size:12px';
    hint.textContent = 'Ou copiez ce lien dans Safari : ' + pageUrl;
    overlay.appendChild(hint);
  }
  overlay.innerHTML = '<div style="font-size:48px;margin-bottom:16px">📱</div>'
    + '<div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:8px">Ouvrir dans Chrome</div>'
    + '<div style="font-size:14px;color:rgba(255,255,255,.7);margin-bottom:28px;line-height:1.6">Pour commander, veuillez ouvrir<br>ce lien dans votre navigateur Chrome.</div>';
  overlay.appendChild(btn);
  overlay.appendChild(skipBtn);
  document.body.appendChild(overlay);
}

function showRetryScreen() {
  const main = document.getElementById('view');
  if (!main) return;
  main.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                min-height:60vh;gap:16px;padding:32px;text-align:center">
      <div style="font-size:56px">📶</div>
      <h3 style="font-size:18px;font-weight:800;color:var(--brown)">Connexion impossible</h3>
      <p style="font-size:14px;color:var(--text-muted);line-height:1.6;max-width:280px">
        Vérifiez votre connexion internet et réessayez.<br>
        Si le problème persiste, ouvrez ce lien dans Chrome ou Safari.
      </p>
      <button class="btn btn-primary" style="width:auto;padding:12px 28px"
              onclick="window.location.reload()">
        🔄 Réessayer
      </button>
      <a href="${window.location.href}" target="_blank"
         style="font-size:13px;color:var(--orange);text-decoration:none;margin-top:4px">
        Ouvrir dans le navigateur →
      </a>
    </div>`;
}
// ─── Navigation ──────────────────────────────────────────
export function navigate(view, data = {}) {
  location.hash = view;
  renderView(view, data);
}
function renderView(view, data = {}) {
  const main = document.getElementById('view');
  if (!main) return;
  switch (view) {
    case 'menu':     renderMenu(main); break;
    case 'cart':     renderCart(main); break;
    case 'checkout': renderCheckout(main); break;
    case 'confirm':  renderConfirm(main, data.orderId, data.operateur); break;
    case 'tracking': renderTracking(main, data.orderId); break;
    case 'traiteur': renderTraiteur(main); break;
    case 'devis-client': renderDevisClient(main); break;
    default:         renderMenu(main);
  }
  window.scrollTo(0, 0);
}
// ─── Header ──────────────────────────────────────────────
function updateHeader() {
  const badge = document.getElementById('mode-badge');   // = sous-titre du logo
  if (badge) {
    // 1) La tagline de marque reste affichée
    badge.textContent = t('brand_tagline');              // "Resto & Traiteur"

    // 2) Marqueur d'établissement, ajouté juste SOUS la tagline (dans le logo,
    //    donc toujours visible ; le clic sur le logo gère déjà le changement).
    const parent = badge.parentNode;
    let mk = document.getElementById('resto-marker');
    const show = State.mode === 'salle' ? !!State.tableId : !!State.resto;
    if (show && parent) {
      if (!mk) {
        mk = document.createElement('div');
        mk.id = 'resto-marker';
        mk.style.cssText = 'font-size:12px;margin-top:1px;line-height:1.2;display:flex;align-items:center;gap:5px;max-width:210px';
        parent.appendChild(mk);
      }
      // Même couleur que la tagline "Resto & Traiteur" (header sombre → texte clair)
      try { mk.style.color = getComputedStyle(badge).color; } catch (_) {}
      if (State.mode === 'salle') {
        mk.innerHTML = `<strong>${t('mode_salle')} ${State.tableId}</strong>`;
      } else {
        // Nom court (commune de préférence) + ellipse ; « Changer » reste sur la même ligne.
        const court = State.resto?.commune || State.resto?.nom || '';
        const mapU = lieuMapUrl(State.resto);
        mk.innerHTML = `<a href="${mapU}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Voir sur Google Maps" style="color:inherit;text-decoration:none;display:inline-flex;align-items:center;overflow:hidden;min-width:0"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📍 <strong>${court}</strong></span></a>`
          + `<span style="color:#F26522;font-weight:700;white-space:nowrap;flex:0 0 auto">· ${t('picker_change_short')}</span>`;
      }
    } else if (mk) {
      mk.remove();
    }
  }

  // Bouton langue
  const langBtn = document.getElementById('lang-btn');
  if (langBtn) langBtn.textContent = State.lang.toUpperCase();
  // Badge panier
  updateCartBadge();
}
function updateCartBadge() {
  const el = document.getElementById('cart-count');
  const n  = getCount();
  if (!el) return;
  el.textContent = n;
  el.classList.toggle('hidden', n === 0);
}
// ─── Render Plat du Jour ─────────────────────────────────
function renderPlatDuJour(pdj) {
  if (!pdj) return '';
  const lang = State.lang;
  // ── Mode carrousel (3 slides) ──────────────────────────
  if (pdj.isCarousel && pdj.slides?.length) {
    return renderPDJCarousel(pdj.slides, lang);
  }
  // ── Mode legacy (1 seul plat) ─────────────────────────
  const name  = lang === 'en' ? (pdj.name_en || pdj.name_fr) : pdj.name_fr;
  const desc  = lang === 'en' ? (pdj.description_en || pdj.description_fr || '') : (pdj.description_fr || '');
  const price = pdj.price ? formatFCFA(pdj.price) : 'Sur devis';
  const imgHtml = pdj.imageUrl
    ? `<img class="pdj-slide-img" src="${pdj.imageUrl}" alt="${name}">`
    : `<div class="pdj-slide-noimg">🍽️</div>`;
  return `
    <div class="pdj-carousel">
      <div class="pdj-track">
        <div class="pdj-slide" onclick="window.App.openItem('${pdj.menuItemId || ''}')">
          ${imgHtml}
          <div class="pdj-slide-overlay"></div>
          <div class="pdj-slide-content">
            <div class="pdj-slide-label">${lang === 'en' ? "Chef's Special" : "Suggestion du chef"}</div>
            <div class="pdj-slide-name">${name}</div>
            <div class="pdj-slide-desc">${desc}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
              <div class="pdj-slide-price">${price}</div>
              ${pdj.menuItemId ? `<button onclick="event.stopPropagation();window.App.addPdjToCart('${pdj.menuItemId}')"
                style="background:#F26522;color:#fff;border:none;border-radius:20px;
                       padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer">
                ${lang === 'en' ? 'Order' : 'Commander'}
              </button>` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}
function renderPDJCarousel(slides, lang) {
  const types = {
    entree:  { label: lang === 'en' ? 'Starter'     : 'Entrée',          cls: 'pdj-type-entree'  },
    plat:    { label: lang === 'en' ? 'Main course'  : 'Plat de résistance', cls: 'pdj-type-plat'    },
    dessert: { label: lang === 'en' ? 'Dessert'      : 'Dessert',          cls: 'pdj-type-dessert' },
  };
  const slidesHtml = slides.map((s, i) => {
    const name  = lang === 'en' ? (s.name_en || s.name_fr) : s.name_fr;
    const desc  = s.description_fr || '';
    const price = s.price ? formatFCFA(s.price) : 'Sur devis';
    const type  = types[s.type] || types.plat;
    const img   = s.imageUrl
      ? `<img class="pdj-slide-img" src="${s.imageUrl}" alt="${name}" loading="lazy">`
      : `<div class="pdj-slide-noimg">🍽️</div>`;
    return `
      <div class="pdj-slide" data-index="${i}">
        <div class="pdj-img-wrap" onclick="window.App.openItem('${s.menuItemId || ''}')">
          ${img}
        </div>
        <div class="pdj-slide-content" onclick="window.App.openItem('${s.menuItemId || ''}')">
          <div style="flex:1">
            <span class="pdj-type-badge ${type.cls}" style="position:static;display:inline-block;margin-bottom:5px">${type.label}</span>
            <div class="pdj-slide-label">${lang === 'en' ? "Menu of the day" : "Menu du jour"}</div>
            <div class="pdj-slide-name">${name || '—'}</div>
            ${desc ? `<div class="pdj-slide-desc">${desc}</div>` : ''}
            <div class="pdj-slide-price">${price}</div>
          </div>
          ${s.menuItemId ? `<button onclick="event.stopPropagation();window.App.addPdjToCart('${s.menuItemId}')"
            style="background:#F26522;color:#fff;border:none;border-radius:20px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0">
            ${lang === 'en' ? 'Order' : 'Commander'}
          </button>` : ''}
        </div>
      </div>`;
  }).join('');
  const dotsHtml = slides.map((_, i) =>
    `<div class="pdj-dot ${i === 0 ? 'active' : ''}" onclick="window.App.pdjGoTo(${i})"></div>`
  ).join('');
  const navHtml = slides.length > 1 ? `
    <div class="pdj-nav-overlay">
      <button class="pdj-nav prev" onclick="window.App.pdjPrev()">‹</button>
      <button class="pdj-nav next" onclick="window.App.pdjNext()">›</button>
      <div class="pdj-dots" id="pdj-dots">${dotsHtml}</div>
    </div>` : '';
  return `
    <div class="pdj-carousel" id="pdj-carousel">
      <div class="pdj-track" id="pdj-track">${slidesHtml}</div>
      ${navHtml}
    </div>`;
}

// ─── Rendu Menu ───────────────────────────────────────────
function buildContactBlock() {
  const c = State.contacts;
  if (!c) return '';
  const items = [];
  if (c.tel1 && c.tel1_show !== false) {
    items.push('<a href="tel:' + c.tel1.replace(/\s/g,'') + '" style="display:flex;align-items:center;gap:12px;padding:12px 0;text-decoration:none;color:var(--brown);border-bottom:1px solid var(--border)">'
      + '<div style="width:40px;height:40px;background:var(--orange-soft);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">📞</div>'
      + '<div><div style="font-size:12px;color:var(--muted)">' + (c.tel1_label||'Téléphone') + '</div>'
      + '<div style="font-weight:700;font-size:15px">' + c.tel1 + '</div></div></a>');
  }
  if (c.tel2 && c.tel2_show !== false) {
    items.push('<a href="tel:' + c.tel2.replace(/\s/g,'') + '" style="display:flex;align-items:center;gap:12px;padding:12px 0;text-decoration:none;color:var(--brown);border-bottom:1px solid var(--border)">'
      + '<div style="width:40px;height:40px;background:var(--orange-soft);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">📱</div>'
      + '<div><div style="font-size:12px;color:var(--muted)">' + (c.tel2_label||'Mobile') + '</div>'
      + '<div style="font-weight:700;font-size:15px">' + c.tel2 + '</div></div></a>');
  }
  if (c.email && c.email_show !== false) {
    items.push('<a href="mailto:' + c.email + '" style="display:flex;align-items:center;gap:12px;padding:12px 0;text-decoration:none;color:var(--brown)">'
      + '<div style="width:40px;height:40px;background:var(--orange-soft);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">✉️</div>'
      + '<div><div style="font-size:12px;color:var(--muted)">Email</div>'
      + '<div style="font-weight:700;font-size:15px">' + c.email + '</div></div></a>');
  }
  if (!items.length) return '';
  return '<div style="margin:16px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(43,29,22,.08)">'
    + '<div style="background:linear-gradient(135deg,#2B1D16,#4A3020);padding:14px 20px;display:flex;align-items:center;gap:10px">'
    +   '<div style="font-size:20px">📬</div>'
    +   '<div style="font-size:15px;font-weight:800;color:#fff">Nous contacter</div>'
    + '</div>'
    + '<div style="padding:0 20px">' + items.join('') + '</div>'
    + '</div>';
}
function renderMenu(container) {
  if (!State.menu.length) {
    const nom = State.resto?.nom || State.resto?.commune || '';
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🍽️</div>
        <p class="empty-state-title">${t('menu_empty_title')}</p>
        <p class="empty-state-sub">${nom ? nom + ' — ' : ''}${t('menu_empty_sub')}</p>
        ${State.mode !== 'salle'
          ? `<button class="empty-state-btn" onclick="window.App.changeResto()">${t('picker_change')}</button>`
          : ''}
      </div>
      <style>
        .empty-state{max-width:480px;margin:48px auto;text-align:center;padding:0 16px}
        .empty-state-icon{font-size:48px;margin-bottom:12px}
        .empty-state-title{font-size:18px;font-weight:700;color:var(--brown-dk,#2B1D16);margin:0 0 6px}
        .empty-state-sub{font-size:14px;color:var(--brown-md,#7a6a55);margin:0 0 20px;line-height:1.4}
        .empty-state-btn{background:#F26522;color:#fff;border:none;border-radius:12px;
          padding:12px 22px;font-weight:700;font-size:14px;cursor:pointer;transition:background .14s}
        .empty-state-btn:hover{background:#d8551a}
      </style>`;
    return;
  }
  // Banner
  const bannerText = State.mode === 'salle'
    ? `<span class="mode-badge salle">${t('mode_salle')}</span> ${t('banner_salle')} <strong>${t('banner_table')} ${State.tableId}</strong>`
    : `<span class="mode-badge livraison">${t('mode_livraison')}</span> ${t('banner_livraison')}`;
  // Items visibles : indisponibles masqués ; en LIVRAISON on retire en plus les
  // articles « sur place uniquement » (boissons en emballage consigné).
  const availableMenu = State.menu.filter(m =>
    m.available !== false && !(State.mode === 'livraison' && m.salleOnly === true)
  );
  // Catégories uniques (basées sur les items réellement visibles)
  const cats = ['all', ...new Set(availableMenu.map(m => m.category))];
  const getCatLabel = c => {
    if (c === 'all') return t('all');
    const key = 'cat_' + c;
    const val = t(key);
    // Si t() retourne la clé (traduction manquante), capitalise le nom brut
    return (val && val !== key) ? val : c.charAt(0).toUpperCase() + c.slice(1);
  };
  const catTabsHtml = cats.map(c => `
    <button class="cat-tab ${State.activeCategory === c ? 'active' : ''}"
            onclick="window.App.setCategory('${c}')">
      ${getCatLabel(c)}
    </button>`).join('');
  // Items filtrés par catégorie (repli sur « tout » si la catégorie n'est plus visible)
  const activeCat = (State.activeCategory !== 'all' && !cats.includes(State.activeCategory))
    ? 'all' : State.activeCategory;
  const items = activeCat === 'all'
    ? availableMenu
    : availableMenu.filter(m => m.category === activeCat);
  const cardsHtml = items.map(item => `
    <div class="menu-card" onclick="window.App.openItem('${item.id}')">
      <div class="card-img">
        ${item.imageUrl
          ? `<img src="${item.imageUrl}" alt="${itemName(item)}" loading="lazy">`
          : `<div class="no-img">🍽️</div>`}
      </div>
      <div class="card-body">
        <div class="card-name">${itemName(item)}</div>
        <div class="card-desc">${itemDesc(item)}</div>
        <div class="card-price">${item.prixVariable ? '<span style="font-size:12px;color:var(--brown-md)">📞 Sur devis</span>' : formatFCFA(item.price)}</div>
      </div>
    </div>`).join('');
  const pdjHtml = renderPlatDuJour(State.platDuJour);
  container.innerHTML = `
    <div class="mode-banner">${bannerText}</div>
    ${pdjHtml}
    <div class="cat-tabs">${catTabsHtml}</div>
    <div class="menu-grid">${cardsHtml}</div>
    ${buildContactBlock()}
  `;
  // Initialiser le carrousel si présent
  const pdj = State.platDuJour;
  if (pdj?.isCarousel && pdj.slides?.length > 1) {
    requestAnimationFrame(() => window.App.pdjInit(pdj.slides.length));
  }
  // Afficher l'assistant après chargement du menu
  if (window._ai) window._ai.show();
}
// ─── Modal Item ───────────────────────────────────────────
function openItem(itemId) {
  const item = State.menu.find(m => m.id === itemId);
  if (!item) return;
  const upsells  = getUpsells(item);
  // En livraison, ne pas suggérer d'articles « sur place uniquement » (emballage consigné)
  if (State.mode === 'livraison') {
    upsells.accompagnements = (upsells.accompagnements || []).filter(u => !u.salleOnly);
    upsells.boissons        = (upsells.boissons || []).filter(u => !u.salleOnly);
  }
  const boisson  = isBoisson(item);
  const formats  = hasFormats(item);
  // Options glaçons (boissons)
  const glaceHtml = boisson ? `
    <div class="option-group">
      <div class="option-label">${t('opt_glace')}</div>
      <div class="option-chips">
        <button class="chip active" id="glace-oui" onclick="window.App.setOption('glace','oui')">${t('opt_oui')}</button>
        <button class="chip"        id="glace-non" onclick="window.App.setOption('glace','non')">${t('opt_non')}</button>
      </div>
    </div>` : '';
  // Options format (Entier/Demi pour plats, Petit/Grand pour boissons)
  const fmtLabels = getFormatLabels(item);
  const formatHtml = formats && fmtLabels ? `
    <div class="option-group">
      <div class="option-label">Portion</div>
      <div class="option-chips">
        <button class="chip active" id="fmt-base" onclick="window.App.setOption('format','base')">
          ${fmtLabels.base} — ${formatFCFA(item.price)}
        </button>
        <button class="chip" id="fmt-alt" onclick="window.App.setOption('format','${fmtLabels.altKey}')">
          ${fmtLabels.alt} — ${formatFCFA(getPrixForFormat(item, fmtLabels.altKey))}
        </button>
      </div>
    </div>` : '';
  // Accompagnements upsell
  const accompHtml = upsells.accompagnements.length ? `
    <div class="upsell-section">
      <div class="upsell-title">${t('upsell_accomp')}</div>
      <div class="upsell-list">
        ${upsells.accompagnements.map(u => `
          <div class="upsell-chip" id="upsell-${u.id}" onclick="window.App.toggleUpsell('${u.id}')">
            <div class="upsell-chip-name">${itemName(u)}</div>
            <div class="upsell-chip-price">+${formatFCFA(u.price)}</div>
          </div>`).join('')}
      </div>
    </div>` : '';
  // Boissons upsell
  const boissonUpsellHtml = upsells.boissons.length ? `
    <div class="upsell-section">
      <div class="upsell-title">${t('upsell_boisson')}</div>
      <div class="upsell-list">
        ${upsells.boissons.map(u => `
          <div class="upsell-chip" id="upsell-${u.id}" onclick="window.App.toggleUpsell('${u.id}')">
            <div class="upsell-chip-name">${itemName(u)}</div>
            <div class="upsell-chip-price">+${formatFCFA(u.price)}</div>
          </div>`).join('')}
      </div>
    </div>` : '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'item-modal';
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-img-wrap">
        ${item.imageUrl
          ? `<img class="modal-img" src="${item.imageUrl}" alt="${itemName(item)}">`
          : `<div class="modal-img" style="display:flex;align-items:center;justify-content:center;font-size:64px;">🍽️</div>`}
        <button class="close-btn" onclick="window.App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-name">${itemName(item)}</div>
        <div class="modal-desc">${itemDesc(item)}</div>
        <div class="modal-price">${formatFCFA(item.price)}</div>
        ${glaceHtml}
        ${formatHtml}
        <div class="option-group">
          <div class="qty-control">
            <button class="qty-btn" onclick="window.App.changeQty(-1)">−</button>
            <span class="qty-num" id="item-qty">1</span>
            <button class="qty-btn" onclick="window.App.changeQty(1)">+</button>
          </div>
        </div>
        <div class="comment-wrap">
          <label>${t('opt_comment')}</label>
          <textarea id="item-comment" maxlength="100" rows="2"
                    placeholder="${t('comment_placeholder')}"
                    oninput="document.getElementById('char-count').textContent=this.value.length"></textarea>
          <div class="char-count"><span id="char-count">0</span>/100</div>
        </div>
        <button class="btn btn-primary mt-16" onclick="window.App.addToCart('${item.id}')">
          ${t('add_to_cart')}
        </button>
      </div>
      ${accompHtml}
      ${boissonUpsellHtml}
    </div>`;
  document.body.appendChild(overlay);
  // État local de la modal
  window._itemModal = { itemId, qty: 1, glace: 'oui', format: 'base', selectedUpsells: [] };
}
// ─── Actions modal ────────────────────────────────────────
function setOption(type, value) {
  if (!window._itemModal) return;
  window._itemModal[type] = value;
  if (type === 'glace') {
    document.getElementById('glace-oui')?.classList.toggle('active', value === 'oui');
    document.getElementById('glace-non')?.classList.toggle('active', value === 'non');
  }
  if (type === 'format') {
    document.getElementById('fmt-base')?.classList.toggle('active', value === 'base');
    document.getElementById('fmt-alt')?.classList.toggle('active', value !== 'base');
  }
}
function changeQty(delta) {
  if (!window._itemModal) return;
  window._itemModal.qty = Math.max(1, (window._itemModal.qty || 1) + delta);
  const el = document.getElementById('item-qty');
  if (el) el.textContent = window._itemModal.qty;
}
function toggleUpsell(upsellId) {
  if (!window._itemModal) return;
  const arr = window._itemModal.selectedUpsells;
  const idx = arr.indexOf(upsellId);
  if (idx === -1) arr.push(upsellId);
  else arr.splice(idx, 1);
  document.getElementById(`upsell-${upsellId}`)?.classList.toggle('selected', idx === -1);
}
function addToCart(itemId) {
  const item = State.menu.find(m => m.id === itemId);
  if (!item || !window._itemModal) return;
  const m = window._itemModal;
  const upsellItems = (m.selectedUpsells || [])
    .map(id => State.menu.find(mi => mi.id === id))
    .filter(Boolean);
  const fmt = hasFormats(item) ? m.format : null;
  const fmtPrice = fmt ? getPrixForFormat(item, fmt) : item.price;
  addItem(item, {
    qty:        m.qty,
    glace:      isBoisson(item) ? m.glace === 'oui' : null,
    format:     fmt,
    prixFormat: fmt ? fmtPrice - item.price : 0,
    comment:    document.getElementById('item-comment')?.value || '',
    upsells:    upsellItems,
  });
  closeModal();
  updateCartBadge();
  showToast(t('added_toast'));
}
function closeModal() {
  document.getElementById('item-modal')?.remove();
  window._itemModal = null;
}
function setCategory(cat) {
  State.activeCategory = cat;
  renderView('menu');
}
// ─── Rendu Panier ─────────────────────────────────────────
function renderCart(container) {
  const items = getItems();
  if (!items.length) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <h3>${t('cart_empty')}</h3>
        <p class="text-muted">${t('cart_empty_sub')}</p>
        <button class="btn btn-primary" style="width:auto;padding:12px 24px;margin-top:8px"
                onclick="window.App.navigate('menu')">${t('cart_back')}</button>
      </div>`;
    return;
  }
  const itemsHtml = items.map(item => {
    const opts = [
      item.glace != null ? (item.glace ? '🧊 ' + t('opt_oui') : t('opt_non')) : '',
      item.format ? t('opt_' + item.format) : '',
      ...( item.upsells?.map(u => '+ ' + (getLang() === 'en' ? (u.name_en || u.name_fr) : u.name_fr)) || []),
      item.comment ? `"${item.comment}"` : '',
    ].filter(Boolean).join(' · ');
    return `
      <div class="cart-item">
        <div class="cart-item-img">
          ${item.imageUrl
            ? `<img src="${item.imageUrl}" alt="${itemName(item)}" style="height:100%;object-fit:cover">`
            : `<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:24px">🍽️</div>`}
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${itemName(item)}</div>
          ${opts ? `<div class="cart-item-opts">${opts}</div>` : ''}
          <div class="cart-item-price">${formatFCFA(item.price * item.qty)}</div>
          <div class="cart-item-actions">
            <button class="qty-btn" style="width:28px;height:28px;font-size:16px"
                    onclick="window.App.updateQty('${item.uid}',-1)">−</button>
            <span style="font-weight:700;font-size:14px">${item.qty}</span>
            <button class="qty-btn" style="width:28px;height:28px;font-size:16px"
                    onclick="window.App.updateQty('${item.uid}',1)">+</button>
            <button class="remove-btn" onclick="window.App.removeItem('${item.uid}')">${t('remove')}</button>
          </div>
        </div>
      </div>`;
  }).join('');
  const sous_total = getTotal();
  container.innerHTML = `
    <div style="padding:16px 16px 8px">
      <h2 style="font-size:20px;font-weight:800;color:var(--brown)">${t('cart_title')}</h2>
    </div>
    <div class="divider"></div>
    ${itemsHtml}
    <div class="cart-summary">
      <div class="cart-summary-row">
        <span>${t('subtotal')}</span>
        <span>${formatFCFA(sous_total)}</span>
      </div>
      ${State.mode === 'livraison' ? `
        <div class="cart-summary-row">
          <span>${t('delivery_fee')}</span>
          <span style="font-size:12px;color:var(--text-muted)">Calculé à la commande</span>
        </div>` : ''}
      <div class="cart-summary-total">
        <span>${t('total')}</span>
        <span style="color:var(--orange)">${formatFCFA(sous_total)}</span>
      </div>
      <button class="btn btn-primary" onclick="window.App.goCheckout()">
        ${State.mode === 'salle' ? t('order_btn_salle') : t('order_btn_liv')} →
      </button>
    </div>`;
}
function doUpdateQty(uid, delta) { updateQty(uid, delta); updateCartBadge(); renderView('cart'); }
function doRemoveItem(uid) { removeItem(uid); updateCartBadge(); renderView('cart'); }
function goCheckout() { navigate('checkout'); }
// ─── Rendu Checkout ───────────────────────────────────────
// ─── Modes de paiement dynamiques ────────────────────────
function buildPaymentOptions(mode) {
  const pm  = State.payments || { especes: true, wave: true, orange: false, mtn: false };
  const tel = (State.contacts?.tel1 && State.contacts.tel1_show !== false)
              ? State.contacts.tel1
              : (State.contacts?.tel2 || '');
  const isLivraison = mode !== 'salle';

  const opts = [];
  // Espèces : UNIQUEMENT en salle. En livraison, paiement mobile confirmé à l'avance.
  if (!isLivraison) {
    opts.push({ id: 'especes', logo: '💵', name: 'Espèces',
                desc: t('pay_cash_table') || 'Paiement en liquide à la table' });
  }
  if (pm.wave !== false) opts.push({ id: 'wave',   logo: '🌊', name: 'Wave',            desc: `Wave CI${tel ? ' · ' + tel : ''}` });
  if (pm.orange)         opts.push({ id: 'orange', logo: '🟠', name: 'Orange Money',     desc: `Orange Money${tel ? ' · ' + tel : ''}` });
  if (pm.mtn)            opts.push({ id: 'mtn',    logo: '💛', name: 'MTN Mobile Money', desc: 'Paiement MTN MoMo' });
  // Filet de sécurité : si aucun paiement mobile n'est configuré, on autorise l'espèce
  if (!opts.length) opts.push({ id: 'especes', logo: '💵', name: 'Espèces',
                desc: t('pay_cash_delivery') || 'Paiement à la livraison' });

  let html = '';
  if (isLivraison) {
    const note = t('pay_note_livraison')
      || "En livraison, le paiement mobile se règle à l'avance : c'est sa confirmation qui valide et déclenche votre commande.";
    html += `<div style="background:#FFF7ED;border:1px solid #FED7AA;color:#9A3412;border-radius:10px;
      padding:10px 12px;font-size:13px;line-height:1.5;margin-bottom:12px;display:flex;gap:8px;align-items:flex-start">
      <span>ℹ️</span><span>${note}</span></div>`;
  }
  html += '<div class="payment-options">';
  opts.forEach((o, i) => {
    const sel = i === 0 ? ' selected' : '';
    const chk = i === 0 ? ' checked' : '';
    html += `<label class="payment-option${sel}" id="pay-${o.id}" onclick="window.App.selectPayment('${o.id}')">
      <input type="radio" name="payment" value="${o.id}"${chk}>
      <span class="payment-logo">${o.logo}</span>
      <div><div class="payment-name">${o.name}</div><div class="payment-desc">${o.desc}</div></div>
    </label>`;
  });
  html += '</div>';
  return html;
}
function renderCheckout(container) {
  if (isEmpty()) { navigate('menu'); return; }
  const sous_total = getTotal();
  if (State.mode === 'salle') {
    const itemsHtml = getItems().map(i => `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:13px;color:var(--brown)">${itemName(i)} ×${i.qty}</span>
        <span style="font-size:13px;font-weight:700;color:var(--orange)">${formatFCFA(i.price * i.qty)}</span>
      </div>`).join('');
    container.innerHTML = `
      <div style="padding:16px">
        <h2 style="font-size:20px;font-weight:800;color:var(--brown);margin-bottom:16px">${t('checkout_title')}</h2>
      </div>
      <div class="checkout-section">
        <div class="checkout-section-title">${t('your_order')}</div>
        ${itemsHtml}
        <div style="display:flex;justify-content:space-between;margin-top:12px;font-weight:800;font-size:16px">
          <span>${t('total')}</span>
          <span style="color:var(--orange)">${formatFCFA(sous_total)}</span>
        </div>
      </div>
      <div class="checkout-section" style="margin-top:12px">
        <div class="checkout-section-title">${t('payment_title')}</div>
        ${buildPaymentOptions('salle')}
      </div>
      <div style="padding:16px">
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;margin-bottom:16px">
          <span>${t('total')}</span>
          <span style="color:var(--orange)">${formatFCFA(sous_total)}</span>
        </div>
        <button class="btn btn-primary" id="confirm-btn" onclick="window.App.confirmSalle()">
          ${t('confirm_salle')} →
        </button>
      </div>`;
    window._selectedPayment = 'especes';
    return;
  }

  // Mode livraison
  const noZones = !State.zones.length;
  const zonesOptions = State.zones.map(z =>
    `<option value="${z.id}" data-frais="${z.frais}">${z.name} — ${formatFCFA(z.frais)}</option>`
  ).join('');
  container.innerHTML = `
    <div style="padding:16px">
      <h2 style="font-size:20px;font-weight:800;color:var(--brown);margin-bottom:4px">${t('checkout_title')}</h2>
    </div>
    <div class="checkout-section">
      <div class="checkout-section-title">${t('delivery_info')}</div>
      <div class="form-group">
        <label class="form-label">${t('nom')} *</label>
        <input class="form-input" id="liv-nom" type="text" placeholder="Kouamé Adjoua" required>
      </div>
      <div class="form-group">
        <label class="form-label">${t('telephone')} *</label>
        <input class="form-input" id="liv-tel" type="tel" placeholder="+225 07 00 00 00 00" required>
      </div>
      <div class="form-group">
        <label class="form-label">${t('adresse')} *</label>
        <input class="form-input" id="liv-adresse" type="text" placeholder="Rue des Cocotiers, Grand-Bassam" required>
      </div>
      <div class="form-group">
        <label class="form-label">${t('zone')} *</label>
        <select class="form-select" id="liv-zone" onchange="window.App.onZoneChange(this)" ${noZones ? 'disabled' : ''}>
          <option value="">${t('select_zone')}</option>
          ${zonesOptions}
        </select>
      </div>
      ${noZones ? `<div style="background:#FEF3C7;color:#92400E;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.5;margin-top:4px">⚠️ Aucune zone de livraison n'est disponible pour cet établissement pour le moment. La livraison n'est pas possible ici — vous pouvez commander sur place.</div>` : ''}
      <div id="frais-display" style="display:none;padding:10px 14px;background:var(--orange-light);border-radius:var(--r);font-size:13px;color:var(--orange-dark);font-weight:700;margin-top:4px"></div>
    </div>
    <div class="checkout-section" style="margin-top:12px">
      <div class="checkout-section-title">${t('payment_title')}</div>
      ${buildPaymentOptions('livraison')}
    </div>
    <div style="padding:16px">
      <div style="display:flex;justify-content:space-between;font-size:15px;margin-bottom:4px">
        <span style="color:var(--text-muted)">${t('subtotal')}</span>
        <span style="font-weight:700">${formatFCFA(sous_total)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:15px;margin-bottom:12px">
        <span style="color:var(--text-muted)">${t('delivery_fee')}</span>
        <span id="total-frais" style="font-weight:700">—</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;margin-bottom:16px;padding-top:8px;border-top:1px solid var(--border)">
        <span>${t('total')}</span>
        <span id="total-final" style="color:var(--orange)">${formatFCFA(sous_total)}</span>
      </div>
      <button class="btn btn-primary" id="confirm-btn" onclick="window.App.confirmLivraison()" ${noZones ? 'disabled style="opacity:.5"' : ''}>
        ${t('confirm_liv')} 💳
      </button>
    </div>`;
  const _pm = State.payments || {};
  window._selectedPayment = _pm.wave !== false ? 'wave' : _pm.orange ? 'orange' : _pm.mtn ? 'mtn' : 'especes';
  window._selectedZone    = null;
}
function onZoneChange(sel) {
  const option  = sel.options[sel.selectedIndex];
  const frais   = parseInt(option.dataset.frais || '0');
  const zoneId  = sel.value;
  const zoneName = option.text;
  window._selectedZone = { id: zoneId, name: zoneName, frais };
  const sous_total = getTotal();
  const total = sous_total + frais;
  document.getElementById('frais-display').style.display = 'block';
  document.getElementById('frais-display').textContent = `Frais de livraison : ${formatFCFA(frais)}`;
  document.getElementById('total-frais').textContent = formatFCFA(frais);
  document.getElementById('total-final').textContent  = formatFCFA(total);
}
function selectPayment(op) {
  window._selectedPayment = op;
  ['especes','wave','orange','mtn'].forEach(o => {
    document.getElementById(`pay-${o}`)?.classList.toggle('selected', o === op);
  });
}

// ─── Liens de paiement Mobile Money ──────────────────────
const WAVE_MERCHANT_ID  = 'M_REMPLACER'; // ← Remplacer par votre ID Wave Business
const OM_MERCHANT_ID    = '';             // ← Orange Money (si disponible)
function getMobileMoneyUrl(operateur, amount, orderId) {
  const num = '0759731911'; // numéro marchand restaurant
  const ref = 'DE-' + orderId.slice(-6).toUpperCase();
  const amt = Math.round(amount);
  if (operateur === 'wave') {
    // Deep link Wave CI — ouvre l'app Wave avec numéro + montant pré-remplis
    return 'waveci://transfer?phone=' + num + '&amount=' + amt + '&note=' + ref;
  }
  if (operateur === 'orange') {
    // Deep link Orange Money CI
    return 'orangemoney://send?phone=' + num + '&amount=' + amt;
  }
  if (operateur === 'mtn') {
    // USSD MTN MoMo
    return 'tel:*133*' + num + '*' + amt + '#';
  }
  return null;
}
function showPaymentInstructions(operateur, amount, orderId) {
  const num   = '0759731911';
  const amt   = Math.round(amount).toLocaleString('fr-FR');
  const ref   = 'DE-' + orderId.slice(-6).toUpperCase();
  const payUrl = getMobileMoneyUrl(operateur, amount, orderId);
  const icons = { wave:'🌊', orange:'🟠', mtn:'💛' };
  const names = { wave:'Wave CI', orange:'Orange Money', mtn:'MTN MoMo' };
  const overlay = document.createElement('div');
  overlay.id = 'payment-instructions';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(43,29,22,.8);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:#fff;border-radius:24px 24px 0 0;width:100%;max-width:480px;padding:28px 24px 40px';
  sheet.innerHTML = '<div style="text-align:center;margin-bottom:24px">'
    + '<div style="font-size:48px;margin-bottom:8px">' + (icons[operateur]||'📱') + '</div>'
    + '<div style="font-size:20px;font-weight:800;color:#2B1D16">Paiement ' + (names[operateur]||operateur) + '</div>'
    + '<div style="font-size:28px;font-weight:800;color:#F26522;margin:8px 0">' + amt + ' FCFA</div>'
    + '</div>'
    + '<div style="background:#F9F5F0;border-radius:12px;padding:16px;margin-bottom:20px">'
    +   '<div style="font-size:13px;color:#7A6356;margin-bottom:6px">Envoyez ce montant au :</div>'
    +   '<div style="font-size:22px;font-weight:800;color:#2B1D16;letter-spacing:2px">' + num + '</div>'
    +   '<div style="font-size:12px;color:#7A6356;margin-top:4px">Référence : <strong>' + ref + '</strong></div>'
    + '</div>';
  // Button to open app directly
  const openBtn = document.createElement('a');
  openBtn.href = payUrl;
  openBtn.style.cssText = 'display:block;width:100%;padding:16px;background:#F26522;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:800;cursor:pointer;text-align:center;text-decoration:none;margin-bottom:10px;box-sizing:border-box';
  openBtn.textContent = 'Ouvrir ' + (names[operateur]||operateur);
  openBtn.addEventListener('click', function() {
    setTimeout(function() { overlay.remove(); }, 1500);
  });
  const doneBtn = document.createElement('button');
  doneBtn.textContent = "J'ai effectué le paiement";
  doneBtn.style.cssText = 'width:100%;padding:14px;background:#2B1D16;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer';
  doneBtn.addEventListener('click', function() { overlay.remove(); });
  sheet.appendChild(openBtn);
  sheet.appendChild(doneBtn);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}
async function confirmSalle() {
  const btn = document.getElementById('confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }
  try {
    // Garantir l'authentification + forcer refresh du token
    const { getAuth: _getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const _currentUser = _getAuth().currentUser;
    if (!_currentUser) {
      State.uid = await authWithRetry();
    } else {
      await _currentUser.getIdToken(true);
      State.uid = _currentUser.uid;
    }
    if (!State.uid) throw new Error('Authentification impossible. Vérifiez votre connexion.');
    const operateur  = window._selectedPayment || 'especes';
    const cartItems  = getItems();
    const orderId    = await submitSalleOrder(State.tableId, State.uid, operateur, State.sessionId, cartItems);
    clearCart();
    updateCartBadge();
    localStorage.setItem('de_last_order', JSON.stringify({ orderId, operateur, ts: Date.now() }));
    renderView('confirm', { orderId, operateur });
    // Afficher les instructions de paiement Mobile Money
    if (operateur !== 'especes') {
      const totalCart = getItems().reduce(function(s,i){return s+i.price*i.qty;},0);
      showPaymentInstructions(operateur, totalCart, orderId);
    }
  } catch (e) {
    console.error('[confirmSalle] Erreur:', e.message, e.code, e);
    showToast(t('err_order') + ' : ' + (e.message || e.code || ''));
    if (btn) { btn.disabled = false; btn.textContent = t('confirm_salle'); }
  }
}
async function confirmLivraison() {
  const nom     = document.getElementById('liv-nom')?.value.trim();
  const tel     = document.getElementById('liv-tel')?.value.trim();
  const adresse = document.getElementById('liv-adresse')?.value.trim();
  // Zone : lire directement le <select> (robuste même si onZoneChange n'a pas tourné)
  const zoneSel = document.getElementById('liv-zone');
  let zone = window._selectedZone;
  if ((!zone || !zone.id) && zoneSel && zoneSel.value) {
    const opt = zoneSel.options[zoneSel.selectedIndex];
    zone = { id: zoneSel.value, name: opt ? opt.text : '', frais: parseInt((opt && opt.dataset.frais) || '0') };
    window._selectedZone = zone;
  }
  const missing = [];
  if (!nom)          missing.push('votre nom');
  if (!tel)          missing.push('votre numéro de téléphone');
  if (!adresse)      missing.push('votre adresse');
  if (!zone || !zone.id) missing.push('une zone de livraison');
  if (missing.length) {
    showToast('Veuillez renseigner : ' + missing.join(', '));
    return;
  }
  const btn = document.getElementById('confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Traitement…'; }
  try {
    // Garantir l'authentification + forcer refresh du token
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      State.uid = await authWithRetry();
    } else {
      await currentUser.getIdToken(true); // force refresh
      State.uid = currentUser.uid;
    }
    if (!State.uid) throw new Error('Authentification impossible. Vérifiez votre connexion.');
    const cartItems = getItems();
    const orderId = await submitLivraisonOrder({
      nom, telephone: tel, adresse,
      zoneId:          zone.id,
      zoneName:        zone.name || zone.nom,
      fraisLivraison:  zone.frais || 0,
      operateur:       window._selectedPayment || 'wave',
      comment:         document.getElementById('liv-comment')?.value || '',
    }, State.uid, cartItems);
    clearCart();
    updateCartBadge();
    const operateur  = window._selectedPayment || 'wave';
    const sousTotal  = getItems().reduce(function(s,i){return s+i.price*i.qty;},0);
    const totalOrder = sousTotal + (zone.frais || 0);
    localStorage.setItem('de_last_order', JSON.stringify({ orderId, operateur, ts: Date.now() }));
    renderView('confirm', { orderId, operateur });
    // Afficher les instructions de paiement Mobile Money
    if (operateur !== 'especes') {
      showPaymentInstructions(operateur, totalOrder, orderId);
    }
  } catch (e) {
    console.error('[confirmLivraison] Erreur:', e.message, e.code, e);
    showToast(t('err_order') + ' : ' + (e.message || e.code || ''));
    if (btn) { btn.disabled = false; btn.textContent = t('confirm_liv'); }
  }
}
// ─── Confirmation ─────────────────────────────────────────
function renderConfirm(container, orderId, operateur) {
  const isSalle  = State.mode === 'salle';
  const isCash   = operateur === 'especes' || (!operateur && isSalle);
  const isMobile = isSalle && operateur && operateur !== 'especes';
  let icon  = isSalle ? '🍽️' : '🚴';
  let title = isSalle ? 'Commande envoyée !' : t('confirm_title_liv');
  let sub   = isCash ? t('sub_especes') : isMobile ? t('sub_mobile_salle') : t(isSalle ? 'confirm_sub_salle' : 'confirm_sub_liv');
  if (isMobile) icon = operateur === 'wave' ? '🌊' : operateur === 'orange' ? '🟠' : '💛';
  const payBadge = isCash
    ? `<div style="background:#E1F5EE;padding:10px 18px;border-radius:20px;font-size:14px;font-weight:700;color:#0F6E56;margin-top:4px">✓ Paiement en espèces à la table</div>`
    : isMobile
    ? `<div style="background:var(--orange-light);padding:10px 18px;border-radius:20px;font-size:14px;font-weight:700;color:var(--orange-dark);margin-top:4px">📱 ${(operateur||'').toUpperCase()}</div>`
    : '';
  container.innerHTML = `
    <div class="confirm-screen">
      <div class="confirm-icon">${icon}</div>
      <div class="confirm-title">${title}</div>
      <div class="confirm-sub">${sub}</div>
      ${payBadge}
      <div class="order-id">${t('order_number')}${orderId?.slice(-6).toUpperCase()}</div>
      <button class="btn btn-brown" style="margin-top:16px;width:100%;max-width:280px;padding:14px 28px;font-size:16px"
              onclick="window.App.openTrackingModal('${orderId}')">
        📍 Suivre ma commande
      </button>
      <button class="btn btn-secondary" style="margin-top:8px;width:100%;max-width:280px;padding:12px 24px"
              onclick="window.App.navigate('menu')">${t('back_menu')}</button>
    </div>`;
}

// ─── Suivi commande ───────────────────────────────────────
let _trackingUnsub = null;
function renderTracking(container, orderId) {
  if (!orderId) { navigate('menu'); return; }
  // Désabonner le listener précédent si existant
  if (_trackingUnsub) { _trackingUnsub(); _trackingUnsub = null; }
  // Écouter les messages FCM au premier plan (commande prête)
  listenForegroundMessages(payload => {
    const { title, body } = payload.notification || {};
    showToast(title || body || '🍽️ Votre commande est prête !');
  });
  const notifSupported = 'Notification' in window && 'serviceWorker' in navigator;
  container.innerHTML = `
    <div class="tracking-wrap">
      <div class="tracking-header">
        <div class="tracking-id">${t('order_number')} <strong>#${orderId.slice(-6).toUpperCase()}</strong></div>
        <div class="tracking-title" id="tracking-title-dyn">Suivi de commande</div>
        <div class="tracking-sub" id="tracking-sub-dyn">Chargement…</div>
      </div>
      ${notifSupported ? `
      <div id="notif-banner" style="
        background:var(--orange-light);border:1px solid var(--brown-light);
        border-radius:var(--r);padding:12px 14px;margin-bottom:16px;
        display:flex;align-items:center;gap:10px;font-size:13px;color:var(--brown)">
        <span style="font-size:22px">🔔</span>
        <div style="flex:1">
          <div style="font-weight:700">Être notifié quand c'est prêt</div>
          <div style="font-size:11px;color:var(--text-muted)">Recevez une notification dès que votre commande est prête</div>
        </div>
        <button id="notif-btn" class="btn btn-primary btn-sm"
                onclick="window.App.enableNotifications('${orderId}')">
          Activer
        </button>
      </div>` : ''}
      <div id="tracking-content">
        <div class="loading"><div class="spinner"></div></div>
      </div>
      <button class="btn btn-secondary" style="margin-top:16px"
              onclick="window.App.navigate('menu')">${t('back_menu')}</button>
    </div>`;
  _trackingUnsub = listenOrder(orderId, order => {
    updateTrackingView(order);
  });
}
function updateTrackingView(order) {
  const el = document.getElementById('tracking-content');
  if (!el) return;
  const isLiv     = order.type === 'livraison';
  const status    = order.status;
  // Mettre à jour le titre selon statut
  const titleEl = document.getElementById('tracking-title-dyn');
  const subEl   = document.getElementById('tracking-sub-dyn');
  const statusMessages = {
    pending:   { title: '📋 Commande reçue',      sub: 'Votre commande est en attente de traitement', color: '#F59E0B' },
    preparing: { title: '👨‍🍳 En préparation',      sub: 'La cuisine prépare votre commande',           color: '#3B82F6' },
    ready:     { title: '🍽️ Prête à servir !',     sub: 'Votre commande est prête — le serveur arrive', color: '#10B981' },
    done:      { title: '✅ Commande servie',       sub: 'Bon appétit ! Merci de votre visite.',         color: '#065F46' },
  };
  if (isLiv) {
    statusMessages.ready = { title: '📦 Prête pour livraison', sub: 'Votre livreur va partir', color: '#10B981' };
    statusMessages.done  = { title: '🚴 En route !',           sub: 'Votre livreur est en chemin',      color: '#3B82F6' };
  }
  const msg = statusMessages[status] || statusMessages.pending;
  if (titleEl) { titleEl.textContent = msg.title; titleEl.style.color = msg.color; }
  if (subEl)   { subEl.textContent   = msg.sub; }
  const payStatus = order.paymentStatus;
  // Définir les étapes selon le type
  const steps = isLiv ? [
    { key: 'pending',   icon: '📋', label: 'Commande reçue',    sub: 'Votre commande a bien été enregistrée' },
    { key: 'preparing', icon: '👨‍🍳', label: 'En préparation',    sub: 'La cuisine prépare votre commande' },
    { key: 'ready',     icon: '📦', label: 'Prête à livrer',     sub: 'Votre commande est prête' },
    { key: 'done',      icon: '🚴', label: 'En route',           sub: 'Votre livreur est en chemin' },
  ] : [
    { key: 'pending',   icon: '📋', label: 'Commande reçue',    sub: 'Votre commande a bien été enregistrée' },
    { key: 'preparing', icon: '👨‍🍳', label: 'En préparation',    sub: 'La cuisine prépare vos plats' },
    { key: 'ready',     icon: '🍽️', label: 'Prête à servir',     sub: 'Votre commande est prête' },
    { key: 'done',      icon: '✅', label: 'Servie',             sub: 'Bon appétit !' },
  ];
  const ORDER_IDX = { pending: 0, preparing: 1, ready: 2, done: 3 };
  const currentIdx = ORDER_IDX[status] ?? 0;
  // Temps estimé restant
  const etaMap = { pending: isLiv ? '25–35 min' : '20–30 min', preparing: isLiv ? '15–20 min' : '10–15 min', ready: isLiv ? '5–10 min' : 'Quelques instants', done: null };
  const eta = etaMap[status];
  const stepsHtml = steps.map((step, i) => {
    const isDone    = i < currentIdx;
    const isActive  = i === currentIdx;
    const isPending = i > currentIdx;
    const cls = isDone ? 'done' : isActive ? 'active' : 'pending';
    const iconHtml  = isDone
      ? '<span style="font-size:18px;color:#fff">✓</span>'
      : `<span style="font-size:18px">${step.icon}</span>`;
    return `
      <li class="step ${cls}">
        <div class="step-circle">${iconHtml}</div>
        <div class="step-content">
          <div class="step-label">${step.label}</div>
          <div class="step-time">${isDone ? '✓ Terminé' : isActive ? '⏱ En cours…' : step.sub}</div>
        </div>
      </li>`;
  }).join('');
  // Badge paiement
  const payBadge = payStatus === 'paid'
    ? `<div style="background:#E1F5EE;border-radius:var(--r);padding:10px 14px;font-size:13px;font-weight:700;color:#065F46;margin-bottom:12px">✅ Paiement confirmé — ${order.operateur || 'espèces'}</div>`
    : payStatus === 'pending_cash'
    ? `<div style="background:var(--orange-light);border-radius:var(--r);padding:10px 14px;font-size:13px;color:var(--brown);margin-bottom:12px">💵 Paiement en espèces à régler avec le serveur</div>`
    : payStatus === 'awaiting_payment'
    ? `<div style="background:#FAEEDA;border-radius:var(--r);padding:10px 14px;font-size:13px;color:#854F0B;margin-bottom:12px">⏳ En attente de confirmation du paiement ${order.operateur || 'Mobile Money'}</div>`
    : '';
  // Récap articles
  const itemsHtml = (order.items || []).filter(i => !i.isUpsell).map(i =>
    `<div class="tracking-item">
      <span>${i.name} ×${i.qty}</span>
      <span style="font-weight:700;color:var(--orange)">${formatFCFA(i.subtotal || i.price * i.qty)}</span>
    </div>`
  ).join('');
  el.innerHTML = `
    ${eta ? `<div class="eta-badge">
      <div class="eta-icon">⏱</div>
      <div>
        <div class="eta-label">Temps estimé</div>
        <div class="eta-value">${eta}</div>
      </div>
    </div>` : status === 'done' ? `<div class="eta-badge" style="background:#E1F5EE">
      <div class="eta-icon">✅</div>
      <div><div class="eta-label">Statut final</div>
      <div class="eta-value" style="color:#065F46">${isLiv ? 'Livrée !' : 'Bon appétit !'}</div></div>
    </div>` : ''}
    ${payBadge}
    <ul class="stepper">${stepsHtml}</ul>
    <div class="tracking-items">
      <div class="tracking-items-title">Votre commande</div>
      ${itemsHtml}
      <div class="tracking-total">
        <span>Total</span>
        <span>${formatFCFA(order.total)}</span>
      </div>
    </div>`;
}
// ─── Toast ────────────────────────────────────────────────
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}
// ─── Toggle langue ────────────────────────────────────────
function toggleLang() {
  setLang(getLang() === 'fr' ? 'en' : 'fr');
  State.lang = getLang();
  updateHeader();
  // Sur l'accueil (sélecteur d'établissement), y rester au lieu de basculer sur le menu
  if (State.mode !== 'salle' && !RESTO_FROM_URL && !_restoChosen) {
    renderRestoPicker();
  } else {
    renderView(location.hash.replace('#', '') || 'menu');
  }
}
// ─── Exposer l'API globale pour les onclick HTML ──────────
// ─── Traiteur ─────────────────────────────────────────────
function renderTraiteur(container) {
  const eventTypes = [
    { id:'mariage',      label:t('tr_ev_mariage') },
    { id:'bapteme',      label:t('tr_ev_bapteme') },
    { id:'anniversaire', label:t('tr_ev_anniversaire') },
    { id:'entreprise',   label:t('tr_ev_entreprise') },
    { id:'seminaire',    label:t('tr_ev_seminaire') },
    { id:'autre',        label:t('tr_ev_autre') },
  ];
  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border)">
      <button onclick="window.App.backFromTraiteur()"
              style="background:none;border:none;font-size:14px;color:#7A6356;cursor:pointer;font-weight:700">←</button>
      <span style="font-size:15px;font-weight:800;color:#F26522">👨‍🍳 ${t('tab_traiteur')}</span>
    </div>
    <div style="padding:20px 16px;max-width:560px;margin:0 auto">
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:32px;margin-bottom:8px">🎉</div>
        <div style="font-size:20px;font-weight:800;color:var(--brown);margin-bottom:6px">
          ${t('traiteur_title')}
        </div>
        <div style="font-size:14px;color:var(--muted);line-height:1.6">
          ${t('traiteur_subtitle')}
        </div>
      </div>

      <!-- Nos compétences -->
      <div style="margin-bottom:24px">
        <button onclick="window.App.toggleCompetences()" id="competences-toggle"
                style="width:100%;display:flex;align-items:center;justify-content:space-between;
                       padding:14px 16px;background:linear-gradient(135deg,#FFF8F5,#FFF0E8);
                       border:1.5px solid #FDDCCC;border-radius:14px;cursor:pointer">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:20px">✨</span>
            <span style="font-size:14px;font-weight:700;color:#C94E10">${t('comp_title')}</span>
          </div>
          <span id="competences-arrow" style="font-size:13px;color:#C94E10;transition:transform .2s">▼</span>
        </button>

        <div id="competences-panel" style="display:none;margin-top:10px">

          <div style="font-size:11px;color:var(--muted);text-align:center;margin-bottom:12px;
                      padding:0 4px;line-height:1.5">
            ${t('comp_select_hint')}
          </div>

          ${[
            { cat:'cuisine', icon:'🍽️', title:t('comp_cuisine_title'),
              items:[t('comp_cuisine_1'),t('comp_cuisine_2'),t('comp_cuisine_3')] },
            { cat:'composition', icon:'🍴', title:t('comp_composition_title'),
              items:[t('comp_composition_1'),t('comp_composition_2'),t('comp_composition_3'),t('comp_composition_4')] },
            { cat:'service', icon:'🎪', title:t('comp_service_title'),
              items:[t('comp_service_1'),t('comp_service_2'),t('comp_service_3'),t('comp_service_4')] },
            { cat:'logistique', icon:'🛠️', title:t('comp_logistique_title'),
              items:[t('comp_logistique_1'),t('comp_logistique_2'),t('comp_logistique_3'),t('comp_logistique_4')] },
          ].map(cat => `
            <div style="background:#fff;border:1.5px solid var(--border);border-radius:14px;
                        padding:14px 16px;margin-bottom:10px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
                <span style="font-size:17px">${cat.icon}</span>
                <span style="font-size:13px;font-weight:800;color:var(--brown)">${cat.title}</span>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                ${cat.items.map((item, i) => `
                  <div data-cat="${cat.cat}" data-item="${item}"
                       onclick="window.App.toggleCompetenceItem('${cat.cat}','${item.replace(/'/g,"\\'")}',this)"
                       style="display:flex;align-items:center;gap:6px;padding:8px 10px;
                              background:var(--bg);border:1.5px solid transparent;border-radius:9px;
                              font-size:12px;color:var(--brown);cursor:pointer;transition:all .15s">
                    <span class="comp-check" style="width:16px;height:16px;border-radius:50%;
                          border:1.5px solid #C9BBA8;flex-shrink:0;display:flex;align-items:center;
                          justify-content:center;font-size:10px;color:#fff;font-weight:800">
                    </span>
                    <span>${item}</span>
                  </div>`).join('')}
              </div>
            </div>`).join('')}

          <!-- Capacités (informatif) -->
          <div style="background:#fff;border:1.5px solid var(--border);border-radius:14px;
                      padding:14px 16px;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <span style="font-size:17px">📊</span>
              <span style="font-size:13px;font-weight:800;color:var(--brown)">${t('comp_capacite_title')}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              ${[t('comp_capacite_1'),t('comp_capacite_2'),t('comp_capacite_3'),t('comp_capacite_4')].map(item => `
                <div style="display:flex;align-items:center;gap:6px;padding:7px 10px;
                            background:var(--bg);border-radius:9px;font-size:12px;color:var(--brown)">
                  <span style="color:#10B981;font-weight:800;flex-shrink:0">✓</span>
                  <span>${item}</span>
                </div>`).join('')}
            </div>
          </div>

          <div style="text-align:center;padding:6px 4px;font-size:12px;color:var(--muted);line-height:1.6">
            ${t('comp_footer_note')}
          </div>
        </div>
      </div>

      <!-- Type d'événement -->
      <div style="margin-bottom:20px">
        <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;
                    letter-spacing:.05em;margin-bottom:10px">${t('tr_event_type')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="event-type-grid">
          ${eventTypes.map(e => `
            <div data-type="${e.id}"
                 onclick="selectEventType('${e.id}')"
                 style="padding:12px;border:1.5px solid var(--border);border-radius:12px;
                        text-align:center;font-size:13px;cursor:pointer;transition:all .15s;
                        color:var(--brown)">
              ${e.label}
            </div>`).join('')}
        </div>
        <input type="hidden" id="tr-type" value="">
      </div>
      <!-- Infos événement -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div>
          <label style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;
                        letter-spacing:.05em;display:block;margin-bottom:5px">${t('tr_date')}</label>
          <input type="text" id="tr-date" inputmode="numeric"
                 style="width:100%;padding:10px 12px;border:1.5px solid var(--border);
                        border-radius:10px;font-size:14px;outline:none"
                 placeholder="${getLang() === 'en' ? 'MM/DD/YYYY' : 'JJ/MM/AAAA'}"
                 maxlength="10"
                 oninput="window.formatDateInput(this, '${getLang()}')"
                 autocomplete="off">
          <div style="font-size:10px;color:var(--muted);margin-top:3px">
            ${getLang() === 'en' ? 'Format: MM/DD/YYYY' : 'Format : JJ/MM/AAAA'}
          </div>
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;
                        letter-spacing:.05em;display:block;margin-bottom:5px">${t('tr_nb_persons')}</label>
          <input type="number" id="tr-nb" class="form-input" placeholder="Ex: 150" min="10"
                 style="width:100%;padding:10px 12px;border:1.5px solid var(--border);
                        border-radius:10px;font-size:14px;outline:none">
        </div>
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;
                      letter-spacing:.05em;display:block;margin-bottom:5px">${t('tr_lieu')}</label>
        <select id="tr-lieu-zone" class="form-input"
                onchange="window.App.onZoneChange(this.value)"
                style="width:100%;padding:10px 12px;border:1.5px solid var(--border);
                       border-radius:10px;font-size:14px;outline:none;background:#fff">
          <option value="">${t('tr_lieu_loading')}</option>
        </select>
        <div id="tr-zone-frais" style="display:none;margin-top:8px;padding:9px 12px;
             background:#FFF8F5;border:1px solid #FDDCCC;border-radius:9px;font-size:12px;
             color:#C94E10;font-weight:600"></div>
        <input type="text" id="tr-lieu-precision" class="form-input"
               placeholder="${t('tr_lieu_precision_ph')}"
               style="width:100%;padding:9px 12px;border:1.5px solid var(--border);
                      border-radius:10px;font-size:13px;outline:none;margin-top:8px">
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;
                      letter-spacing:.05em;display:block;margin-bottom:5px">${t('tr_besoins')}</label>
        <textarea id="tr-besoins" rows="3" placeholder="${t('tr_besoins_ph')}"
                  style="width:100%;padding:10px 12px;border:1.5px solid var(--border);
                         border-radius:10px;font-size:14px;outline:none;resize:vertical;
                         font-family:inherit;margin-bottom:8px"></textarea>

        <!-- Upload document -->
        <div style="background:linear-gradient(135deg,#FFF8F0,#FFF0E8);border:1.5px solid #FDDCCC;
                    border-radius:12px;padding:14px 16px;margin-bottom:4px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:16px">💡</span>
            <div style="font-size:13px;font-weight:700;color:#C94E10">${t('tr_upload_tip_title')}</div>
            <span style="font-size:11px;color:#F26522;font-weight:600;margin-left:auto;
                         background:#fff;padding:2px 8px;border-radius:10px;border:1px solid #FDDCCC">
              ${t('tr_optional')}
            </span>
          </div>
          <div style="font-size:12px;color:#7A6356;line-height:1.65;margin-bottom:12px">
            ${t('tr_upload_tip_body')}
          </div>
          <div id="tr-upload-zone"
               onclick="document.getElementById('tr-file').click()"
               ondragover="event.preventDefault();this.style.background='#FFF0E8';this.style.borderColor='#F26522'"
               ondragleave="this.style.background='#fff';this.style.borderColor='#E0D4C8'"
               ondrop="window.handleTraiteurDrop(event)"
               style="border:2px dashed #E0D4C8;border-radius:10px;padding:14px;
                      text-align:center;cursor:pointer;transition:all .2s;background:#fff">
            <div style="font-size:24px;margin-bottom:5px">📎</div>
            <div style="font-size:13px;font-weight:600;color:var(--brown)">${t('tr_upload_cta')}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:3px">${t('tr_upload_types')}</div>
          </div>
          <input type="file" id="tr-file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                 style="display:none" onchange="window.handleTraiteurFile(this.files[0])">
        </div>
        <div id="tr-file-info" style="display:none;margin-top:8px;padding:12px 14px;
             background:#F0FDF4;border-radius:10px;border:1px solid #BBF7D0;align-items:center;gap:10px">
          <span style="font-size:22px">📄</span>
          <div style="flex:1;min-width:0">
            <div id="tr-file-name" style="font-size:13px;font-weight:700;color:#166534;
                 overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div>
            <div id="tr-file-size" style="font-size:11px;color:#4D7C60;margin-top:2px"></div>
          </div>
          <button onclick="window.removeTraiteurFile()"
                  style="background:none;border:none;cursor:pointer;font-size:20px;color:#9CA3AF;
                         line-height:1">✕</button>
        </div>
      </div>
      <!-- Contact -->
      <div style="background:#FFF8F5;border-radius:12px;padding:16px;margin-bottom:16px">
        <div style="font-size:13px;font-weight:700;color:var(--brown);margin-bottom:12px">${t('tr_contact_title')}</div>
        <div style="margin-bottom:10px">
          <input type="text" id="tr-nom" class="form-input" placeholder="${t('tr_nom_ph')}"
                 style="width:100%;padding:10px 12px;border:1.5px solid var(--border);
                        border-radius:10px;font-size:14px;outline:none">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <input type="tel" id="tr-tel" class="form-input" placeholder="Téléphone *"
                 style="width:100%;padding:10px 12px;border:1.5px solid var(--border);
                        border-radius:10px;font-size:14px;outline:none">
          <input type="email" id="tr-email" class="form-input" placeholder="${t('tr_email_ph')}"
                 style="width:100%;padding:10px 12px;border:1.5px solid var(--border);
                        border-radius:10px;font-size:14px;outline:none">
        </div>
      </div>
      <div id="tr-err" style="color:#EF4444;font-size:13px;margin-bottom:10px;display:none"></div>
      <button onclick="window.App.submitDevis()"
              style="width:100%;padding:14px;background:#F26522;color:#fff;border:none;
                     border-radius:12px;font-size:15px;font-weight:800;cursor:pointer">${t('tr_send_btn')}</button>
      <div style="text-align:center;margin-top:12px;font-size:12px;color:var(--muted)">
        ${t('tr_footer_note')}
      </div>
    </div>
  `;

  // Charger les zones de livraison existantes (réutilisées pour le traiteur)
  window.App.loadTraiteurZones();
}

// ─── Espace Devis Client ─────────────────────────────────
async function renderDevisClient(container) {
  const params  = new URLSearchParams(window.location.search);
  const devisId = params.get('id');
  const token   = params.get('token');

  if (!devisId || !token) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Lien invalide.</div>';
    return;
  }

  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Chargement…</p></div>';

  try {
    const { doc, getDoc, updateDoc, arrayUnion, serverTimestamp, onSnapshot }
      = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const snap = await getDoc(doc(db, 'devis', devisId));
    if (!snap.exists() || snap.data().token !== token) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:#EF4444">Lien invalide ou expiré.</div>';
      return;
    }

    const d = snap.data();
    const EVENT_LABELS = {
      mariage:'Mariage', bapteme:'Baptême', anniversaire:'Anniversaire',
      entreprise:'Repas entreprise', seminaire:'Séminaire', autre:'Autre événement',
    };
    const dateEv = d.date
      ? new Date(d.date + 'T12:00:00').toLocaleDateString(getLang() === 'en' ? 'en-GB' : 'fr-FR',
          { day:'numeric', month:'long', year:'numeric' })
      : '—';

    const statutColors = {
      nouveau: '#F59E0B', en_cours: '#3B82F6', devis_envoye: '#8B5CF6',
      confirme: '#10B981', annule: '#EF4444',
    };
    const statutLabels = {
      nouveau: 'En attente', en_cours: 'En cours', devis_envoye: 'Devis reçu',
      confirme: 'Confirmé', annule: 'Annulé',
    };
    const sc = statutColors[d.statut] || '#7A6356';
    const sl = statutLabels[d.statut] || d.statut;

    // Build devis lines HTML
    let devisHtml = '';
    if (d.devis?.lignes?.length) {
      const lignes = d.devis.lignes.map(l =>
        '<div style="display:flex;justify-content:space-between;padding:10px 0;'
        + 'border-bottom:1px solid var(--border);font-size:14px">'
        + '<div><div style="font-weight:600;color:var(--brown)">' + l.desc + '</div>'
        + '<div style="font-size:12px;color:var(--muted)">' + l.qty + ' × ' + l.prix.toLocaleString('fr-FR') + ' FCFA</div></div>'
        + '<div style="font-weight:700;color:var(--brown)">' + l.total.toLocaleString('fr-FR') + ' F</div>'
        + '</div>'
      ).join('');

      devisHtml = '<div style="background:#fff;border-radius:14px;padding:20px;margin-bottom:16px;'
        + 'box-shadow:0 2px 12px rgba(43,29,22,.08)">'
        + '<div style="font-size:15px;font-weight:800;color:var(--brown);margin-bottom:14px">📄 Votre devis</div>'
        + lignes
        + '<div style="display:flex;justify-content:space-between;padding:12px 0 4px;font-size:15px;font-weight:800">'
        + '<span>Total</span><span style="color:#F26522">' + d.devis.total.toLocaleString('fr-FR') + ' FCFA</span></div>'
        + '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:var(--muted)">'
        + '<span>Acompte (50%)</span><span style="color:#F26522;font-weight:700">' + d.devis.acompte.toLocaleString('fr-FR') + ' FCFA</span></div>'
        + (d.devis.note ? '<div style="margin-top:12px;padding:10px;background:var(--bg);border-radius:8px;font-size:13px;color:var(--muted)">'
           + d.devis.note + '</div>' : '')
        + '</div>';
    } else {
      devisHtml = '<div style="background:#FFF8F5;border-radius:14px;padding:20px;margin-bottom:16px;text-align:center">'
        + '<div style="font-size:32px;margin-bottom:8px">⏳</div>'
        + '<div style="font-size:14px;color:var(--muted)">Votre devis est en cours de préparation.<br>Revenez bientôt !</div>'
        + '</div>';
    }

    // Action buttons
    let actionHtml = '';
    if (d.statut === 'devis_envoye' && d.devis) {
      actionHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">'
        + '<button onclick="window.App.confirmerDevisClient(\x27' + devisId + '\x27,\x27' + token + '\x27)" '
        + 'style="padding:14px;background:#10B981;color:#fff;border:none;border-radius:12px;'
        + 'font-size:15px;font-weight:800;cursor:pointer">✅ Confirmer</button>'
        + '<button onclick="window.App.annulerDevisClient(\x27' + devisId + '\x27,\x27' + token + '\x27)" '
        + 'style="padding:14px;background:#EF4444;color:#fff;border:none;border-radius:12px;'
        + 'font-size:15px;font-weight:800;cursor:pointer">❌ Annuler</button>'
        + '</div>';
    } else if (d.statut === 'confirme') {
      actionHtml = '<div style="background:#ECFDF5;border-radius:12px;padding:14px;text-align:center;margin-bottom:16px">'
        + '<div style="font-size:20px;margin-bottom:4px">🎉</div>'
        + '<div style="font-weight:700;color:#065F46">Prestation confirmée !</div>'
        + '<div style="font-size:13px;color:#4D7C60;margin-top:4px">Nous vous contacterons pour finaliser les détails.</div>'
        + '</div>'
        + '<div id="devis-paiement-zone"></div>';
    } else if (d.statut === 'annule') {
      actionHtml = '<div style="background:#FEF2F2;border-radius:12px;padding:14px;text-align:center;margin-bottom:16px">'
        + '<div style="font-weight:700;color:#991B1B">Devis annulé</div>'
        + '</div>';
    }

    // Detect WebView (WhatsApp, Facebook, etc.)
    const isWebView = /FBAN|FBAV|Instagram|WhatsApp|wv|WebView/i.test(navigator.userAgent)
      || (navigator.userAgent.includes('Android') && /Version\/\d/.test(navigator.userAgent) && !navigator.userAgent.includes('Chrome'));

    const openInBrowserBanner = isWebView
      ? '<div style="background:#FEF3C7;border-bottom:2px solid #F59E0B;padding:12px 16px;'
        + 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">'
        + '<div>'
        +   '<div style="font-size:13px;font-weight:700;color:#854F0B">Ouvrir dans votre navigateur</div>'
        +   '<div style="font-size:11px;color:#92400E;margin-top:2px">Pour une meilleure expérience</div>'
        + '</div>'
        + '<a href="' + window.location.href + '" target="_system" '
        +   'onclick="window.open(\x27' + window.location.href + '\x27,\x27_blank\x27);return false;" '
        +   'style="padding:8px 14px;background:#F59E0B;color:#fff;border-radius:8px;font-size:13px;'
        +   'font-weight:700;text-decoration:none;white-space:nowrap">🌐 Ouvrir</a>'
        + '</div>'
      : '';

    container.innerHTML = openInBrowserBanner + '<div style="max-width:560px;margin:0 auto;padding:20px 16px">'

      // Header
      + '<div style="margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid var(--border)">'
      + '<div style="font-size:24px;font-weight:800;color:var(--brown)">Votre espace devis</div>'
      + '<div style="font-size:13px;color:var(--muted);margin-top:4px">Délices Étoiles · Resto & Traiteur</div>'
      + '</div>'

      // Résumé demande
      + '<div style="background:#fff;border-radius:14px;padding:16px;margin-bottom:16px;'
      + 'box-shadow:0 2px 12px rgba(43,29,22,.08)">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
      + '<div style="font-size:15px;font-weight:800;color:var(--brown)">' + (d.client?.nom || '') + '</div>'
      + '<span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;'
      + 'background:' + sc + '22;color:' + sc + '">' + sl + '</span>'
      + '</div>'
      + '<div style="font-size:13px;color:var(--muted);line-height:1.8">'
      + '📅 ' + dateEv + '<br>'
      + '🎉 ' + (EVENT_LABELS[d.type] || d.type) + '<br>'
      + '👥 ' + (d.nbPersonnes || '?') + ' personnes<br>'
      + '📍 ' + (d.lieu || '—')
      + '</div>'
      + '</div>'

      // Devis
      + devisHtml

      // Actions
      + actionHtml

      // Bouton PDF
      + (d.devis ? '<button onclick="window.App.downloadDevisPDF(\x27' + devisId + '\x27)" '
        + 'style="width:100%;padding:12px;background:#7C3AED;color:#fff;border:none;'
        + 'border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:16px">'
        + '⬇️ Télécharger le devis PDF</button>' : '')

      // Messagerie
      + '<div style="background:#fff;border-radius:14px;overflow:hidden;'
      + 'box-shadow:0 2px 12px rgba(43,29,22,.08)">'

      // Messagerie header
      + '<div style="background:linear-gradient(135deg,#2B1D16,#4A3020);padding:14px 16px">'
      + '<div style="font-size:15px;font-weight:800;color:#fff;margin-bottom:3px">💬 Messagerie</div>'
      + '<div style="font-size:12px;color:rgba(255,255,255,.65)">Échangez directement avec notre équipe — nous vous répondons sous 24h</div>'
      + '</div>'

      + '<div style="padding:16px">'
      + '<div id="devis-messages" style="min-height:80px;max-height:240px;overflow-y:auto;'
      + 'margin-bottom:12px;display:flex;flex-direction:column;gap:8px"></div>'
      + '<div style="display:flex;gap:8px;align-items:flex-end">'
      + '<textarea id="devis-msg-input" rows="2" '
      + 'placeholder="Posez vos questions, demandez des précisions sur votre devis…" '
      + 'style="flex:1;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;'
      + 'font-size:13px;resize:none;font-family:inherit;outline:none;line-height:1.4"></textarea>'
      + '<button onclick="window.App.sendDevisMessage(\x27' + devisId + '\x27,\x27' + token + '\x27)" '
      + 'style="padding:10px 14px;background:#F26522;color:#fff;border:none;border-radius:10px;'
      + 'font-size:18px;cursor:pointer;flex-shrink:0">➤</button>'
      + '</div>'
      + '</div>'
      + '</div>'

      + '</div>';

    // Listen for messages in real time
    onSnapshot(doc(db, 'devis', devisId), snap2 => {
      if (!snap2.exists()) return;
      const msgs = snap2.data().messages || [];
      const el   = document.getElementById('devis-messages');
      if (!el) return;
      if (!msgs.length) {
        el.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px">Aucun message pour le moment.</div>';
        return;
      }
      el.innerHTML = msgs.map(m => {
        const isAdmin = m.auteur === 'admin';
        return '<div style="display:flex;flex-direction:column;align-items:' + (isAdmin ? 'flex-start' : 'flex-end') + '">'
          + '<div style="max-width:80%;padding:10px 13px;border-radius:14px;font-size:13px;line-height:1.5;'
          + 'background:' + (isAdmin ? '#F5F0EB' : '#F26522') + ';'
          + 'color:' + (isAdmin ? 'var(--brown)' : '#fff') + '">' + m.texte + '</div>'
          + '<div style="font-size:10px;color:var(--muted);margin-top:2px">'
          + (isAdmin ? '⭐ Délices Étoiles' : '👤 Vous') + '</div>'
          + '</div>';
      }).join('');
      el.scrollTop = el.scrollHeight;
    });

    // Zone paiement (uniquement si confirmé)
    if (d.statut === 'confirme' && d.devis) {
      window.App.loadPaiementZone(devisId, token, d);
    }

  } catch(e) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#EF4444">Erreur : ' + e.message + '</div>';
  }
}

// ─── Actions espace devis client ─────────────────────────
window.App = {
  async enableNotifications(orderId) {
    const btn = document.getElementById('notif-btn');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      const token = await requestNotificationPermission(orderId);
      const banner = document.getElementById('notif-banner');
      if (token) {
        State.notifEnabled = true;
        if (banner) banner.innerHTML = '<span style="font-size:18px">✅</span> <span style="font-size:13px;color:var(--brown);font-weight:600">Notifications activées — vous serez notifié quand votre commande est prête.</span>';
      } else {
        if (banner) banner.innerHTML = '<span style="font-size:18px">❌</span> <span style="font-size:13px;color:var(--text-muted)">Notifications refusées ou non supportées sur cet appareil.</span>';
      }
    } catch(e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Activer'; }
    }
  },
  async joinSession(sessionId) {
    State.sessionId = sessionId;
    navigate('menu');
  },
  async newSession() {
    State.sessionId = await createSession(State.tableId, State.uid);
    navigate('menu');
  },
  navigate: (view, data={}) => navigate(view, data),
  // ── Carrousel PDJ ─────────────────────────────────────
  _pdjIdx: 0,
  _pdjTimer: null,
  _pdjTotal: 0,
  pdjInit(total) {
    this._pdjIdx   = 0;
    this._pdjTotal = total;
    if (this._pdjTimer) clearInterval(this._pdjTimer);
    if (total > 1) {
      this._pdjTimer = setInterval(() => this.pdjNext(), 4000);
    }
    // Swipe tactile
    const el = document.getElementById('pdj-carousel');
    if (!el) return;
    let sx = 0;
    el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend',   e => {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) { dx < 0 ? this.pdjNext() : this.pdjPrev(); }
    }, { passive: true });
  },
  pdjGoTo(idx) {
    const track = document.getElementById('pdj-track');
    if (!track) return;
    this._pdjIdx = ((idx % this._pdjTotal) + this._pdjTotal) % this._pdjTotal;
    track.style.transform = `translateX(-${this._pdjIdx * 100}%)`;
    document.querySelectorAll('.pdj-dot').forEach((d, i) =>
      d.classList.toggle('active', i === this._pdjIdx)
    );
    if (this._pdjTimer) { clearInterval(this._pdjTimer); this._pdjTimer = setInterval(() => this.pdjNext(), 4000); }
  },
  pdjNext() { this.pdjGoTo(this._pdjIdx + 1); },
  pdjPrev() { this.pdjGoTo(this._pdjIdx - 1); },
  addPdjToCart(itemId) {
    const item = State.menu.find(m => m.id === itemId);
    if (!item) return;
    addItem(item);
    updateCartBadge();
    showToast('✓ Ajouté au panier');
  },
  openItem, setOption, changeQty, toggleUpsell,
  addToCart, closeModal, setCategory,
  updateQty: doUpdateQty, removeItem: doRemoveItem, goCheckout,
  confirmSalle, confirmLivraison, onZoneChange, selectPayment,
  toggleLang,
};

// ─── Sélecteur d'établissement (portail client, hors QR) ──
let _restoChosen = false;
let _accueilCfg;   // undefined = pas encore chargé ; null = pas de doc ; sinon {actif, slides}

async function renderRestoPicker() {
  const view = document.getElementById('view');
  if (!view) return;
  view.innerHTML = `<div class="loading"><div class="spinner"></div><p>${t('picker_loading')}</p></div>`;

  let lieux = [];
  try {
    lieux = await fetchLieux();
  } catch (e) {
    // Échec de lecture (index en construction, réseau…) → ne pas bloquer le client.
    console.warn('fetchLieux:', e.code || e.message);
    _restoChosen = true;
    return bootApp();
  }

  // Aucun lieu actif → on charge le défaut pour éviter un écran vide.
  if (!lieux.length) {
    _restoChosen = true;
    return bootApp();
  }
  // Un seul lieu actif → inutile de demander, on le sélectionne directement.
  if (lieux.length === 1) {
    return window.App.chooseResto(lieux[0].id);
  }

  const cards = lieux.map(l => {
    const loc = l.commune ? `${l.commune}${l.adresse ? ' · ' + l.adresse : ''}` : '';
    return `
    <div class="resto-pick-card" role="button" tabindex="0"
         onclick="window.App.chooseResto('${l.id}')"
         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.App.chooseResto('${l.id}')}">
      <span class="resto-pick-avatar">🍽️</span>
      <span class="resto-pick-body">
        <span class="resto-pick-name">${l.nom || l.id}</span>
        ${loc ? `<a class="resto-pick-map" href="${lieuMapUrl(l)}" target="_blank" rel="noopener" title="Voir sur Google Maps" onclick="event.stopPropagation()"><span class="resto-pick-maptext">📍 ${loc}</span><span class="resto-pick-maparrow">↗</span></a>` : ''}
      </span>
      <span class="resto-pick-go">→</span>
    </div>`;
  }).join('');

  // Bandeau d'accueil paramétrable (Admin → Carrousel) : doc global config/accueil.
  // - non configuré → images de démonstration par défaut
  // - actif=false → pas de bandeau
  // - actif + images → images chargées
  if (_accueilCfg === undefined) {
    try { _accueilCfg = await fetchAccueilCarousel(); } catch (_) { _accueilCfg = null; }
  }
  const DEMO_IMGS = ['/img/accueil-1.jpg', '/img/accueil-2.jpg', '/img/accueil-3.jpg'];
  let heroImgs;
  if (_accueilCfg) {
    if (_accueilCfg.actif === false) {
      heroImgs = [];
    } else {
      const sl = Array.isArray(_accueilCfg.slides) ? _accueilCfg.slides.slice() : [];
      heroImgs = sl.length
        ? sl.sort((a, b) => (a.ordre || 0) - (b.ordre || 0)).map(s => s.url).filter(Boolean)
        : DEMO_IMGS;
    }
  } else {
    heroImgs = DEMO_IMGS;
  }
  const HERO_GRAD = 'linear-gradient(135deg,rgba(43,29,22,.22),rgba(43,29,22,.55))';
  const heroHTML = heroImgs.map((url, i) =>
    `<div class="resto-hero-slide${i === 0 ? ' active' : ''}" style="background-color:#2B1D16;background-image:${HERO_GRAD},url('${url}')"></div>`
  ).join('');
  const dotsHTML = heroImgs.length > 1
    ? heroImgs.map((_, i) => `<span class="resto-hero-dot${i === 0 ? ' on' : ''}"></span>`).join('')
    : '';
  const heroBlock = heroImgs.length
    ? `<div class="resto-hero" id="resto-hero">${heroHTML}<div class="resto-hero-dots">${dotsHTML}</div></div>`
    : '';

  view.innerHTML = `
    <div class="resto-picker" style="max-width:${lieux.length >= 5 ? 920 : lieux.length >= 3 ? 760 : 600}px">
      ${heroBlock}
      <div class="resto-pick-list">${cards}</div>
      <button class="resto-pick-card resto-pick-traiteur" onclick="window.App.navigate('traiteur')">
        <span class="resto-pick-avatar" style="background:linear-gradient(135deg,#8B5CF6,#6D28D9)">👨‍🍳</span>
        <span class="resto-pick-body">
          <span class="resto-pick-name">${t('picker_traiteur')}</span>
          <span class="resto-pick-commune">${t('traiteur_subtitle')}</span>
        </span>
        <span class="resto-pick-go">→</span>
      </button>
    </div>
    <style>
      .resto-picker{margin:0 auto;padding:18px 16px 40px;text-align:center}
      .resto-pick-traiteur{margin-top:14px}
      .resto-pick-traiteur:hover{border-color:#8B5CF6!important}
      .resto-pick-traiteur:hover .resto-pick-go{color:#8B5CF6}
      .resto-picker-hero{padding:40px 0 28px}
      .resto-hero{position:relative;height:min(26vh,180px);border-radius:20px;overflow:hidden;
        margin:0 0 18px;box-shadow:0 10px 30px rgba(43,29,22,.18)}
      .resto-hero-slide{position:absolute;inset:0;background-size:cover;background-position:center;
        opacity:0;transition:opacity 1.2s ease}
      .resto-hero-slide.active{opacity:1}
      .resto-hero-cap{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:16px 14px 14px;
        text-align:center;background:linear-gradient(to top,rgba(43,29,22,.80),rgba(43,29,22,0))}
      .resto-hero-cap .resto-picker-brand{color:#fff;margin:0;font-size:clamp(20px,6vw,34px);
        line-height:1.05;white-space:nowrap;text-shadow:0 2px 14px rgba(0,0,0,.45)}
      .resto-hero-dots{position:absolute;top:12px;right:12px;z-index:2;display:flex;gap:6px}
      .resto-hero-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.45);
        transition:background .3s}
      .resto-hero-dot.on{background:#fff}
      .resto-picker-brand{font-family:'Great Vibes','Segoe Script',cursive;font-size:46px;
        line-height:1.05;letter-spacing:0;text-transform:none;font-weight:400;color:#F26522;margin-bottom:6px}
      .resto-picker-title{font-size:24px;line-height:1.2;color:var(--brown-dk,#2B1D16);margin:0 0 8px;font-weight:800}
      .resto-picker-sub{font-size:14px;color:var(--brown-md,#7a6a55);margin:0 0 16px}
      .resto-pick-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
      .resto-pick-card{display:flex;align-items:center;gap:14px;width:100%;text-align:left;
        background:#fff;border:1px solid var(--border,#ece3d6);border-radius:16px;padding:16px 18px;
        cursor:pointer;transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease}
      .resto-pick-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(43,29,22,.10);border-color:#F26522}
      .resto-pick-avatar{flex:0 0 auto;width:44px;height:44px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;
        color:#fff;background:linear-gradient(135deg,#F26522,#c84e12)}
      .resto-pick-body{flex:1 1 auto;display:flex;flex-direction:column;min-width:0}
      .resto-pick-name{font-size:16px;font-weight:700;color:#2B1D16}
      .resto-pick-commune{font-size:13px;color:#7a6a55;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .resto-pick-map{display:flex;align-items:center;gap:5px;margin-top:3px;min-width:0;
        font-size:13px;color:#7a6a55;text-decoration:none;width:fit-content;max-width:100%}
      .resto-pick-maptext{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .resto-pick-maparrow{flex:0 0 auto;color:#F26522;font-weight:800;font-size:12px}
      .resto-pick-map:hover{color:#F26522}
      .resto-pick-map:hover .resto-pick-maptext{text-decoration:underline}
      .resto-pick-go{flex:0 0 auto;font-size:20px;font-weight:700;color:#F26522;opacity:.5;transition:opacity .14s,transform .14s}
      .resto-pick-card:hover .resto-pick-go{opacity:1;transform:translateX(3px)}
    </style>`;

  _startHeroCarousel();
}

// Lien Google Maps d'un établissement : son lien enregistré, sinon une recherche par adresse.
function lieuMapUrl(l) {
  if (!l) return '#';
  if (l.mapUrl) return l.mapUrl;
  const q = [l.nom, l.commune, l.adresse].filter(Boolean).join(' ') || 'Abidjan';
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}

// Fondu lent du bandeau d'accueil (nettoie l'intervalle précédent pour éviter les fuites).
function _startHeroCarousel() {
  if (window._heroTimer) { clearInterval(window._heroTimer); window._heroTimer = null; }
  const hero = document.getElementById('resto-hero');
  if (!hero) return;
  const slides = hero.querySelectorAll('.resto-hero-slide');
  const dots   = hero.querySelectorAll('.resto-hero-dot');
  if (slides.length < 2) return;
  let idx = 0;
  window._heroTimer = setInterval(() => {
    if (!document.getElementById('resto-hero')) { clearInterval(window._heroTimer); window._heroTimer = null; return; }
    slides[idx].classList.remove('active');
    if (dots[idx]) dots[idx].classList.remove('on');
    idx = (idx + 1) % slides.length;
    slides[idx].classList.add('active');
    if (dots[idx]) dots[idx].classList.add('on');
  }, 5000);
}

// Revenir au sélecteur d'établissement (hors salle). Le panier d'un autre
// lieu n'étant plus valide (prix/plats différents), on le vide.
window.App.changeResto = function () {
  if (State.mode === 'salle') return;
  clearCart();
  _restoChosen = false;
  State.resto = null;
  updateHeader();   // efface le nom du lieu et le bouton "Changer" du header
  try {
    const u = new URL(window.location.href);
    u.searchParams.delete('resto');
    window.history.replaceState(null, '', u);
  } catch (_) {}
  if (location.hash && location.hash !== '#menu') location.hash = '';
  renderRestoPicker();
};

// Retour depuis le Traiteur : vers le menu si un établissement est choisi, sinon vers l'accueil.
window.App.backFromTraiteur = function () {
  if (State.resto) { window.App.navigate('menu'); }
  else { _restoChosen = false; renderRestoPicker(); }
};

// Clic sur le logo : en livraison → retour au sélecteur ; en salle → accueil menu.
window.App.logoClick = function () {
  if (State.mode === 'salle') { window.App.navigate('menu'); return; }
  window.App.changeResto();
};

// Choix d'un lieu → fixe le lieu, le reflète dans l'URL (persistance au
// refresh), puis lance le chargement.
window.App.chooseResto = function (id) {
  if (!id) return;
  setRestoId(id);
  _restoChosen = true;
  try {
    const u = new URL(window.location.href);
    u.searchParams.set('resto', id);
    window.history.replaceState(null, '', u);
  } catch (_) {}
  bootApp();
};

window.App.loadTraiteurZones = async function() {
  try {
    const { fetchZones } = await import('./db.js');
    const zones = await fetchZones();
    window._trZones = zones;
    const sel = document.getElementById('tr-lieu-zone');
    if (!sel) return;
    sel.innerHTML = '<option value="">' + t('tr_lieu_select') + '</option>'
      + zones.map(z =>
          '<option value="' + z.id + '">' + z.name
          + (z.region ? ' (' + z.region + ')' : '') + '</option>'
        ).join('');
  } catch(e) {
    console.error('Erreur chargement zones:', e);
    const sel = document.getElementById('tr-lieu-zone');
    if (sel) sel.innerHTML = '<option value="">' + t('tr_lieu_error') + '</option>';
  }
};


window.App.onZoneChange = function(zoneId) {
  const box = document.getElementById('tr-zone-frais');
  if (!box) return;
  if (!zoneId) { box.style.display = 'none'; return; }
  const zone = (window._trZones || []).find(z => z.id === zoneId);
  if (!zone) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.textContent = '🚚 ' + t('tr_zone_frais_label') + ' : '
    + (zone.frais || 0).toLocaleString('fr-FR') + ' FCFA';
};



window.App.loadPaiementZone = async function(devisId, token, d) {
  try {
    const { doc, getDoc, collection, query, orderBy, onSnapshot }
      = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const cfgSnap = await getDoc(doc(db, 'config', 'restaurant'));
    const cfg = cfgSnap.exists() ? cfgSnap.data() : {};
    const managerPhone = (cfg.managerPhone || '0759731911').replace(/[^0-9]/g, '');

    const total   = d.devis?.total   || 0;
    const acompte = d.devis?.acompte || 0;

    const q = query(collection(db, 'devis', devisId, 'paiements'), orderBy('declaredAt', 'desc'));

    window.App._unsubPaiements && window.App._unsubPaiements();
    window.App._unsubPaiements = onSnapshot(q, snap => {
      const paiements = snap.docs.map(s => ({ id: s.id, ...s.data() }));
      const payeConfirme = paiements
        .filter(p => p.statut === 'confirme')
        .reduce((s, p) => s + (p.montant || 0), 0);
      const resteAPayer = Math.max(0, total - payeConfirme);

      const zone = document.getElementById('devis-paiement-zone');
      if (!zone) return;

      const histoHtml = paiements.length
        ? '<div style="margin-top:12px">'
          + paiements.map(p => {
              const isConfirme = p.statut === 'confirme';
              const dateStr = p.declaredAt ? new Date(p.declaredAt).toLocaleDateString('fr-FR', { day:'numeric', month:'short' }) : '';
              return '<div style="display:flex;justify-content:space-between;align-items:center;'
                + 'padding:8px 10px;background:#fff;border-radius:8px;margin-bottom:6px;font-size:12px">'
                + '<div>' + (p.moyen || '') + ' · ' + (p.montant || 0).toLocaleString('fr-FR') + ' FCFA · ' + dateStr + '</div>'
                + '<span style="padding:2px 8px;border-radius:10px;font-weight:700;'
                + 'background:' + (isConfirme ? '#ECFDF5' : '#FEF3C7') + ';'
                + 'color:' + (isConfirme ? '#065F46' : '#854F0B') + '">'
                + (isConfirme ? '✓ Confirmé' : '⏳ En attente') + '</span>'
                + '</div>';
            }).join('')
          + '</div>'
        : '';

      if (resteAPayer <= 0) {
        zone.innerHTML = '<div style="background:#ECFDF5;border-radius:14px;padding:16px;margin-bottom:16px">'
          + '<div style="font-size:15px;font-weight:800;color:#065F46;margin-bottom:4px">✅ Paiement complet</div>'
          + '<div style="font-size:13px;color:#4D7C60">Merci ! Votre prestation est entièrement réglée.</div>'
          + histoHtml
          + '</div>';
        return;
      }

      zone.innerHTML = '<div style="background:#fff;border-radius:14px;padding:16px;margin-bottom:16px;'
        + 'box-shadow:0 2px 12px rgba(43,29,22,.08)">'
        + '<div style="font-size:15px;font-weight:800;color:var(--brown);margin-bottom:10px">💰 Paiement</div>'
        + '<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--border)">'
        + '<span style="color:var(--muted)">Total</span><span style="font-weight:700">' + total.toLocaleString('fr-FR') + ' FCFA</span></div>'
        + '<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--border)">'
        + '<span style="color:var(--muted)">Déjà payé</span><span style="font-weight:700;color:#10B981">' + payeConfirme.toLocaleString('fr-FR') + ' FCFA</span></div>'
        + '<div style="display:flex;justify-content:space-between;font-size:14px;padding:8px 0 12px">'
        + '<span style="font-weight:700">Reste à payer</span><span style="font-weight:800;color:#F26522">' + resteAPayer.toLocaleString('fr-FR') + ' FCFA</span></div>'

        + '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Choisissez votre moyen de paiement :</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">'
        + '<button onclick="window.App.selectMoyenPaiement(\x27wave\x27)" id="pm-wave" '
        +   'style="padding:10px;border:1.5px solid var(--border);border-radius:10px;background:#fff;cursor:pointer;font-size:13px">🌊 Wave</button>'
        + '<button onclick="window.App.selectMoyenPaiement(\x27orange\x27)" id="pm-orange" '
        +   'style="padding:10px;border:1.5px solid var(--border);border-radius:10px;background:#fff;cursor:pointer;font-size:13px">🟠 Orange Money</button>'
        + '<button onclick="window.App.selectMoyenPaiement(\x27mtn\x27)" id="pm-mtn" '
        +   'style="padding:10px;border:1.5px solid var(--border);border-radius:10px;background:#fff;cursor:pointer;font-size:13px">💛 MTN MoMo</button>'
        + '<button onclick="window.App.selectMoyenPaiement(\x27cheque\x27)" id="pm-cheque" '
        +   'style="padding:10px;border:1.5px solid var(--border);border-radius:10px;background:#fff;cursor:pointer;font-size:13px">📝 Chèque</button>'
        + '</div>'

        + '<div id="pm-instructions" style="display:none;background:var(--bg);border-radius:10px;padding:12px;margin-bottom:10px;font-size:12px;color:var(--muted)"></div>'

        + '<div id="pm-declare-form" style="display:none">'
        + '<input type="number" id="pm-montant" placeholder="Montant versé (FCFA)" '
        +   'style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;'
        +   'font-size:14px;margin-bottom:8px;outline:none">'
        + '<button onclick="window.App.declarerPaiement(\x27' + devisId + '\x27,\x27' + token + '\x27)" '
        +   'style="width:100%;padding:12px;background:#F26522;color:#fff;border:none;border-radius:10px;'
        +   'font-size:14px;font-weight:700;cursor:pointer">J\x27ai effectué le paiement</button>'
        + '</div>'

        + histoHtml
        + '</div>';

      window._pmData = { managerPhone, resteAPayer };
    });
  } catch(e) { console.error('Erreur loadPaiementZone:', e); }
};

window.App.selectMoyenPaiement = function(moyen) {
  window._pmSelected = moyen;
  document.querySelectorAll('[id^="pm-"]').forEach(b => {
    if (b.id.startsWith('pm-') && !['pm-instructions','pm-declare-form','pm-montant'].includes(b.id)) {
      b.style.borderColor = (b.id === 'pm-' + moyen) ? '#F26522' : 'var(--border)';
      b.style.background  = (b.id === 'pm-' + moyen) ? '#FFF0E8' : '#fff';
    }
  });

  const instr = document.getElementById('pm-instructions');
  const form  = document.getElementById('pm-declare-form');
  const { managerPhone, resteAPayer } = window._pmData || {};

  const labels = { wave: '🌊 Wave', orange: '🟠 Orange Money', mtn: '💛 MTN MoMo', cheque: '📝 Chèque' };

  if (moyen === 'cheque') {
    instr.innerHTML = '<strong>' + labels[moyen] + '</strong><br>'
      + 'Remettez votre chèque directement à notre établissement, puis déclarez le paiement ci-dessous.';
  } else {
    instr.innerHTML = '<strong>' + labels[moyen] + '</strong><br>'
      + 'Envoyez le montant au numéro marchand : <strong>' + managerPhone + '</strong><br>'
      + 'Puis déclarez votre paiement ci-dessous.';
  }
  instr.style.display = 'block';
  form.style.display = 'block';
  const montantInput = document.getElementById('pm-montant');
  if (montantInput && resteAPayer) montantInput.value = resteAPayer;
};

window.App.declarerPaiement = async function(devisId, token) {
  const moyen = window._pmSelected;
  if (!moyen) { alert('Choisissez un moyen de paiement'); return; }
  const montant = parseFloat(document.getElementById('pm-montant')?.value);
  if (!montant || montant <= 0) { alert('Indiquez un montant valide'); return; }

  const labels = { wave: 'Wave', orange: 'Orange Money', mtn: 'MTN MoMo', cheque: 'Chèque' };

  try {
    const { doc, getDoc, collection, addDoc, serverTimestamp }
      = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await getDoc(doc(db, 'devis', devisId));
    if (!snap.exists() || snap.data().token !== token) { alert('Lien invalide'); return; }

    await addDoc(collection(db, 'devis', devisId, 'paiements'), {
      montant, moyen: labels[moyen] || moyen, type: 'paiement',
      statut: 'declare', declaredAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });
    alert('✅ Paiement déclaré ! Nous le confirmerons dès réception des fonds.');
    document.getElementById('pm-declare-form').style.display = 'none';
    document.getElementById('pm-instructions').style.display = 'none';
  } catch(e) { alert('Erreur : ' + e.message); }
};

window.App.confirmerDevisClient = async function(devisId, token) {
  if (!confirm('Confirmer votre devis ? Un acompte de 50% sera demandé.')) return;
  try {
    const { doc, updateDoc, serverTimestamp }
      = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await (await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')).getDoc(doc(db, 'devis', devisId));
    if (snap.data().token !== token) return;
    await updateDoc(doc(db, 'devis', devisId), {
      statut: 'confirme', confirmedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    renderView('devis-client');
  } catch(e) { alert('Erreur : ' + e.message); }
};


window.App.annulerDevisClient = async function(devisId, token) {
  if (!confirm('Annuler votre devis ?')) return;
  try {
    const { doc, updateDoc, serverTimestamp }
      = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await (await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')).getDoc(doc(db, 'devis', devisId));
    if (snap.data().token !== token) return;
    await updateDoc(doc(db, 'devis', devisId), {
      statut: 'annule', updatedAt: serverTimestamp(),
    });
    renderView('devis-client');
  } catch(e) { alert('Erreur : ' + e.message); }
};


window.App.sendDevisMessage = async function(devisId, token) {
  const input = document.getElementById('devis-msg-input');
  const texte = input?.value.trim();
  if (!texte) return;
  try {
    const { doc, updateDoc, arrayUnion, serverTimestamp }
      = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await (await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')).getDoc(doc(db, 'devis', devisId));
    if (snap.data().token !== token) return;
    await updateDoc(doc(db, 'devis', devisId), {
      messages: arrayUnion({ auteur: 'client', texte, date: new Date().toISOString() }),
      updatedAt: serverTimestamp(),
    });
    if (input) input.value = '';
  } catch(e) { alert('Erreur : ' + e.message); }
};


window.App.downloadDevisPDF = async function(devisId) {
  const snap = await (await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'))
    .getDoc((await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')).doc(db, 'devis', devisId));
  if (!snap.exists()) return;
  const d = snap.data();
  const EVENT_LABELS = {
    mariage:'Mariage', bapteme:'Baptême', anniversaire:'Anniversaire',
    entreprise:'Repas entreprise', seminaire:'Séminaire', autre:'Autre',
  };

  // Load jsPDF dynamically
  await new Promise((resolve, reject) => {
    if (window.jspdf) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  let y = 20;

  // Header
  pdf.setFillColor(43, 29, 22);
  pdf.rect(0, 0, W, 35, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(20); pdf.setFont('helvetica', 'bold');
  pdf.text('Délices Étoiles', 20, 16);
  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
  pdf.text('Resto & Traiteur — Grand-Bassam, Côte d\'Ivoire', 20, 24);
  pdf.text('DEVIS', W - 20, 16, { align: 'right' });

  y = 50;
  // Client info
  pdf.setTextColor(43, 29, 22);
  pdf.setFontSize(12); pdf.setFont('helvetica', 'bold');
  pdf.text('Adressé à :', 20, y);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11);
  pdf.text(d.client?.nom || '—', 20, y + 7);
  if (d.client?.tel) pdf.text('Tél : ' + d.client.tel, 20, y + 14);
  if (d.client?.email) pdf.text('Email : ' + d.client.email, 20, y + 21);

  // Event info
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
  pdf.text('Événement :', W - 100, y);
  pdf.setFont('helvetica', 'normal');
  const dateEv = d.date ? new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }) : '—';
  pdf.text((EVENT_LABELS[d.type] || d.type) + ' — ' + dateEv, W - 100, y + 7);
  pdf.text(d.nbPersonnes + ' personnes — ' + (d.lieu || ''), W - 100, y + 14);

  y += 35;
  // Divider
  pdf.setDrawColor(242, 101, 34); pdf.setLineWidth(0.5);
  pdf.line(20, y, W - 20, y);

  y += 10;
  // Table header
  pdf.setFillColor(43, 29, 22);
  pdf.rect(20, y - 5, W - 40, 10, 'F');
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
  pdf.text('Description', 25, y + 1);
  pdf.text('Qté', 130, y + 1, { align: 'center' });
  pdf.text('Prix unit.', 155, y + 1, { align: 'right' });
  pdf.text('Total', W - 25, y + 1, { align: 'right' });

  y += 12;
  pdf.setTextColor(43, 29, 22); pdf.setFont('helvetica', 'normal');
  const lines = d.devis?.lignes || [];
  lines.forEach((l, i) => {
    if (i % 2 === 0) { pdf.setFillColor(249, 245, 240); pdf.rect(20, y - 5, W - 40, 8, 'F'); }
    pdf.setFontSize(10);
    pdf.text(l.desc, 25, y);
    pdf.text(String(l.qty), 130, y, { align: 'center' });
    pdf.text(l.prix.toLocaleString('fr-FR') + ' F', 155, y, { align: 'right' });
    pdf.text(l.total.toLocaleString('fr-FR') + ' F', W - 25, y, { align: 'right' });
    y += 9;
  });

  y += 5;
  pdf.setDrawColor(200, 200, 200); pdf.line(20, y, W - 20, y);
  y += 8;
  pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
  pdf.text('Total :', 130, y);
  pdf.setTextColor(242, 101, 34);
  pdf.text((d.devis?.total || 0).toLocaleString('fr-FR') + ' FCFA', W - 25, y, { align: 'right' });
  y += 7;
  pdf.setTextColor(43, 29, 22); pdf.setFont('helvetica', 'normal');
  pdf.text('Acompte (50%) :', 130, y);
  pdf.setTextColor(242, 101, 34);
  pdf.text((d.devis?.acompte || 0).toLocaleString('fr-FR') + ' FCFA', W - 25, y, { align: 'right' });

  if (d.devis?.note) {
    y += 14;
    pdf.setTextColor(43, 29, 22);
    pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
    pdf.text('Conditions :', 20, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(d.devis.note, 20, y + 6, { maxWidth: W - 40 });
  }

  // Footer
  pdf.setFillColor(43, 29, 22);
  pdf.rect(0, 285, W, 12, 'F');
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(9);
  pdf.text('Délices Étoiles · Grand-Bassam, Côte d\'Ivoire · delices-etoiles.web.app', W / 2, 292, { align: 'center' });

  pdf.save('Devis_Delices_Etoiles.pdf');
};




window.formatDateInput = function(input, lang) {
  let val = input.value.replace(/\D/g, ''); // chiffres seulement
  if (val.length > 8) val = val.slice(0, 8);

  if (lang === 'en') {
    // MM/DD/YYYY
    if (val.length >= 3)      val = val.slice(0,2) + '/' + val.slice(2);
    if (val.length >= 6)      val = val.slice(0,5) + '/' + val.slice(5);
  } else {
    // JJ/MM/AAAA
    if (val.length >= 3)      val = val.slice(0,2) + '/' + val.slice(2);
    if (val.length >= 6)      val = val.slice(0,5) + '/' + val.slice(5);
  }
  input.value = val;
};

window.handleTraiteurFile = function(file) {
  if (!file) return;
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    alert('Fichier trop volumineux (max 5 MB)');
    return;
  }
  window._traiteurFile = file;
  const info = document.getElementById('tr-file-info');
  if (info) {
    document.getElementById('tr-file-name').textContent = file.name;
    document.getElementById('tr-file-size').textContent = (file.size / 1024).toFixed(0) + ' KB';
    info.style.display = 'flex';
    // Update upload zone
    const zone = document.getElementById('tr-upload-zone');
    if (zone) zone.style.borderColor = '#22C55E';
  }
};

window.handleTraiteurDrop = function(event) {
  event.preventDefault();
  const zone = document.getElementById('tr-upload-zone');
  if (zone) zone.style.borderColor = 'var(--border)';
  const file = event.dataTransfer?.files?.[0];
  if (file) window.handleTraiteurFile(file);
};

window.removeTraiteurFile = function() {
  window._traiteurFile = null;
  document.getElementById('tr-file').value = '';
  const info = document.getElementById('tr-file-info');
  if (info) info.style.display = 'none';
  const zone = document.getElementById('tr-upload-zone');
  if (zone) zone.style.borderColor = 'var(--border)';
};

window.App.submitDevis = async function() {
  const type    = document.getElementById('tr-type')?.value;
  const dateRaw  = document.getElementById('tr-date')?.value;
  // Convert display format to ISO (YYYY-MM-DD)
  let date = '';
  if (dateRaw) {
    const parts = dateRaw.split('/');
    if (parts.length === 3) {
      if (getLang() === 'en') {
        // MM/DD/YYYY → YYYY-MM-DD
        date = parts[2] + '-' + parts[0].padStart(2,'0') + '-' + parts[1].padStart(2,'0');
      } else {
        // JJ/MM/AAAA → YYYY-MM-DD
        date = parts[2] + '-' + parts[1].padStart(2,'0') + '-' + parts[0].padStart(2,'0');
      }
    }
  }
  const nb      = document.getElementById('tr-nb')?.value;
  const zoneId  = document.getElementById('tr-lieu-zone')?.value;
  const zoneObj = (window._trZones || []).find(z => z.id === zoneId);
  const lieuPrecision = document.getElementById('tr-lieu-precision')?.value.trim();
  const lieu    = zoneObj
    ? zoneObj.name + (lieuPrecision ? ' — ' + lieuPrecision : '')
    : (lieuPrecision || '');
  const besoins = document.getElementById('tr-besoins')?.value.trim();
  const nom     = document.getElementById('tr-nom')?.value.trim();
  const tel     = document.getElementById('tr-tel')?.value.trim();
  const email   = document.getElementById('tr-email')?.value.trim();
  const err     = document.getElementById('tr-err');
  const btn     = document.querySelector('[onclick*="submitDevis"]');
  if (!type)  { err.textContent = "Choisissez un type d'événement"; err.style.display='block'; return; }
  if (!date)  { err.textContent = "Indiquez la date de l'événement"; err.style.display='block'; return; }
  if (!nb)    { err.textContent = 'Indiquez le nombre de personnes'; err.style.display='block'; return; }
  if (!lieu)  { err.textContent = 'Indiquez le lieu'; err.style.display='block'; return; }
  if (!nom)   { err.textContent = 'Indiquez votre nom'; err.style.display='block'; return; }
  if (!tel)   { err.textContent = 'Indiquez votre téléphone'; err.style.display='block'; return; }
  err.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Envoi en cours…';
  try {
    const { addDoc, collection, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    // Upload fichier si présent
    let fichierUrl = null;
    let fichierNom = null;
    if (window._traiteurFile) {
      try {
        // Récupérer l'utilisateur courant
        const currentUser = window._currentUser || auth.currentUser;
        console.log('[Upload] Auth user:', currentUser?.uid, 'isAnon:', currentUser?.isAnonymous);

        // Forcer un refresh du token si besoin
        if (currentUser) await currentUser.getIdToken(true);

        // Convertir le fichier en base64
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(window._traiteurFile);
        });

        // Uploader via Cloud Function avec token explicite
        const idToken = await currentUser.getIdToken(true);
        const cfUrl   = 'https://europe-west1-delices-etoiles.cloudfunctions.net/uploadDevisFile';
        const cfResp  = await fetch(cfUrl, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': 'Bearer ' + idToken,
          },
          body: JSON.stringify({
            data: {
              fileData: base64,
              fileName: window._traiteurFile.name,
              mimeType: window._traiteurFile.type,
            }
          }),
        });
        const cfData = await cfResp.json();
        if (!cfResp.ok) throw new Error(cfData.error?.message || 'Upload échoué');
        fichierUrl = cfData.result?.url;
        fichierNom = cfData.result?.nom;
        console.log('[Upload] Success:', fichierNom);
      } catch(uploadErr) {
        console.warn('[Upload] Ignoré:', uploadErr.message);
        // On continue sans le fichier
      }
    }

    // Générer un token sécurisé unique
    const token = Array.from(crypto.getRandomValues(new Uint8Array(20)))
      .map(b => b.toString(16).padStart(2,'0')).join('');

    const devisRef = await addDoc(collection(db, 'devis'), {
      type, date, nbPersonnes: parseInt(nb), lieu, besoins,
      zoneId:   zoneObj ? zoneObj.id   : null,
      zoneNom:  zoneObj ? zoneObj.name : null,
      zoneFrais: zoneObj ? (zoneObj.frais || 0) : 0,
      fichier: fichierUrl ? { url: fichierUrl, nom: fichierNom } : null,
      client: { nom, tel, email },
      prestationsSouhaitees: window._trSelections || { cuisine: [], composition: [], service: [], logistique: [] },
      statut: 'nouveau',
      token,
      messages: [],
      createdAt: serverTimestamp(),
    });
    const devisId = devisRef.id;
    // Confirmation
    const view = document.getElementById('view');
    if (view) view.innerHTML = `
      <div style="padding:40px 20px;text-align:center;max-width:400px;margin:0 auto">
        <div style="font-size:56px;margin-bottom:16px">🎉</div>
        <div style="font-size:22px;font-weight:800;color:var(--brown);margin-bottom:10px">
          ${t('tr_confirm_title')}
        </div>
        <div style="font-size:14px;color:var(--muted);line-height:1.7;margin-bottom:24px">
          Merci ${nom} ! Nous avons bien reçu votre demande de devis pour votre événement du <strong>${new Date(date + 'T12:00:00').toLocaleDateString(getLang() === 'en' ? 'en-GB' : 'fr-FR',{day:'numeric',month:'long',year:'numeric'})}</strong>.<br><br>
          ${t('tr_confirm_msg1')} <strong>${tel}</strong>.
        </div>
        <!-- Lien espace devis -->
        <div style="background:#FFF8F5;border:1.5px solid #FDDCCC;border-radius:12px;
                    padding:16px;margin-bottom:20px;text-align:left">
          <div style="font-size:13px;font-weight:700;color:#C94E10;margin-bottom:8px">
            🔗 ${t('tr_devis_link_title') || 'Votre espace devis personnel'}
          </div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.5">
            ${t('tr_devis_link_hint') || 'Conservez ce lien pour consulter votre devis, échanger avec nous et le confirmer.'}
          </div>
          <div id="devis-link-box"
               style="background:#fff;border-radius:8px;padding:10px 12px;font-size:11px;
                      color:#7A6356;word-break:break-all;margin-bottom:10px;
                      border:1px solid var(--border)">
            ⏳ Génération…
          </div>
          <button onclick="window.App.copyDevisLink()"
                  style="width:100%;padding:10px;background:#2B1D16;color:#fff;border:none;
                         border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
            📋 ${t('tr_copy_link') || 'Copier le lien'}
          </button>
        </div>

        <button onclick="window.App.navigate('menu')"
                style="width:100%;padding:12px;background:#F26522;color:#fff;border:none;
                       border-radius:10px;font-size:15px;font-weight:700;cursor:pointer">
          ← ${t('tr_back_menu') || 'Retour au menu'}
        </button>
      </div>`;
    // Afficher le lien de l'espace devis
    const devisUrl = window.location.origin + '/devis?id=' + devisId + '&token=' + token;
    window._devisLink = devisUrl;
    const linkBox = document.getElementById('devis-link-box');
    if (linkBox) linkBox.textContent = devisUrl;

  } catch(e) {
    err.textContent = 'Erreur : ' + e.message;
    err.style.display = 'block';
    btn.disabled = false;
    btn.textContent = t('tr_send_btn');
  }
};

window.App.toggleCompetences = function() {
  const panel = document.getElementById('competences-panel');
  const arrow = document.getElementById('competences-arrow');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
};

// État des sélections de prestations souhaitées
window._trSelections = window._trSelections || { cuisine: [], composition: [], service: [], logistique: [] };

window.App.toggleCompetenceItem = function(cat, item, el) {
  if (!window._trSelections[cat]) window._trSelections[cat] = [];
  const arr = window._trSelections[cat];
  const idx = arr.indexOf(item);
  const check = el.querySelector('.comp-check');

  if (idx >= 0) {
    arr.splice(idx, 1);
    el.style.background = 'var(--bg)';
    el.style.borderColor = 'transparent';
    if (check) { check.style.background = 'transparent'; check.style.borderColor = '#C9BBA8'; check.textContent = ''; }
  } else {
    arr.push(item);
    el.style.background = '#FFF0E8';
    el.style.borderColor = '#F26522';
    if (check) { check.style.background = '#F26522'; check.style.borderColor = '#F26522'; check.textContent = '✓'; }
  }
};

window.App.copyDevisLink = function() {
  const link = window._devisLink;
  if (!link) return;
  navigator.clipboard?.writeText(link).then(() => {
    const btn = document.querySelector('[onclick*="copyDevisLink"]');
    if (btn) { btn.textContent = '✅ Lien copié !'; setTimeout(() => btn.textContent = '📋 Copier le lien', 2000); }
  }).catch(() => {
    prompt('Copiez ce lien :', link);
  });
};

window.selectEventType = function(type) {
  document.getElementById('tr-type').value = type;
  document.querySelectorAll('#event-type-grid [data-type]').forEach(el => {
    if (el.dataset.type === type) {
      el.style.borderColor = '#F26522';
      el.style.background  = '#FFF0E8';
      el.style.color       = '#F26522';
    } else {
      el.style.borderColor = 'var(--border)';
      el.style.background  = '';
      el.style.color       = 'var(--brown)';
    }
  });
};



// ─── Modale suivi commande ────────────────────────────────
window.App.openTrackingModal = function(orderId) {
  document.getElementById('tracking-modal')?.remove();
  if (window._trackingModalUnsub) { window._trackingModalUnsub(); window._trackingModalUnsub = null; }
  const STEPS_SALLE = [
    { key:'pending',   icon:'📋', label:'Commande reçue',    color:'#F59E0B' },
    { key:'preparing', icon:'👨‍🍳', label:'En préparation',    color:'#3B82F6' },
    { key:'ready',     icon:'🍽️', label:'Prête à servir',     color:'#10B981' },
    { key:'done',      icon:'✅', label:'Commande servie',    color:'#065F46' },
  ];
  const STEPS_LIV = [
    { key:'pending',    icon:'📋', label:'Commande reçue',        color:'#F59E0B' },
    { key:'preparing',  icon:'👨‍🍳', label:'En préparation',        color:'#3B82F6' },
    { key:'ready',      icon:'📦', label:'Prête pour livraison',   color:'#10B981' },
    { key:'delivering', icon:'🚴', label:'En route vers vous !',   color:'#3B82F6' },
    { key:'done',       icon:'🎉', label:'Livré et payé !',        color:'#065F46' },
  ];
  // Build modal DOM
  const overlay = document.createElement('div');
  overlay.id = 'tracking-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(43,29,22,.75);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px';
  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:#fff;border-radius:20px;width:100%;max-width:480px;max-height:88vh;overflow-y:auto;padding-bottom:24px';
  // Handle bar
  const handle = document.createElement('div');
  handle.style.cssText = 'display:flex;justify-content:center;padding:12px';
  handle.innerHTML = '<div style="width:40px;height:4px;background:#E0D4C8;border-radius:2px"></div>';
  // Header
  const header = document.createElement('div');
  header.style.cssText = 'padding:0 20px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #F0E8E0';
  header.innerHTML = '<div>'
    + '<div style="display:flex;align-items:center;gap:8px">'
    +   '<div style="font-size:18px;font-weight:800;color:#2B1D16">📍 Suivi de commande</div>'
    +   '<div style="width:8px;height:8px;border-radius:50%;background:#10B981;'
    +     'animation:pulse-dot 1.5s infinite" title="Mis à jour en temps réel"></div>'
    + '</div>'
    + '<div style="font-size:13px;color:#7A6356;margin-top:2px">N° ' + orderId.slice(-6).toUpperCase()
    + ' · <span style="color:#10B981;font-size:11px">● En direct</span></div></div>';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = 'background:#F0E8E0;border:none;border-radius:50%;width:32px;height:32px;font-size:18px;cursor:pointer';
  closeBtn.addEventListener('click', function() {
    overlay.remove();
    if (window._trackingModalUnsub) { window._trackingModalUnsub(); window._trackingModalUnsub = null; }
  });
  header.appendChild(closeBtn);
  // Body
  const body = document.createElement('div');
  body.id = 'tracking-modal-body';
  body.style.cssText = 'padding:20px';
  body.innerHTML = '<div style="text-align:center;padding:32px"><p>Chargement…</p></div>';
  sheet.appendChild(handle);
  sheet.appendChild(header);
  sheet.appendChild(body);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  // Close on backdrop click
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      overlay.remove();
      if (window._trackingModalUnsub) { window._trackingModalUnsub(); window._trackingModalUnsub = null; }
    }
  });
  // Listen to order in real time
  window._trackingModalUnsub = listenOrder(orderId, function(order) {
    const status = order.status || 'pending';
    const isLiv  = order.type === 'livraison';
    const steps  = isLiv ? STEPS_LIV : STEPS_SALLE;
    const curIdx = steps.findIndex(function(s) { return s.key === status; });
    const msgs = {
      pending:    'Votre commande a bien été reçue. Elle sera bientôt prise en charge.',
      preparing:  '🔥 La cuisine prépare votre commande avec soin !',
      ready:      isLiv ? '📦 Prête ! Le livreur va partir.' : '🎉 Prête ! Le serveur arrive.',
      delivering: '🚴 Votre livreur est en route. Préparez le paiement à la réception !',
      done:       isLiv ? '🎉 Livré ! Merci et bonne dégustation !' : '✅ Bon appétit ! Merci de votre visite.',
    };
    if (status === 'done') localStorage.removeItem('de_last_order');
    // Build steps HTML
    var stepsHtml = '';
    steps.forEach(function(step, i) {
      var isDone   = i <= curIdx;
      var isActive = i === curIdx;
      stepsHtml += '<div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:20px">'
        + '<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">'
        + '<div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;'
        + 'background:' + (isDone ? step.color + '20' : '#F5F5F5') + ';'
        + 'border:2px solid ' + (isDone ? step.color : '#E0D4C8') + ';'
        + (isActive ? 'box-shadow:0 0 0 4px ' + step.color + '30;' : '') + '">'
        + (isDone ? step.icon : '<span style="color:#C8BFBA">○</span>')
        + '</div>'
        + (i < steps.length - 1 ? '<div style="width:2px;height:20px;background:' + (isDone ? step.color : '#E0D4C8') + ';margin:4px 0"></div>' : '')
        + '</div>'
        + '<div style="padding-top:8px">'
        + '<div style="font-size:15px;font-weight:' + (isActive ? '800' : isDone ? '600' : '400') + ';'
        + 'color:' + (isActive ? step.color : isDone ? '#2B1D16' : '#B0A8A4') + '">' + step.label + '</div>'
        + (isActive ? '<div style="font-size:12px;color:' + step.color + ';margin-top:2px">En cours…</div>' : '')
        + '</div></div>';
    });
    body.innerHTML = '<div style="background:#FFF8F5;border-radius:12px;border-left:4px solid #F26522;padding:14px 16px;margin-bottom:20px">'
      + '<div style="font-size:14px;color:#4A3020">' + (msgs[status] || msgs.pending) + '</div>'
      + '</div>'
      + stepsHtml;
    if (status === 'done') {
      var backBtn = document.createElement('button');
      backBtn.textContent = '← Retour au menu';
      backBtn.style.cssText = 'width:100%;padding:14px;background:#2B1D16;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px';
      backBtn.addEventListener('click', function() {
        overlay.remove();
        if (window._trackingModalUnsub) { window._trackingModalUnsub(); window._trackingModalUnsub = null; }
        window.App.navigate('menu');
      });
      body.appendChild(backBtn);
    }
  });
};

// ─── Démarrer ────────────────────────────────────────────
init();
