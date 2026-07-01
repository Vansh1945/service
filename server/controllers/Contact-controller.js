const Contact = require('../models/Contact-model');
const { sendMail } = require('../utils/sendmail');

/**
 * @desc    Submit contact form
 * @route   POST /api/contact
 * @access  Public
 */
exports.submitContact = async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Create contact entry
    const contact = new Contact({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : '',
      subject: subject.trim(),
      message: message.trim()
    });

    await contact.save();

    res.status(201).json({
      success: true,
      message: 'Contact form submitted successfully. We will get back to you soon!',
      data: {
        id: contact._id,
        status: contact.status
      }
    });

  } catch (error) {
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }

    global.logger.error(`[ContactController.submitContact] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

/**
 * @desc    Get all contacts for admin
 * @route   GET /api/contact/admin
 * @access  Admin only
 */
exports.getAllContacts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Handle search
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { subject: searchRegex }
      ];
    }

    // Handle date range
    if (req.query.dateRange) {
      const now = new Date();
      let startDate;

      switch (req.query.dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = null;
      }

      if (startDate) {
        filter.createdAt = { $gte: startDate };
      }
    }

    const contacts = await Contact.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('adminReply.repliedBy', 'name email');

    const total = await Contact.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: contacts,
      pagination: {
        currentPage: page,
        totalPages,
        totalContacts: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    global.logger.error(`[ContactController.getAllContacts] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

/**
 * @desc    Get single contact by ID
 * @route   GET /api/contact/:id
 * @access  Admin only
 */
exports.getContactById = async (req, res, next) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('adminReply.repliedBy', 'name email');

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.status(200).json({
      success: true,
      data: contact
    });

  } catch (error) {
    global.logger.error(`[ContactController.getContactById] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

/**
 * @desc    Reply to contact via email
 * @route   POST /api/contact/:id/reply
 * @access  Admin only
 */
exports.replyToContact = async (req, res) => {
  try {
    const { message } = req.body;
    const adminId = req.adminID; // From admin middleware


    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Reply message is required'
      });
    }

    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    if (contact.status === 'REPLIED') {
      return res.status(400).json({
        success: false,
        message: 'This contact has already been replied to'
      });
    }

    // Update contact with reply using updateOne to avoid validation issues
    await Contact.updateOne(
      { _id: req.params.id },
      {
        $set: {
          status: 'REPLIED',
          adminReply: {
            message: message.trim(),
            repliedAt: new Date(),
            repliedBy: adminId
          }
        }
      }
    );

    // Fetch the updated contact
    const updatedContact = await Contact.findById(req.params.id)
      .populate('adminReply.repliedBy', 'name email');

    try {
      await sendMail({
        to: contact.email,
        templateType: 'contactReply',
        variables: {
          name: contact.name,
          subject: contact.subject,
          remark: message.trim(),
          reason: contact.message,
          email: contact.email
        }
      });
    } catch (mailError) {
      global.logger.error('Failed to send reply email: ' + mailError.message, mailError);
    }

    res.status(200).json({
      success: true,
      message: 'Reply sent successfully',
      data: updatedContact
    });

  } catch (error) {
    global.logger.error(`[ContactController.replyToContact] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};
