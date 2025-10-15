import { initI18next } from '@/i18n';
import { languages } from '@/i18n/settings';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import './globals.css';
import { CartProvider } from '@/contexts/CartContext';

export async function generateStaticParams() {
  return languages.map((lng) => ({ lng }));
}

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ lng: string }>;
}) {

  const { lng } = await params;
  const { t } = await initI18next(lng, 'common');

  /* on traduit une fois, on garde les strings */
  const headerNav = {
    home: t('nav.home'),
    menu: t('nav.menu'),
    order: t('nav.order'),
    book: t('nav.book'),
    contact: t('nav.contact'),
  };

  const footerTxt = {
    hours: t('footer.hours'),
    phone: t('footer.phone'),
    email: t('footer.email'),
  };

  console.log('FR nav.home =', t('nav.home'));
  console.log('headerNav object =', headerNav);

  return (
    <CartProvider>
      <html lang={lng} suppressHydrationWarning={true}>
        <body className="flex flex-col min-h-screen">
          <Header nav={headerNav} welcome={t('welcome')} currentLang={lng} />
          <main className="flex-1">{children}</main>
          <Footer txt={footerTxt} />
        </body>
      </html>
    </CartProvider>
  );
}