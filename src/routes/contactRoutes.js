
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

// Customer API
router.post("/", createContact);

// Admin APIs
router.get(
  "/",
  verifyToken,
  authorizeRoles("ADMIN"),
  getAllContacts
);

router.get(
  "/:id",
  verifyToken,
  authorizeRoles("ADMIN"),
  getContactById
);

router.patch(
  "/:id/status",
  verifyToken,
  authorizeRoles("ADMIN"),
  updateContactStatus
);

// Admin: Send email reply
router.post(
  "/:id/reply",
  verifyToken,
  authorizeRoles("ADMIN"),
  sendContactReply
);

export default router;
