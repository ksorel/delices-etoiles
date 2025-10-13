export async function initI18next(lng: string, ns: string) {
  // 1. charge le JSON brut
  const mod = await import(`../../public/locales/${lng}/${ns}.json`);
  const resources = mod.default ?? mod;

  // 2. mini-helpers
  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = resources;
    for (const k of keys) value = value?.[k];
    return value ?? key;
  };

  return { t };
}