
import mongoose from "mongoose";

const gmailAuthSchema = new mongoose.Schema(
  {
    accountEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    encryptedRefreshToken: {
      type: String,
      required: true
    },
    iv: {
      type: String,
      required: true
    },
    authTag: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

const GmailAuth = mongoose.model("GmailAuth", gmailAuthSchema);

export default GmailAuth;
