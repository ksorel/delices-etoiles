// src/app/api/send-order/route.ts
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', // ou autre
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER, // ton email
    pass: process.env.SMTP_PASS, // mot de passe ou app-password
  },
});

export async function POST(req: NextRequest) {
  const body = await req.json(); // { cart, form, total }
  const { cart, form, total } = body;

  const items = cart
    .map((i: any) => `${i.name} × ${i.quantity} : ${i.price * i.quantity} F`)
    .join('\n');

  const mail = {
    from: `"Délices Étoiles" <${process.env.SMTP_USER}>`,
    to: process.env.RECIPIENT_EMAIL, // email du restaurant
    subject: `Nouvelle commande – ${form.name}`,
    text: `
Nom : ${form.name}
Téléphone : ${form.phone}
Adresse : ${form.address}
Message : ${form.message || '—'}

Produits :
${items}

Total : ${total} F CFA
    `,
  };

  try {
    await transporter.sendMail(mail);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Erreur envoi' }, { status: 500 });
  }
}