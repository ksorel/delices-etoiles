// backend/src/routes/orders.js
import express from 'express';
import {
  createOrder,
  getOrder,
  getUserOrders,
  updateOrderStatus,
  trackOrder
} from '../controllers/orderController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Routes protégées pour les clients
router.post('/', authenticateToken, createOrder);
router.get('/user', authenticateToken, getUserOrders);
router.get('/:id', authenticateToken, getOrder);

// Routes pour le staff/admin
router.put('/:id/status', authenticateToken, requireRole(['admin', 'staff']), updateOrderStatus);

// Route publique pour le suivi
router.get('/track/:tracking_code', trackOrder);

export default router;