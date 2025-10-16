export function formatXOF(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
  }).format(amount);
}

export function formatPrice(amount: number, locale: 'fr' | 'en') {
  const currency = locale === 'fr' ? 'XOF' : 'XOF'; // même devise
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}