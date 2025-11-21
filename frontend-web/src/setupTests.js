import '@testing-library/jest-dom';

// Mock minimal pour éviter les surcharges
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(), 
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

// Désactiver les console.warn pour les warnings React
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes?.('ReactDOMTestUtils.act')) {
    return; // Ignorer les warnings act
  }
  originalWarn(...args);
};