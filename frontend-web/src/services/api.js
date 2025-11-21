import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

// Créer l'instance axios correctement
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const menuService = {
  getDishes: async () => {
    const response = await api.get('/menu/dishes');
    return response.data;
  },
  getDrinks: async () => {
    const response = await api.get('/menu/drinks');
    return response.data;
  },
  getCategories: async () => {
    const response = await api.get('/menu/categories');
    return response.data;
  }
};

export const orderService = {
  createOrder: async (orderData) => {
    const response = await api.post('/orders', orderData);
    return response.data;
  },
  trackOrder: async (trackingCode) => {
    const response = await api.get(`/orders/track/${trackingCode}`);
    return response.data;
  }
};

export default api;