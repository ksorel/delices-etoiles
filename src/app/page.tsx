import { redirect } from 'next/navigation';
import { defaultLanguage } from '@/i18n/settings';

export default function RootPage() {
  redirect(`/${defaultLanguage}`);
}