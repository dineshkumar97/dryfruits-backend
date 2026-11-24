
import mongoose from "mongoose";
import Category from "../models/Category.js";

// =====================================
// CREATE CATEGORY
// =====================================
export const createCategory = async (req, res, next) => {

    try {

        const {
            name,
            description,
            image,
            active
        } = req.body;

        // Validate Required Fields
        if (!name || !name.trim()) {
            return res.status(400).json({
                message: "Category name is required."
            });
        }

        const cleanName = name.trim();

        // Check Existing Category
        const existingCategory = await Category.findOne({
            name: {
                $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
                $options: "i"
            }
        });

        if (existingCategory) {
            return res.status(409).json({
                message: "Category already exists."
            });
        }

        // Create Category
        const newCategory = new Category({

            name: cleanName,
            description: description || "",
            image: image || "",
            active: active ?? true

        });

        await newCategory.save();

        return res.status(201).json({

            message: "Category created successfully.",
            data: newCategory

        });

    } catch (error) {

        if (error.code === 11000) {
            return res.status(409).json({
                message: "Category already exists."
            });
        }

        next(error);

    }

};


// =====================================
// GET ALL CATEGORIES - ADMIN
// =====================================
export const getCategories = async (req, res, next) => {

    try {

        const categories = await Category.find()
            .sort({
                createdAt: -1
            });

        return res.status(200).json({

            message: "Categories fetched successfully.",
            data: categories

        });

    } catch (error) {

        next(error);

    }

};


// =====================================
// GET ACTIVE CATEGORIES - CUSTOMER
// =====================================
export const getActiveCategories = async (req, res, next) => {

    try {

        const categories = await Category.find({
            active: true
        })
            .sort({
                createdAt: -1
            });

        return res.status(200).json({

            message: "Active categories fetched successfully.",
            data: categories

        });

    } catch (error) {

        next(error);

    }

};


// =====================================
// UPDATE CATEGORY
// =====================================
export const updateCategory = async (req, res, next) => {

    try {

        const { id } = req.params;

        const {
            name,
            description,
            image,
            active
        } = req.body;

        // Validate MongoDB ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid category ID."
            });
        }

        const updateData = {};

        if (name !== undefined) {

            const cleanName = String(name).trim();

            if (!cleanName) {
                return res.status(400).json({
                    message: "Category name cannot be empty."
                });
            }

            updateData.name = cleanName;

        }

        if (description !== undefined) {
            updateData.description = description;
        }

        if (image !== undefined) {
            updateData.image = image;
        }

        if (active !== undefined) {
            updateData.active = active;
        }

        // Update Category
        const category = await Category.findByIdAndUpdate(
            id,
            {
                $set: updateData
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!category) {
            return res.status(404).json({
                message: "Category not found."
            });
        }

        return res.status(200).json({

            message: "Category updated successfully.",
            data: category

        });

    } catch (error) {

        if (error.code === 11000) {
            return res.status(409).json({
                message: "Category name already exists."
            });
        }

        next(error);

    }

};


// =====================================
// DELETE CATEGORY
// =====================================
export const deleteCategory = async (req, res, next) => {

    try {

        const { id } = req.params;

        // Validate MongoDB ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid category ID."
            });
        }

        const category = await Category.findByIdAndDelete(id);

        if (!category) {
            return res.status(404).json({
                message: "Category not found."
            });
        }

        return res.status(200).json({

            message: "Category deleted successfully."

        });

    } catch (error) {

        next(error);

    }

};
