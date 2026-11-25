
import Order from '../models/Order.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import UserDetails from '../models/userDetailsModel.js';
import { sendSignupCreatedEmail } from "../services/emailService.js";

// =====================================
// CREATE CUSTOMER ORDER
// =====================================


export const createOrder = async (req, res) => {
  try {
    const {
      customer,
      items,
      subtotal,
      paymentMethod
    } = req.body;

    // 1. Validate customer details
    const name = customer?.name?.trim();
    const mobile = customer?.mobile?.trim();
    const email = customer?.email?.trim().toLowerCase();

    if (
      !name ||
      !mobile ||
      !email ||
      !customer?.address?.trim() ||
      !customer?.city?.trim() ||
      !customer?.pincode?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Name, mobile, email and delivery address are required.'
      });
    }

    // 2. Validate order items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one product.'
      });
    }

    if (!['COD', 'ONLINE'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method.'
      });
    }

    const calculatedSubtotal = items.reduce(
      (total, item) =>
        total + Number(item.price) * Number(item.quantity),
      0
    );

    if (
      !Number.isFinite(Number(subtotal)) ||
      Number(subtotal) !== calculatedSubtotal ||
      items.some(item =>
        !item.productId ||
        !item.name ||
        !item.weight ||
        !Number.isFinite(Number(item.price)) ||
        Number(item.price) < 0 ||
        !Number.isInteger(Number(item.quantity)) ||
        Number(item.quantity) < 1
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order items or subtotal.'
      });
    }

    // 3. Find existing customer by mobile or email
    let user = await UserDetails.findOne({
      $or: [
        { phone: mobile },
        { email }
      ]
    });

    let customerCreated = false;

    if (user) {

      // Prevent linking different customer details
      if (
        user.phone !== mobile ||
        user.email.toLowerCase() !== email
      ) {
        return res.status(409).json({
          success: false,
          message: 'Mobile number or email is already registered with another account.'
        });
      }

      if (user.role !== 'CUSTOMER') {
        return res.status(409).json({
          success: false,
          message: 'This account cannot be used for customer checkout.'
        });
      }

      if (user.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: 'Your customer account is inactive.'
        });
      }

    } else {

      // 4. Generate unique customer ID
      const lastUser = await UserDetails.findOne({
        uniqueUserId: { $regex: /^NNDF\d+$/ }
      }).sort({ uniqueUserId: -1 });

      let uniqueUserId = 'NNDF000001';

      if (lastUser?.uniqueUserId) {
        const lastNumber = parseInt(
          lastUser.uniqueUserId.replace('NNDF', ''),
          10
        );

        uniqueUserId =
          `NNDF${String(lastNumber + 1).padStart(6, '0')}`;
      }

      // 5. Generate password
      // Replace fixed password with a secure account-setup flow
      // before using this in production.
      const hashedPassword = await bcrypt.hash('12345', 10);

      // 6. Create customer account
      user = await UserDetails.create({
        name,
        email,
        phone: mobile,
        password: hashedPassword,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        uniqueUserId
      });

      customerCreated = true;
    }

    // 7. Create order
    const order = await Order.create({
      orderId: `NN${Date.now()}${Math.floor(Math.random() * 1000)}`,
      userId: user._id,
      customer: {
        name,
        mobile,
        email,
        address: customer.address.trim(),
        city: customer.city.trim(),
        pincode: customer.pincode.trim()
      },
      items,
      subtotal: calculatedSubtotal,
      paymentMethod,
      status: 'Confirmed'
    });

    // 8. Send welcome email only for new customers
    if (customerCreated) {
      await sendSignupCreatedEmail({
        name: user.name,
        email: user.email,
        uniqueUserId: user.uniqueUserId
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully.',
      customerCreated,
      customerId: user.uniqueUserId,
      order
    });

  } catch (error) {
    console.error('Create order error:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Customer mobile number or email already exists. Please check your details.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Unable to create order.'
    });
  }
};


// =====================================
// GET ALL ORDERS (ADMIN)
// =====================================

export const getOrders = async (req, res) => {
  console.log('Fetching all orders for admin...');
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      orders
    });

  } catch (error) {
    console.error('Get orders error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch orders.'
    });
  }
};


// =====================================
// GET LOGGED-IN CUSTOMER ORDERS
// =====================================

export const getMyOrders = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Please log in to view your ,lllorders.'
      });
    }

    const orders = await Order.find({
      userId: req.user.id
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      orders
    });

  } catch (error) {
    console.error('Get customer orders error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch your orders.'
    });
  }
};


// =====================================
// GET SINGLE ORDER
// =====================================

export const getOrderById = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Please log in to view tkkkkkhis ossssssssssssrder.'
      });
    }

    const filter = {
      orderId: req.params.orderId
    };

    // Customers can only access their own orders.
    // Admins can access any order.
    if (req.user.role !== 'ADMIN') {
      filter.userId = req.user.id;
    }

    const order = await Order.findOne(filter);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    return res.status(200).json({
      success: true,
      order
    });

  } catch (error) {
    console.error('Get order error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to fetch order.'
    });
  }
};


// =====================================
// UPDATE ORDER STATUS (ADMIN)
// =====================================

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      'Confirmed',
      'Processing',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled'
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status.'
      });
    }

    const order = await Order.findOneAndUpdate(
      { orderId: req.params.orderId },
      { status },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully.',
      order
    });

  } catch (error) {
    console.error('Update order status error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to update order status.'
    });
  }
};
