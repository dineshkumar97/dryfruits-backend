
import express from "express";

import {
    createProduct,
    getProducts,
    getAdminProducts,
    getProductById,
    updateProduct,
    deleteProduct
} from "../controllers/productController.js";


const router = express.Router();

// =====================================
// CUSTOMER - GET ACTIVE PRODUCTS
// =====================================
router.get(
    "/",
    getProducts
);

// =====================================
// ADMIN - GET ALL PRODUCTS
// =====================================
router.get(
    "/admin",
    getAdminProducts
);

// =====================================
// CUSTOMER - GET SINGLE PRODUCT
// =====================================
router.get(
    "/:id",
    getProductById
);

// =====================================
// ADMIN - CREATE PRODUCT
// =====================================
router.post(
    "/",
   
    createProduct
);

// =====================================
// ADMIN - UPDATE PRODUCT
// =====================================
router.put(
    "/:id",
   
    updateProduct
);

// =====================================
// ADMIN - DELETE PRODUCT
// =====================================
router.delete(
    "/:id",
   
    deleteProduct
);

export default router;
