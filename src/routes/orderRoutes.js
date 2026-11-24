import express from 'express';

import {
  createOrder,
  getOrders,
  getMyOrders,
  updateOrderStatus,
  getOrderById,

} from '../controllers/orderController.js';

import verifyToken, {
  authorizeRoles
} from '../middleware/verifyToken.js';
const router = express.Router();

// Customer: Place order without login
router.post('/', createOrder);

// Admin: Get all orders
router.get('/admin',getOrders);

// Customer: Get logged-in customer's orders
router.get('/my-orders',verifyToken, getMyOrders);

// Admin: Update order status
router.put(
  '/:orderId/status',
  updateOrderStatus
);

// Customer: View order using order ID and mobile verification
router.get('/:orderId',verifyToken, getOrderById);

export default router;