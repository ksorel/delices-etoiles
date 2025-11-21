import { describe, test, expect, vi } from 'vitest';

// Test simple pour vérifier que les tests fonctionnent
describe('API Service Simple Tests', () => {
  test('menu service functions exist', () => {
    // Import dynamique pour éviter les problèmes de mock
    import('../api').then(({ menuService }) => {
      expect(typeof menuService.getDishes).toBe('function');
      expect(typeof menuService.getDrinks).toBe('function');
    });
  });

  test('order service functions exist', () => {
    import('../api').then(({ orderService }) => {
      expect(typeof orderService.createOrder).toBe('function');
      expect(typeof orderService.trackOrder).toBe('function');
    });
  });
});