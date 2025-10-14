export interface Category {
  _id?: string;
  name: { fr: string; en: string };
  order: number;
}

export interface Dish {
  _id?: string;
  name: { fr: string; en: string };
  price: { full: number; half?: number };
  category: string; // id of category
  spicy?: boolean;
  vegetarian?: boolean;
  allergens?: string[];
  available: boolean;
}