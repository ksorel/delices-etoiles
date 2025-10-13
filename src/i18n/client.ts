'use client';
import { useTranslation as useT } from 'react-i18next';
export function useTranslation(ns?: string) {
  return useT(ns);
}