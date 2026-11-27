
import express from "express";

import {
  connectGmail,
  gmailOAuthCallback
} from "../controllers/gmailController.js";

import verifyToken, {
  authorizeRoles
} from "../middleware/verifyToken.js";

const router = express.Router();

// Start Gmail connection (Admin only)
router.get(
  "/connect",
  verifyToken,
  authorizeRoles("ADMIN"),
  connectGmail
);

// Google OAuth callback
// Google redirects here after authorization.
router.get(
  "/oauth/callback",
  gmailOAuthCallback
);

export default router;
