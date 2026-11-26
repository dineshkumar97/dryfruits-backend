
import mongoose from "mongoose";
import Contact from "../models/Contact.js";
import { sendContactReplyEmail } from "../services/emailService.js";

// ========================================
// CUSTOMER: CREATE CONTACT ENQUIRY
// ========================================
export const createContact = async (req, res, next) => {
  try {
    const { fullName, mobile, email, subject, message } = req.body;

    if (
      !fullName?.trim() ||
      !mobile?.trim() ||
      !email?.trim() ||
      !subject?.trim() ||
      !message?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address"
      });
    }

    const normalizedMobile = mobile.replace(/[\s-]/g, "");

    if (!/^(?:\+91)?[6-9]\d{9}$/.test(normalizedMobile)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid Indian mobile number"
      });
    }

    const contact = await Contact.create({
      fullName: fullName.trim(),
      mobile: normalizedMobile,
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim()
    });

    return res.status(201).json({
      success: true,
      message: "Your message has been submitted successfully",
      data: {
        contactId: contact._id,
        status: contact.status,
        createdAt: contact.createdAt
      }
    });

  } catch (error) {
    next(error);
  }
};


// ========================================
// ADMIN: GET ALL CONTACT ENQUIRIES
// ========================================
export const getAllContacts = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);

    const limit = Math.min(
      Math.max(Number(req.query.limit) || 10, 1),
      100
    );

    const skip = (page - 1) * limit;

    const { status, search } = req.query;

    const filter = {};

    if (status) {
      const validStatuses = [
        "NEW",
        "READ",
        "REPLIED",
        "CLOSED"
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid enquiry status"
        });
      }

      filter.status = status;
    }

    if (search?.trim()) {
      const escapedSearch = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const searchRegex = new RegExp(escapedSearch, "i");

      filter.$or = [
        { fullName: searchRegex },
        { mobile: searchRegex },
        { email: searchRegex },
        { subject: searchRegex }
      ];
    }

    const [contacts, total] = await Promise.all([
      Contact.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Contact.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      message: "Contact enquiries fetched successfully",
      data: contacts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    next(error);
  }
};


// ========================================
// ADMIN: GET CONTACT ENQUIRY BY ID
// ========================================
export const getContactById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact enquiry ID"
      });
    }

    const contact = await Contact.findById(id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact enquiry not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contact enquiry fetched successfully",
      data: contact
    });

  } catch (error) {
    next(error);
  }
};


// ========================================
// ADMIN: UPDATE CONTACT ENQUIRY STATUS
// ========================================
export const updateContactStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact enquiry ID"
      });
    }

    const validStatuses = [
      "NEW",
      "READ",
      "REPLIED",
      "CLOSED"
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Allowed: NEW, READ, REPLIED, CLOSED"
      });
    }

    const contact = await Contact.findByIdAndUpdate(
      id,
      { $set: { status } },
      {
        new: true,
        runValidators: true
      }
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact enquiry not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contact enquiry status updated successfully",
      data: contact
    });

  } catch (error) {
    next(error);
  }
};


// ========================================
// ADMIN: SEND CONTACT REPLY EMAIL
// ========================================
export const sendContactReply = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { replyMessage } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact enquiry ID"
      });
    }

    if (!replyMessage?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reply message is required"
      });
    }

    if (replyMessage.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Reply message cannot exceed 5000 characters"
      });
    }

    const contact = await Contact.findById(id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact enquiry not found"
      });
    }

    // Send email first
    await sendContactReplyEmail({
      name: contact.fullName,
      email: contact.email,
      subject: contact.subject,
      replyMessage: replyMessage.trim()
    });

    // Save reply only after successful email sending
    contact.replies.push({
      message: replyMessage.trim(),
      adminName: req.user?.name || "Admin",
      adminEmail: req.user?.email || "",
      sentAt: new Date()
    });

    contact.status = "REPLIED";

    await contact.save();

    return res.status(200).json({
      success: true,
      message: "Reply sent successfully",
      data: contact
    });

  } catch (error) {
    console.error("Send contact reply error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to send contact reply. Please try again."
    });
  }
};
