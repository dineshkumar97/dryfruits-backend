
import mongoose from "mongoose";
import Product from "../models/Product.js";

// =====================================
// GET INVENTORY - ADMIN
// =====================================
export const getInventory = async (req, res, next) => {

    try {

        const products = await Product.find()
            .sort({
                updatedAt: -1
            });

        const totalProducts = products.length;

        const totalStock = products.reduce(
            (total, product) => total + product.stock,
            0
        );

        const lowStockProducts = products.filter(
            product => product.stock > 0 && product.stock <= 5
        );

        const outOfStockProducts = products.filter(
            product => product.stock === 0
        );

        return res.status(200).json({

            message: "Inventory fetched successfully.",

            summary: {
                totalProducts,
                totalStock,
                lowStockCount: lowStockProducts.length,
                outOfStockCount: outOfStockProducts.length
            },

            data: products

        });

    } catch (error) {

        next(error);

    }

};


// =====================================
// UPDATE PRODUCT STOCK
// =====================================
export const updateStock = async (req, res, next) => {

    try {

        const { id } = req.params;
        const { stock } = req.body;

        // Validate Product ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid product ID."
            });
        }

        // Validate Stock
        const availableStock = Number(stock);

        if (
            stock === undefined ||
            stock === null ||
            !Number.isFinite(availableStock) ||
            availableStock < 0
        ) {
            return res.status(400).json({
                message: "Please provide a valid stock quantity."
            });
        }

        // Update Stock
        const product = await Product.findByIdAndUpdate(
            id,
            {
                $set: {
                    stock: availableStock
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!product) {
            return res.status(404).json({
                message: "Product not found."
            });
        }

        return res.status(200).json({

            message: "Inventory updated successfully.",

            data: product

        });

    } catch (error) {

        next(error);

    }

};


// =====================================
// ADJUST PRODUCT STOCK
// =====================================
export const adjustStock = async (req, res, next) => {

    try {

        const { id } = req.params;

        const {
            quantity,
            operation
        } = req.body;

        // Validate Product ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid product ID."
            });
        }

        // Validate Quantity
        const adjustmentQuantity = Number(quantity);

        if (
            quantity === undefined ||
            !Number.isFinite(adjustmentQuantity) ||
            adjustmentQuantity <= 0
        ) {
            return res.status(400).json({
                message: "Please provide a valid adjustment quantity."
            });
        }

        // Validate Operation
        if (!["INCREASE", "DECREASE"].includes(operation)) {
            return res.status(400).json({
                message: "Operation must be INCREASE or DECREASE."
            });
        }

        // Atomic Stock Adjustment
        const filter = {
            _id: id
        };

        const change = operation === "INCREASE"
            ? adjustmentQuantity
            : -adjustmentQuantity;

        if (operation === "DECREASE") {
            filter.stock = {
                $gte: adjustmentQuantity
            };
        }

        const product = await Product.findOneAndUpdate(
            filter,
            {
                $inc: {
                    stock: change
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!product) {

            const existingProduct = await Product.findById(id);

            if (!existingProduct) {
                return res.status(404).json({
                    message: "Product not found."
                });
            }

            return res.status(400).json({
                message: "Insufficient stock available for this adjustment."
            });

        }

        return res.status(200).json({

            message: "Stock adjusted successfully.",

            data: product

        });

    } catch (error) {

        next(error);

    }

};
