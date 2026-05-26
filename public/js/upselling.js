// ════════════════════════════════════════════════════════════
//  upselling.js — Moteur de règles d'upsell
//  Les règles viennent de Firestore /upselling-rules
// ════════════════════════════════════════════════════════════

let _rules = [];
let _menuItems = [];

export function initUpselling(rules, menuItems) {
  _rules = rules;
  _menuItems = menuItems;
}

/**
 * Retourne les suggestions upsell pour un item donné.
 * @param {Object} item - L'item sélectionné
 * @returns {{ accompagnements: Item[], boissons: Item[] }}
 */
export function getUpsells(item) {
  const result = { accompagnements: [], boissons: [] };

  for (const rule of _rules) {
    // La règle s'applique si la catégorie de l'item correspond
    if (rule.triggerCategory !== item.category) continue;

    const targets = rule.itemIds
      .map(id => _menuItems.find(m => m.id === id))
      .filter(m => m && m.available !== false);

    if (rule.type === 'accompagnement') result.accompagnements.push(...targets);
    if (rule.type === 'boisson')        result.boissons.push(...targets);
  }

  return result;
}

/**
 * Vérifie si un item est une boisson (pour afficher l'option glaçons)
 */
export function isBoisson(item) {
  return item?.category === 'boissons';
}

/**
 * Vérifie si la boisson a deux formats (prix différents stockés dans item.formats)
 * Structure attendue: item.formats = { petit: number, grand: number }
 */
// Vérifie si l'item a une option Entier/Demi (plats) ou Petit/Grand (boissons)
export function hasFormats(item) {
  return item.formats && (item.formats.demi != null || item.formats.grand != null);
}

// Retourne le prix effectif selon le format choisi
export function getPrixForFormat(item, format) {
  if (!item.formats) return item.price;
  if (format === 'demi' && item.formats.demi != null) return item.formats.demi;
  if (format === 'grand' && item.formats.grand != null) return item.formats.grand;
  return item.price; // entier ou petit = prix de base
}

// Retourne le label du format selon le type d'item
export function getFormatLabels(item) {
  if (item.formats?.demi != null) return { base: 'Entier', alt: 'Demi', altKey: 'demi' };
  if (item.formats?.grand != null) return { base: 'Petit', alt: 'Grand', altKey: 'grand' };
  return null;
}

// Conservé pour compatibilité
export function getPrixFormat(item, format) {
  if (!hasFormats(item)) return 0;
  const altPrice = getPrixForFormat(item, format);
  return altPrice - item.price;
}
