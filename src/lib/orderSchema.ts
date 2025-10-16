import { z } from 'zod';

export const orderSchema = z.object({
  name: z.string().min(2, 'Nom trop court'),
  phone: z.string().regex(/^\+?[0-9]{8,15}$/, 'Téléphone invalide'),
  address: z.string().min(5, 'Adresse trop courte'),
  message: z.string().max(300, '300 caractères max').optional(),
});
export type OrderForm = z.infer<typeof orderSchema>;