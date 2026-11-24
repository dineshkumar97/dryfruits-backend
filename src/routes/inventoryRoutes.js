
import express from "express";

import {
    getInventory,
    updateStock,
    adjustStock
} from "../controllers/inventoryController.js";


const router = express.Router();

// All inventory APIs require Admin access


// =====================================
// GET ALL INVENTORY
// =====================================
router.get(
    "/",
    getInventory
);

// =====================================
// UPDATE PRODUCT STOCK
// =====================================
router.put(
    "/:id",
    updateStock
);

// =====================================
// INCREASE / DECREASE STOCK
// =====================================
router.patch(
    "/:id/adjust",
    adjustStock
);

export default router;
