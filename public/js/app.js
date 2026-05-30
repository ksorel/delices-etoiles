// ════════════════════════════════════════════════════════════
//  app.js — Contrôleur principal de la PWA Délices Étoiles
//  SPA vanilla JS avec routage par hash (#menu #cart #checkout)
// ════════════════════════════════════════════════════════════

import { auth, db }                from './config.js';
import { signInAnonymously }       from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { t, initLang, getLang, setLang, itemName, itemDesc } from './i18n.js';
import { fetchMenu, fetchZones, fetchUpsellRules, getOrCreateTable, fetchPlatDuJour, listenOrder,
         createSession, getOpenSessions, updateSessionStatus, getSessionOrders } from './db.js';
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

// ─── État global de l'app ────────────────────────────────
const State = {
  mode:        'livraison',  // 'salle' | 'livraison'
  tableId:     null,
  uid:         null,
  menu:        [],
  zones:       [],
  platDuJour:  null,
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

  // 4. Auth anonyme avec retry (WebViews lents à initialiser Firebase)
  const viewEl = document.getElementById('view');
  if (viewEl) viewEl.querySelector('p') && (viewEl.querySelector('p').textContent = 'Connexion...');
  State.uid = await authWithRetry();
  if (viewEl) viewEl.querySelector('p') && (viewEl.querySelector('p').textContent = 'Chargement du menu...');

  // 5. Charger le menu depuis localStorage d'abord (affichage instantané)
  // Charger les données depuis Firestore
  try {
    const [menu, zones, rules, pdj] = await Promise.all([
      withTimeout(fetchMenu(),        15000),
      withTimeout(fetchZones(),       15000),
      withTimeout(fetchUpsellRules(), 15000),
      withTimeout(fetchPlatDuJour(),  10000).catch(() => null),
    ]);
    State.menu       = menu       || [];
    State.zones      = zones      || [];
    State.platDuJour = pdj;
    initUpselling(rules || [], State.menu);
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

  // 7. UI header
  updateHeader();

  // 8. Rendu initial
  if (State.mode === 'salle' && State.tableId) {
    await initSalleSession();
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
    default:         renderMenu(main);
  }
  window.scrollTo(0, 0);
}

// ─── Header ──────────────────────────────────────────────
function updateHeader() {
  // Badge mode
  const badge = document.getElementById('mode-badge');
  if (badge) {
    badge.textContent = State.mode === 'salle'
      ? `${t('mode_salle')} ${State.tableId}`
      : t('mode_livraison');
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
function renderMenu(container) {
  if (!State.menu.length) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p>${t('loading')}</p></div>`;
    return;
  }

  // Banner
  const bannerText = State.mode === 'salle'
    ? `<span class="mode-badge salle">${t('mode_salle')}</span> ${t('banner_salle')} <strong>${t('banner_table')} ${State.tableId}</strong>`
    : `<span class="mode-badge livraison">${t('mode_livraison')}</span> ${t('banner_livraison')}`;

  // Catégories uniques
  const cats = ['all', ...new Set(State.menu.map(m => m.category))];
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

  // Items filtrés — les articles indisponibles sont masqués côté client
  const availableMenu = State.menu.filter(m => m.available !== false);
  const items = State.activeCategory === 'all'
    ? availableMenu
    : availableMenu.filter(m => m.category === State.activeCategory);

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
  `;

  // Initialiser le carrousel si présent
  const pdj = State.platDuJour;
  if (pdj?.isCarousel && pdj.slides?.length > 1) {
    requestAnimationFrame(() => window.App.pdjInit(pdj.slides.length));
  }
}

// ─── Modal Item ───────────────────────────────────────────
function openItem(itemId) {
  const item = State.menu.find(m => m.id === itemId);
  if (!item) return;

  const upsells  = getUpsells(item);
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
        <div class="payment-options">
          <label class="payment-option selected" id="pay-especes" onclick="window.App.selectPayment('especes')">
            <input type="radio" name="payment" value="especes" checked>
            <span class="payment-logo">💵</span>
            <div>
              <div class="payment-name">Espèces</div>
              <div class="payment-desc">Paiement en liquide à la table</div>
            </div>
          </label>
          <label class="payment-option" id="pay-wave" onclick="window.App.selectPayment('wave')">
            <input type="radio" name="payment" value="wave">
            <span class="payment-logo">🌊</span>
            <div><div class="payment-name">Wave</div><div class="payment-desc">Wave CI · 0759731911</div></div>
          </label>
          <label class="payment-option" id="pay-orange" onclick="window.App.selectPayment('orange')">
            <input type="radio" name="payment" value="orange">
            <span class="payment-logo">🟠</span>
            <div><div class="payment-name">Orange Money</div><div class="payment-desc">Orange Money · 0759731911</div></div>
          </label>
          <label class="payment-option" id="pay-mtn" onclick="window.App.selectPayment('mtn')">
            <input type="radio" name="payment" value="mtn">
            <span class="payment-logo">💛</span>
            <div><div class="payment-name">MTN Mobile Money</div><div class="payment-desc">Paiement MTN MoMo</div></div>
          </label>
        </div>
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
        <select class="form-select" id="liv-zone" onchange="window.App.onZoneChange(this)">
          <option value="">${t('select_zone')}</option>
          ${zonesOptions}
        </select>
      </div>
      <div id="frais-display" style="display:none;padding:10px 14px;background:var(--orange-light);border-radius:var(--r);font-size:13px;color:var(--orange-dark);font-weight:700;margin-top:4px"></div>
    </div>

    <div class="checkout-section" style="margin-top:12px">
      <div class="checkout-section-title">${t('payment_title')}</div>
      <div class="payment-options">
        <label class="payment-option selected" id="pay-wave" onclick="window.App.selectPayment('wave')">
          <input type="radio" name="payment" value="wave" checked>
          <span class="payment-logo">🌊</span>
          <div><div class="payment-name">Wave</div><div class="payment-desc">Wave CI · 0759731911</div></div>
        </label>
        <label class="payment-option" id="pay-orange" onclick="window.App.selectPayment('orange')">
          <input type="radio" name="payment" value="orange">
          <span class="payment-logo">🟠</span>
          <div><div class="payment-name">Orange Money</div><div class="payment-desc">Orange Money · 0759731911</div></div>
        </label>
        <label class="payment-option" id="pay-mtn" onclick="window.App.selectPayment('mtn')">
          <input type="radio" name="payment" value="mtn">
          <span class="payment-logo">💛</span>
          <div><div class="payment-name">MTN Mobile Money</div><div class="payment-desc">Paiement MTN MoMo</div></div>
        </label>
      </div>
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
      <button class="btn btn-primary" id="confirm-btn" onclick="window.App.confirmLivraison()">
        ${t('confirm_liv')} 💳
      </button>
    </div>`;

  window._selectedPayment = 'wave';
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
  ['wave','orange','mtn'].forEach(o => {
    document.getElementById(`pay-${o}`)?.classList.toggle('selected', o === op);
  });
}

async function confirmSalle() {
  const btn = document.getElementById('confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }
  try {
    // Garantir l'authentification avant d'envoyer
    if (!State.uid) {
      State.uid = await authWithRetry();
      if (!State.uid) throw new Error('Authentification impossible. Vérifiez votre connexion.');
    }
    const operateur  = window._selectedPayment || 'especes';
    const cartItems  = getItems();
    const orderId    = await submitSalleOrder(State.tableId, State.uid, operateur, State.sessionId, cartItems);
    clearCart();
    updateCartBadge();
    renderView('confirm', { orderId, operateur });
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
  const zone    = window._selectedZone;

  if (!nom || !tel || !adresse || !zone?.id) {
    showToast(t('err_required')); return;
  }

  const btn = document.getElementById('confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Traitement…'; }

  try {
    // Garantir l'authentification avant d'envoyer
    if (!State.uid) {
      State.uid = await authWithRetry();
      if (!State.uid) throw new Error('Authentification impossible. Vérifiez votre connexion.');
    }
    const cartItems = getItems();
    const orderId = await submitLivraisonOrder({
      nom, telephone: tel, adresse,
      zoneId:          zone.id,
      zoneName:        zone.name || zone.nom,
      fraisLivraison:  zone.frais || 0,
      operateur:       window._selectedPayment || 'wave',
      comment:         document.getElementById('liv-comment')?.value || '',
    }, State.uid, cartItems);

    // TODO: Rediriger vers le gateway Mobile Money ici
    // Ex: window.location.href = getMobileMoneyUrl(window._selectedPayment, total, orderId);

    updateCartBadge();
    renderView('confirm', { orderId, operateur });
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
      <button class="btn btn-brown" style="margin-top:8px;width:auto;padding:12px 28px"
              onclick="window.App.navigate('tracking',{orderId:'${orderId}'})">
        📍 Suivre ma commande
      </button>
      <button class="btn btn-secondary" style="margin-top:8px;width:auto;padding:10px 24px"
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
  renderView(location.hash.replace('#', '') || 'menu');
}

// ─── Exposer l'API globale pour les onclick HTML ──────────
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

// ─── Démarrer ────────────────────────────────────────────
init();
