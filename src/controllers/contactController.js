
import mongoose from "mongoose";
import Contact from "../models/Contact.js";

import {
  sendContactReplyEmail,
  sendContactConfirmationEmail
} from "../services/emailService.js";

// ========================================
// CUSTOMER: CREATE CONTACT ENQUIRY
// ========================================

export const createContact = async (req, res, next) => {
  try {
    const {
      fullName,
      mobile,
      email,
      subject,
      message
    } = req.body;

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
      message: message.trim(),
      status: "NEW"
    });

    // Optional customer confirmation email
    let emailSent = false;

    try {
      await sendContactConfirmationEmail({
        name: contact.fullName,
        email: contact.email,
        subject: contact.subject,
        message: contact.message,
        createdAt: contact.createdAt
      });

      emailSent = true;
    } catch (emailError) {
      console.error(
        "Contact confirmation email error:",
        emailError
      );
    }

    return res.status(201).json({
      success: true,
      message: "Your enquiry has been submitted successfully.",
      data: {
        contactId: contact._id,
        status: contact.status,
        createdAt: contact.createdAt,
        emailSent
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

    const validStatuses = [
      "NEW",
      "READ",
      "REPLIED",
      "CUSTOMER_REPLIED",
      "CLOSED"
    ];

    if (status) {
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
        .sort({ updatedAt: -1 })
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
      "CUSTOMER_REPLIED",
      "CLOSED"
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry status"
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

    // Send email
    await sendContactReplyEmail({
      name: contact.fullName,
      email: contact.email,
      subject: contact.subject,
      replyMessage: replyMessage.trim()
    });

    // Save admin reply
    const replyDate = new Date();

    contact.replies.push({
      sender: "ADMIN",
      message: replyMessage.trim(),
      senderName: req.user?.name || "Admin",
      senderEmail: req.user?.email || "",
      sentAt: replyDate
    });

    contact.status = "REPLIED";
    contact.lastReplyAt = replyDate;

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


// ========================================
// SYSTEM: SAVE CUSTOMER EMAIL REPLY
// ========================================
// Call this only after the incoming email has
// been verified and matched to the correct enquiry.
// Do NOT expose this as a public customer API.

export const saveCustomerEmailReply = async ({
  contactId,
  senderEmail,
  senderName,
  message,
  gmailMessageId
}) => {

  const contact = await Contact.findById(contactId);

  if (!contact) {
    throw new Error("Contact enquiry not found");
  }

  const normalizedSenderEmail = senderEmail
    ?.trim()
    .toLowerCase();

  // Verify the sender matches the original customer
  if (normalizedSenderEmail !== contact.email.toLowerCase()) {
    throw new Error("Customer email does not match enquiry");
  }

  if (!message?.trim()) {
    throw new Error("Customer reply message is empty");
  }

  // Avoid saving the same Gmail message twice
  if (gmailMessageId) {
    const duplicateReply = contact.replies.some(
      reply => reply.gmailMessageId === gmailMessageId
    );

    if (duplicateReply) {
      return contact;
    }
  }

  const replyDate = new Date();

  contact.replies.push({
    sender: "CUSTOMER",
    message: message.trim(),
    senderName: senderName || contact.fullName,
    senderEmail: normalizedSenderEmail,
    sentAt: replyDate,
    gmailMessageId: gmailMessageId || ""
  });

  contact.status = "CUSTOMER_REPLIED";
  contact.lastReplyAt = replyDate;

  await contact.save();

  return contact;
};
