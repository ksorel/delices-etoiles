import { notFound } from 'next/navigation';
import { getDish } from './getDish';
import Client from './Client'     // Client Component séparé

export default async function DishPage({
  params,
}: {
  params: Promise<{ id: string; lng: string }>;
}) {
  const { id, lng } = await params;
  const dish = await getDish(id);
  if (!dish) notFound();
  return <Client dish={dish} lng={lng} />;
}
