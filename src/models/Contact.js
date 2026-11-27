
import mongoose from "mongoose";

// ========================================
// CONTACT MESSAGE / REPLY SCHEMA
// ========================================

const contactReplySchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ["ADMIN", "CUSTOMER"],
      required: true
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },

    senderName: {
      type: String,
      trim: true,
      default: ""
    },

    senderEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    },

    sentAt: {
      type: Date,
      default: Date.now
    },

    gmailMessageId: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

// ========================================
// CONTACT ENQUIRY SCHEMA
// ========================================

const contactSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    mobile: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },

    status: {
      type: String,
      enum: [
        "NEW",
        "READ",
        "REPLIED",
        "CUSTOMER_REPLIED",
        "CLOSED"
      ],
      default: "NEW"
    },

    replies: {
      type: [contactReplySchema],
      default: []
    },

    gmailThreadId: {
      type: String,
      default: ""
    },

    lastReplyAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const Contact = mongoose.model("Contact", contactSchema);

export default Contact;
