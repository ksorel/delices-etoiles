type Dish = {
  id: string;
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  price: { full: number; half?: number };
  image: string;
  category: string;
};

export async function getDish(id: string): Promise<Dish | null> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/dishes/${id}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}