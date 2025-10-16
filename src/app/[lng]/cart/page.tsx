import CartClient from "./CartClient";

export default async function CartPage({
  params,
}: {
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  return <CartClient lng={lng} />;
}