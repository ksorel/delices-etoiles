import Link from 'next/link';
import { initI18next } from '@/i18n';
import { languages } from '@/i18n/settings';

export async function generateStaticParams() {
  return languages.map((l) => ({ lng: l }));
}

export default async function MenuPage({ params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params;
  const { t } = await initI18next(lng, 'common');

  const res = await fetch(`${process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'}/api/menu`, {
    cache: 'no-store',
  });
  const data: { categories: any[]; dishes: any[] } = await res.json();

  return (
    <main className="p-6 bg-amber-50 min-h-screen">
      <h1 className="text-3xl font-bold text-amber-700 mb-6">{t('menu')}</h1>

      {data.categories.map((cat) => (
        <section key={cat._id} className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800">{cat.name[lng]}</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {data.dishes
              .filter((d) => d.category === cat._id.toString())
              .map((d) => (
                <Link
                  key={d._id}
                  href={`/${lng}/menu/${d.id}`}
                  className="block bg-white rounded p-4 shadow hover:shadow-lg transition"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{d.name[lng]}</span>
                    <span className="text-amber-700 font-semibold">
                      {d.price.full} F
                      {d.price.half && ` / ${d.price.half} F (demi)`}
                    </span>
                  </div>
                  <div className="mt-1 space-x-2">
                    {d.spicy && <span className="text-xs text-red-600">🌶️ Épicé</span>}
                    {d.vegetarian && <span className="text-xs text-green-600">🌿 Végé</span>}
                  </div>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </main>
  );
}