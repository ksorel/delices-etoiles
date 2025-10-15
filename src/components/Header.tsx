'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';

export default function Header({
  welcome,
  nav,
  currentLang,
}: {
  welcome: string;
  nav: Record<string, string>;
  currentLang: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { getTotalItems } = useCart();
  const total = getTotalItems();

  const toggleLang = () => {
    const newLang = currentLang === 'fr' ? 'en' : 'fr';
    router.push(pathname.replace(`/${currentLang}`, `/${newLang}`));
  };

  return (
    <header className="w-full bg-amber-700 text-white px-6 py-4 flex justify-between items-center">
      <Link href={`/${currentLang}`} className="text-xl font-bold">
        {welcome}
      </Link>

      <nav className="hidden md:flex gap-4">
        <Link href={`/${currentLang}`}>{nav.home}</Link>
        <Link href={`/${currentLang}/menu`}>{nav.menu}</Link>
        <Link href={`/${currentLang}/order`}>{nav.order}</Link>
        <Link href={`/${currentLang}/reservation`}>{nav.book}</Link>
        <Link href={`/${currentLang}/contact`}>{nav.contact}</Link>
      </nav>

      <div className="flex items-center gap-3">
        {/* PANIER */}
        <Link href={`/${currentLang}/cart`} className="relative">
          <span className="text-2xl">🛒</span>
          {total > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
              {total}
            </span>
          )}
        </Link>

        {/* LANGUE */}
        <button
          onClick={toggleLang}
          className="bg-white text-amber-700 px-3 py-1 rounded"
        >
          {currentLang.toUpperCase()}
        </button>
      </div>
    </header>
  );
}