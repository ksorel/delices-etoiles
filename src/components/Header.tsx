'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

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

      <button onClick={toggleLang} className="ml-4 bg-white text-amber-700 px-3 py-1 rounded">
        {currentLang.toUpperCase()}
      </button>
    </header>
  );
}