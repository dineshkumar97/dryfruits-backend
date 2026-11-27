
import express from "express";

import {
  createContact,
  getAllContacts,
  getContactById,
  updateContactStatus,
  sendContactReply
} from "../controllers/contactController.js";

import verifyToken, {
  authorizeRoles
} from "../middleware/verifyToken.js";

const router = express.Router();

// Customer: Create enquiry
router.post("/", createContact);

// Admin: Get all enquiries
router.get(
  "/",
  verifyToken,
  authorizeRoles("ADMIN"),
  getAllContacts
);

// Admin: Get enquiry details
router.get(
  "/:id",
  verifyToken,
  authorizeRoles("ADMIN"),
  getContactById
);

// Admin: Update status
router.patch(
  "/:id/status",
  verifyToken,
  authorizeRoles("ADMIN"),
  updateContactStatus
);

// Admin: Send reply
router.post(
  "/:id/reply",
  verifyToken,
  authorizeRoles("ADMIN"),
  sendContactReply
);

export default router;
