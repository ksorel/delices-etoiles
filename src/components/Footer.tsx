'use client';

export default function Footer({ txt }: { txt: Record<string, string> }) {
  return (
    <footer className="bg-gray-800 text-gray-200 text-center py-6 px-4">
      <p className="mb-2">{txt.hours}</p>
      <p>{txt.phone} : +225 27 33 73 08 29</p>
      <p>{txt.email} : etoiles.delices@gmail.com</p>
      <p className="text-sm mt-4">© 2025 Délices Étoiles</p>
    </footer>
  );
}