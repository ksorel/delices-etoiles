// ════════════════════════════════════════════════════════════
//  cart.js — Gestion du panier (state + localStorage)
// ════════════════════════════════════════════════════════════

const STORAGE_KEY = 'de_cart';

let _items = [];

// ─── Initialisation ──────────────────────────────────────
export function initCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _items = raw ? JSON.parse(raw) : [];
  } catch {
    _items = [];
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_items));
}

// ─── Lecture ─────────────────────────────────────────────
export function getItems()  { return [..._items]; }
export function getCount()  { return _items.reduce((s, i) => s + i.qty, 0); }
export function getTotal()  { return _items.reduce((s, i) => s + i.price * i.qty, 0); }
export function isEmpty()   { return _items.length === 0; }

// ─── Ajout d'un item (avec options et upsells) ────────────
export function addItem(item, opts = {}) {
  /*
    item = { id, name_fr, name_en, price, category, imageUrl }
    opts = {
      qty:     number (défaut 1),
      glace:   boolean (pour boissons),
      format:  'petit' | 'grand',
      prixFormat: number (delta prix si grand),
      comment: string,
      upsells: [{ id, name_fr, price }],
    }
  */
  const qty = opts.qty || 1;
  const prixFinal = item.price + (opts.prixFormat || 0);

  _items.push({
    uid:      crypto.randomUUID(),   // clé unique par ligne panier
    id:       item.id,
    name_fr:  item.name_fr,
    name_en:  item.name_en || item.name_fr,
    price:    prixFinal,
    category: item.category,
    imageUrl: item.imageUrl || null,
    qty,
    glace:    opts.glace ?? null,
    format:   opts.format || null,
    comment:  (opts.comment || '').slice(0, 100),
    upsells:  opts.upsells || [],
  });

  persist();
}

// ─── Modification quantité ────────────────────────────────
export function updateQty(uid, delta) {
  const idx = _items.findIndex(i => i.uid === uid);
  if (idx === -1) return;
  _items[idx].qty = Math.max(0, _items[idx].qty + delta);
  if (_items[idx].qty === 0) _items.splice(idx, 1);
  persist();
}

// ─── Suppression ─────────────────────────────────────────
export function removeItem(uid) {
  _items = _items.filter(i => i.uid !== uid);
  persist();
}

// ─── Vider le panier ─────────────────────────────────────
export function clearCart() {
  _items = [];
  persist();
}

// ─── Sérialisation pour Firestore ────────────────────────
export function serializeItems(lang = 'fr') {
  return _items.flatMap(item => {
    const base = {
      id:       item.id,
      name:     lang === 'en' ? item.name_en : item.name_fr,
      price:    item.price,
      qty:      item.qty,
      subtotal: item.price * item.qty,
      glace:    item.glace,
      format:   item.format,
      comment:  item.comment,
    };
    const lines = [base];

    // Upsells → lignes séparées dans la commande
    for (const u of item.upsells || []) {
      lines.push({
        id:      u.id,
        name:    lang === 'en' ? (u.name_en || u.name_fr) : u.name_fr,
        price:   u.price,
        qty:     item.qty,
        subtotal: u.price * item.qty,
        parentId: item.id,
        isUpsell: true,
      });
    }
    return lines;
  });
}
