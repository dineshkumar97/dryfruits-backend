
import Order from '../models/Order.js';
import bcrypt from 'bcryptjs';
import UserDetails from '../models/userDetailsModel.js';
import { sendSignupCreatedEmail } from "../services/emailService.js";
import mongoose from 'mongoose';
import Product from '../models/Product.js'; // Adjust path to your Product model
// =====================================
// CREATE CUSTOMER ORDER
// =====================================


export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();

  let customerCreated = false;
  let user;
  let order;

  try {
    await session.withTransaction(async () => {

      const {
        customer,
        items,
        subtotal,
        paymentMethod
      } = req.body;

      // 1. Validate customer details
      const name = customer?.name?.trim();
      const mobile = customer?.mobile?.trim();
      const email = customer?.email?.trim().toLowerCase() || '';

      const address = customer?.address?.trim();
      const city = customer?.city?.trim();
      const pincode = customer?.pincode?.trim();

      if (
        !name ||
        !mobile ||
        !/^[6-9][0-9]{9}$/.test(mobile) ||
        !address ||
        !city ||
        !/^[0-9]{6}$/.test(pincode)
      ) {
        const error = new Error(
          'Please provide valid customer and delivery details.'
        );
        error.statusCode = 400;
        throw error;
      }

      // 2. Validate order items
      if (!Array.isArray(items) || items.length === 0) {
        const error = new Error(
          'Order must contain at least one product.'
        );
        error.statusCode = 400;
        throw error;
      }

      if (!['COD', 'ONLINE'].includes(paymentMethod)) {
        const error = new Error('Invalid payment method.');
        error.statusCode = 400;
        throw error;
      }

      // 3. Validate item structure
      const invalidItems = items.some(item =>
        !mongoose.isValidObjectId(item.productId) ||
        !Number.isInteger(Number(item.quantity)) ||
        Number(item.quantity) < 1
      );

      if (invalidItems) {
        const error = new Error('Invalid product or quantity.');
        error.statusCode = 400;
        throw error;
      }

      // 4. Combine quantities for duplicate product IDs
      const productQuantities = new Map();

      for (const item of items) {
        const productId = String(item.productId);

        productQuantities.set(
          productId,
          (productQuantities.get(productId) || 0) +
          Number(item.quantity)
        );
      }

      // 5. Check and deduct product stock
      const productMap = new Map();

      for (const [productId, quantity] of productQuantities) {

        const product = await Product.findOneAndUpdate(
          {
            _id: productId,
            active: true,
            stock: { $gte: quantity }
          },
          {
            $inc: { stock: -quantity }
          },
          {
            new: true,
            session
          }
        );

        if (!product) {
          const existingProduct = await Product.findById(productId)
            .session(session);

          const error = new Error(
            !existingProduct
              ? 'One of the products was not found.'
              : !existingProduct.active
                ? `${existingProduct.name} is currently unavailable.`
                : `Insufficient stock for ${existingProduct.name} (${existingProduct.weight}). Available stock: ${existingProduct.stock}.`
          );

          error.statusCode = 400;
          throw error;
        }

        productMap.set(productId, product);
      }

      // 6. Build order items using database product details
      const orderItems = items.map(item => {
        const product = productMap.get(String(item.productId));

        if (
          product.weight !== item.weight
        ) {
          const error = new Error(
            `Invalid product weight for ${product.name}.`
          );
          error.statusCode = 400;
          throw error;
        }

        return {
          productId: String(product._id),
          name: product.name,
          image: product.image || '',
          weight: product.weight,
          price: product.price,
          oldPrice: product.oldPrice,
          quantity: Number(item.quantity)
        };
      });

      // 7. Calculate subtotal using database prices
      const calculatedSubtotal = orderItems.reduce(
        (total, item) =>
          total + item.price * item.quantity,
        0
      );

      if (
        !Number.isFinite(Number(subtotal)) ||
        Number(subtotal) !== calculatedSubtotal
      ) {
        const error = new Error(
          'Product prices have changed. Please refresh your cart and try again.'
        );
        error.statusCode = 400;
        throw error;
      }

      // 8. Find customer using MOBILE ONLY
      user = await UserDetails.findOne({
        phone: mobile
      }).session(session);

      customerCreated = false;

      if (user) {

        if (user.role !== 'CUSTOMER') {
          const error = new Error(
            'This mobile number cannot be used for customer checkout.'
          );
          error.statusCode = 409;
          throw error;
        }

        if (user.status !== 'ACTIVE') {
          const error = new Error(
            'Your customer account is inactive.'
          );
          error.statusCode = 403;
          throw error;
        }

        user.name = name;

        if (email) {
          user.email = email;
        }

        await user.save({ session });

      } else {

        // 9. Generate unique customer ID
        const lastUser = await UserDetails.findOne({
          uniqueUserId: { $regex: /^NNDF\d+$/ }
        })
          .sort({ uniqueUserId: -1 })
          .session(session);

        let uniqueUserId = 'NNDF000001';

        if (lastUser?.uniqueUserId) {
          const lastNumber = parseInt(
            lastUser.uniqueUserId.replace('NNDF', ''),
            10
          );

          uniqueUserId =
            `NNDF${String(lastNumber + 1).padStart(6, '0')}`;
        }

        // 10. Generate password
        const hashedPassword = await bcrypt.hash('12345', 10);

        // 11. Create customer
        const createdUsers = await UserDetails.create(
          [{
            name,
            email,
            phone: mobile,
            password: hashedPassword,
            role: 'CUSTOMER',
            status: 'ACTIVE',
            uniqueUserId
          }],
          { session }
        );

        user = createdUsers[0];
        customerCreated = true;
      }

      // 12. Create order
      const createdOrders = await Order.create(
        [{
          orderId: `NN${Date.now()}${Math.floor(Math.random() * 1000)}`,

          userId: user._id,

          customer: {
            name,
            mobile,
            email,
            address,
            city,
            pincode
          },

          items: orderItems,
          subtotal: calculatedSubtotal,
          paymentMethod,
          status: 'Confirmed'
        }],
        { session }
      );

      order = createdOrders[0];

    });

    // Transaction committed successfully

    // 13. Send welcome email after successful order
    if (customerCreated && emailIsValid(order.customer.email)) {
      try {
        await sendSignupCreatedEmail({
          name: user.name,
          email: order.customer.email,
          uniqueUserId: user.uniqueUserId
        });
      } catch (emailError) {
        console.error('Welcome email failed:', emailError);
      }
    }

    const customerDetails = {
      _id: user._id,
      uniqueUserId: user.uniqueUserId,
      name: user.name,
      mobile: user.phone,
      email: user.email || '',
      role: user.role,
      status: user.status,
      address: order.customer.address,
      city: order.customer.city,
      pincode: order.customer.pincode
    };
    // 14. Success response
    return res.status(201).json({
      success: true,
      message: 'Order placed successfully. Stock updated.',
      customerCreated,
      customer: customerDetails,
      order
    });

  } catch (error) {

    console.error('Create order error:', error);

    if (error.code === 11000) {
      const duplicateField = Object.keys(
        error.keyPattern || {}
      )[0];

      return res.status(409).json({
        success: false,
        message: duplicateField === 'email'
          ? 'Email duplicate index exists. Please check your database indexes.'
          : 'Customer mobile number already exists. Please try again.',
        field: duplicateField || 'unknown'
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : 'Unable to create your order.'
    });

  } finally {
    await session.endSession();
  }
};

// Helper: validate optional email
const emailIsValid = (email) =>
  typeof email === 'string' &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);




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
