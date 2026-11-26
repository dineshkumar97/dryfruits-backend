
import mongoose from "mongoose";

const contactReplySchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },

    adminName: {
      type: String,
      trim: true,
      default: "Admin"
    },

    adminEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    },

    sentAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: true
  }
);

const contactSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: 100
    },

    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true
    },

    email: {
      type: String,
      required: [true, "Email address is required"],
      trim: true,
      lowercase: true
    },

    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      maxlength: 150
    },

    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: 2000
    },

    status: {
      type: String,
      enum: ["NEW", "READ", "REPLIED", "CLOSED"],
      default: "NEW"
    },

    // Admin reply history
    replies: {
      type: [contactReplySchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const Contact = mongoose.model("Contact", contactSchema);

export default Contact;
