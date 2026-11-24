
import express from "express";

import {
    createCategory,
    getCategories,
    getActiveCategories,
    updateCategory,
    deleteCategory
} from "../controllers/categoryController.js";

// import {
//     verifyTokens,
//     authorizeRoles
// } from "../middleware/verifyToken.js"

const router = express.Router();

// =====================================
// CUSTOMER - GET ACTIVE CATEGORIES
// =====================================
router.get("/all",getActiveCategories);


// =====================================
// ADMIN - GET ALL CATEGORIES
// =====================================
router.get("/admin",getCategories);


// =====================================
// ADMIN - CREATE CATEGORY
// =====================================
router.post("/create",createCategory);


// =====================================
// ADMIN - UPDATE CATEGORY
// =====================================
router.put("/update/:id",updateCategory);


// =====================================
// ADMIN - DELETE CATEGORY
// =====================================
router.delete("/delete/:id",deleteCategory);

export default router;
