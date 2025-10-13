export const languages = ['fr', 'en'] as const;
export const defaultLanguage = 'fr' as const;

export function dir(lng: string) {
  return lng === 'ar' ? 'rtl' : 'ltr';
}