
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Category from "../models/Category.js";

// =====================================
// CREATE PRODUCT - ADMIN
// =====================================
export const createProduct = async (req, res, next) => {

    try {

        const {
            name,
            category,
            description,
            image,
            weight,
            price,
            oldPrice,
            stock,
            active
        } = req.body;

        // Required Fields
        if (!name || !category || !weight || price === undefined || oldPrice === undefined || stock === undefined) {
            return res.status(400).json({
                message: "Please provide all required product information."
            });
        }

        const cleanName = String(name).trim();
        const cleanCategory = String(category).trim();

        if (cleanName.length < 2) {
            return res.status(400).json({
                message: "Product name must contain at least 2 characters."
            });
        }

        // Validate Category
        const categoryData = await Category.findOne({
            name: {
                $regex: `^${cleanCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
                $options: "i"
            },
            active: true
        });

        if (!categoryData) {
            return res.status(400).json({
                message: "Selected category does not exist or is inactive."
            });
        }

        // Validate Weight
        const allowedWeights = [
            "50g",
            "100g",
            "250g",
            "500g",
            "1kg"
        ];

        if (!allowedWeights.includes(weight)) {
            return res.status(400).json({
                message: "Invalid product weight."
            });
        }

        // Validate Prices
        const sellingPrice = Number(price);
        const originalPrice = Number(oldPrice);
        const availableStock = Number(stock);

        if (
            !Number.isFinite(sellingPrice) ||
            sellingPrice <= 0
        ) {
            return res.status(400).json({
                message: "Selling price must be greater than zero."
            });
        }

        if (
            !Number.isFinite(originalPrice) ||
            originalPrice < sellingPrice
        ) {
            return res.status(400).json({
                message: "Original price must be equal to or greater than selling price."
            });
        }

        // Validate Stock
        if (
            !Number.isFinite(availableStock) ||
            availableStock < 0
        ) {
            return res.status(400).json({
                message: "Stock cannot be negative."
            });
        }

        // Check Duplicate Product
        const escapedName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        const existingProduct = await Product.findOne({
            name: {
                $regex: `^${escapedName}$`,
                $options: "i"
            },
            weight
        });

        if (existingProduct) {
            return res.status(409).json({
                message: "Product with this name and weight already exists."
            });
        }

        // Create Product
        const newProduct = new Product({
            name: cleanName,
            category: categoryData.name,
            description: description || "",
            image: image || "",
            weight,
            price: sellingPrice,
            oldPrice: originalPrice,
            stock: availableStock,
            active: active ?? true
        });

        await newProduct.save();

        return res.status(201).json({
            message: "Product created successfully.",
            data: newProduct
        });

    } catch (error) {

        next(error);

    }

};


// =====================================
// GET ALL PRODUCTS - CUSTOMER
// =====================================
export const getProducts = async (req, res, next) => {

    try {

        const products = await Product.find({
            active: true
        }).sort({
            createdAt: -1
        });

        return res.status(200).json({
            message: "Products fetched successfully.",
            data: products
        });

    } catch (error) {

        next(error);

    }

};

// =====================================
// GET ALL PRODUCTS - ADMIN
// =====================================
export const getAdminProducts = async (req, res, next) => {

    try {

        const products = await Product.find()
            .sort({
                createdAt: -1
            });

        return res.status(200).json({

            message: "Products fetched successfully.",
            data: products

        });

    } catch (error) {

        next(error);

    }

};


// =====================================
// GET SINGLE PRODUCT
// =====================================
export const getProductById = async (req, res, next) => {

    try {

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid product ID."
            });
        }

        const product = await Product.findOne({
            _id: id,
            active: true
        });

        if (!product) {
            return res.status(404).json({
                message: "Product not found or unavailable."
            });
        }

        // Check Category Availability
        const category = await Category.findOne({
            name: product.category,
            active: true
        });

        if (!category) {
            return res.status(404).json({
                message: "Product category is unavailable."
            });
        }

        return res.status(200).json({

            message: "Product fetched successfully.",
            data: product

        });

    } catch (error) {

        next(error);

    }

};


// =====================================
// UPDATE PRODUCT - ADMIN
// =====================================
export const updateProduct = async (req, res, next) => {

    try {

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid product ID."
            });
        }

        const {
            name,
            category,
            description,
            image,
            weight,
            price,
            oldPrice,
            stock,
            active
        } = req.body;

        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({
                message: "Product not found."
            });
        }

        // Validate Category
        if (category !== undefined) {

            const categoryName = String(category).trim();

            const categoryData = await Category.findOne({
                name: {
                    $regex: `^${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
                    $options: "i"
                },
                active: true
            });

            if (!categoryData) {
                return res.status(400).json({
                    message: "Selected category does not exist or is inactive."
                });
            }

            product.category = categoryData.name;

        }

        // Validate Name
        if (name !== undefined) {

            const cleanName = String(name).trim();

            if (cleanName.length < 2) {
                return res.status(400).json({
                    message: "Product name must contain at least 2 characters."
                });
            }

            product.name = cleanName;

        }

        // Validate Weight
        if (weight !== undefined) {

            const allowedWeights = [
                "50g",
                "100g",
                "250g",
                "500g",
                "1kg"
            ];

            if (!allowedWeights.includes(weight)) {
                return res.status(400).json({
                    message: "Invalid product weight."
                });
            }

            product.weight = weight;

        }

        if (description !== undefined) {
            product.description = description;
        }

        if (image !== undefined) {
            product.image = image;
        }

        if (price !== undefined) {
            product.price = Number(price);
        }

        if (oldPrice !== undefined) {
            product.oldPrice = Number(oldPrice);
        }

        if (stock !== undefined) {
            product.stock = Number(stock);
        }

        if (active !== undefined) {
            product.active = active;
        }

        // Validate Price
        if (
            !Number.isFinite(product.price) ||
            product.price <= 0 ||
            !Number.isFinite(product.oldPrice) ||
            product.oldPrice < product.price
        ) {
            return res.status(400).json({
                message: "Invalid selling price or original price."
            });
        }

        // Validate Stock
        if (
            !Number.isFinite(product.stock) ||
            product.stock < 0
        ) {
            return res.status(400).json({
                message: "Stock cannot be negative."
            });
        }

        await product.save();

        return res.status(200).json({

            message: "Product updated successfully.",
            data: product

        });

    } catch (error) {

        next(error);

    }

};


// =====================================
// DELETE PRODUCT - ADMIN
// =====================================
export const deleteProduct = async (req, res, next) => {

    try {

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid product ID."
            });
        }

        const product = await Product.findByIdAndDelete(id);

        if (!product) {
            return res.status(404).json({
                message: "Product not found."
            });
        }

        return res.status(200).json({

            message: "Product deleted successfully."

        });

    } catch (error) {

        next(error);

    }

};
