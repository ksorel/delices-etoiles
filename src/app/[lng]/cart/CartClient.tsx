'use client';

import { useCart } from '@/contexts/CartContext';
import { formatXOF } from '@/lib/format';
import { orderSchema, OrderForm } from '@/lib/orderSchema';
import Link from 'next/link';
import { useState } from 'react';

export default function CartClient({ lng }: { lng: string }) {
  const { cart, getTotalPrice, clearCart } = useCart();
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof OrderForm, string>>>({});

  const [form, setForm] = useState<OrderForm>({
    name: '',
    phone: '',
    address: '',
    message: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSend = async () => {
  const res = orderSchema.safeParse(form);
  if (!res.success) {
    const fieldErrors: Partial<Record<keyof OrderForm, string>> = {};
    res.error.issues.forEach((i) => (fieldErrors[i.path[0] as keyof OrderForm] = i.message));
    setErrors(fieldErrors);
    return;
  }
  setErrors({});
  setSending(true);

  // 1. Email
  const emailRes = await fetch('/api/send-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cart, form, total: getTotalPrice() }),
  });
  if (!emailRes.ok) {
    alert("Erreur lors de l'envoi de la commande.");
    setSending(false);
    return;
  }

  // 2. WhatsApp
  const items = cart.map((i) => `${i.name} × ${i.quantity}`).join(', ');
  const msg = `Nouvelle commande %0AClient : ${form.name} %0ATél : ${form.phone} %0AAdresse : ${form.address} %0A%0AProduits : ${items} %0ATotal : ${getTotalPrice()} F CFA`;
  const whatsappURL = `https://wa.me/2250779939254?text=${msg}`;
  //window.open(whatsappURL, '_blank');
  location.href = whatsappURL; // au lieu de window.open(whatsappURL, '_blank');

  setOk(true);
  clearCart();
  setSending(false);
};

  if (cart.length === 0 && !ok) return <PanierVide lng={lng} />;
  if (ok) return <Success lng={lng} />;

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Récapitulatif</h1>

      <ul className="divide-y">
        {cart.map((item) => (
          <li key={item.id} className="flex justify-between py-2">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span>{formatXOF(item.price * item.quantity)}</span>
          </li>
        ))}
      </ul>

      <p className="text-right text-xl font-semibold mt-4">Total : {formatXOF(getTotalPrice())}</p>

      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="mt-6 space-y-4">
        <Input name="name" label="Nom" value={form.name} onChange={handleChange} error={errors.name} />
        <Input name="phone" label="Téléphone" value={form.phone} onChange={handleChange} error={errors.phone} />
        <Input name="address" label="Adresse" value={form.address} onChange={handleChange} error={errors.address} />
        <TextArea name="message" label="Message (facultatif)" value={form.message} onChange={handleChange} error={errors.message} />

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={handleSend}
            disabled={sending}
            className={`py-2 rounded text-white ${
              sending ? 'bg-gray-400' : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {sending ? 'Envoi…' : 'Envoyer par email'}
          </button>

          <a
            href={`https://wa.me/2250779939254?text=${encodeURIComponent(
              `Nouvelle commande\nClient : ${form.name}\nTél : ${form.phone}\nAdresse : ${form.address}\n\nProduits :${cart
                .map((i) => `\n- ${i.name} × ${i.quantity}`)
                .join('')}\n\nTotal : ${getTotalPrice()} F CFA`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 rounded text-white bg-green-600 hover:bg-green-700 text-center"
          >
            Ouvrir WhatsApp
          </a>
        </div>
      </form>
    </main>
  );
}

function Input({ name, label, value, onChange, error }: any) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        name={name}
        value={value}
        onChange={onChange}
        className={`w-full border rounded px-3 py-2 ${error ? 'border-red-500' : 'border-gray-300'}`}
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}

function TextArea({ name, label, value, onChange, error }: any) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={3}
        className={`w-full border rounded px-3 py-2 ${error ? 'border-red-500' : 'border-gray-300'}`}
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}

function PanierVide({ lng }: { lng: string }) {
  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Panier vide</h1>
      <Link href={`/${lng}/menu`} className="text-amber-700 hover:underline">
        ← Retour à la carte
      </Link>
    </main>
  );
}

function Success({ lng }: { lng: string }) {
  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-green-700">Commande envoyée !</h1>
      <p>Nous vous contacterons rapidement.</p>
      <Link href={`/${lng}/menu`} className="text-amber-700 hover:underline">
        ← Retour à la carte
      </Link>
    </main>
  );
}