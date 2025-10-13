import { initI18next } from '@/i18n';
import { languages } from '@/i18n/settings';

export async function generateStaticParams() {
  return languages.map((lng) => ({ lng }));
}

export default async function Home({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params;
  const { t } = await initI18next(lng, 'common');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-amber-100 text-center px-4">
      <h1 className="text-4xl md:text-5xl font-extrabold text-amber-700">{t('welcome')}</h1>
      <p className="mt-3 text-base md:text-lg text-gray-700">{t('tagline')}</p>
    </main>
  );
}