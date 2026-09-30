import { Product } from '../types/product';

export const mockProducts: Product[] = [
  {
    id: 'product-001',
    name: 'Gentle Foaming Cleanser',
    brand: 'Sample Brand',
    category: 'Cleanser',
    concerns: ['acne'],
    description: 'A placeholder product entry for the prototype. Replace with your curated product catalog before release.',
  },
  {
    id: 'product-002',
    name: '2% Salicylic Acid Treatment',
    brand: 'Sample Brand',
    category: 'Treatment',
    concerns: ['acne'],
    description: 'A prototype recommendation representing the type of product the system may suggest from a curated catalog.',
  },
  {
    id: 'product-003',
    name: 'Lightweight Daily Moisturizer',
    brand: 'Sample Brand',
    category: 'Moisturizer',
    concerns: ['acne', 'clear'],
    description: 'A non-comedogenic moisturizer placeholder for testing the recommendation interface.',
  },
];
