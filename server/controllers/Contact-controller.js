const Contact = require('../models/Contact-model');
const sendEmail = require('../utils/sendEmail');

// Submit contact form
const submitContact = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, subject, and message are required'
      });
    }

    // Save to database
    const contact = new Contact({
      name,
      email,
      phone,
      subject,
      message
    });

    await contact.save();

    // Send email to admin
    const adminEmail = process.env.SENDER_EMAIL ;

    const adminEmailSubject = 'New Contact Form Submission';
    const adminEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Contact Form Submission</h2>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px;">
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <p style="background-color: white; padding: 10px; border-radius: 3px;">${message}</p>
          <p><strong>Submitted at:</strong> ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: adminEmail,
      subject: adminEmailSubject,
      html: adminEmailHtml
    });

    // Send confirmation email to user
    const userEmailSubject = 'Contact Form Submitted Successfully';
    const userEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Thank You for Contacting Raj Electrical Service</h2>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px;">
          <p>Dear ${name},</p>
          <p>Thank you for reaching out to us. We have received your message and will get back to you within 2 hours.</p>
          <div style="background-color: white; padding: 15px; border-radius: 3px; margin: 20px 0;">
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Your Message:</strong></p>
            <p style="margin-top: 10px;">${message}</p>
          </div>
          <p>If you have any urgent electrical needs, please call us at +91-9625333919.</p>
          <p>Best regards,<br>Raj Electrical Service Team</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: userEmailSubject,
      html: userEmailHtml
    });

    res.status(201).json({
      success: true,
      message: 'Contact form submitted successfully. We will get back to you soon.'
    });

  } catch (error) {
    console.error('Contact submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit contact form. Please try again.'
    });
  }
};

// Get all contacts (for admin)
const getAllContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: contacts
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contacts'
    });
  }
};

// Reply to contact (for admin)
const replyToContact = async (req, res) => {
  try {
    const { id } = req.params;
    const { replyMessage } = req.body;

    if (!replyMessage) {
      return res.status(400).json({
        success: false,
        message: 'Reply message is required'
      });
    }

    const contact = await Contact.findById(id);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    // Send reply email to user
    const emailSubject = `Reply to: ${contact.subject}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Reply from Raj Electrical Service</h2>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px;">
          <p>Dear ${contact.name},</p>
          <p>Thank you for contacting us. Here's our response to your message:</p>
          <div style="background-color: white; padding: 15px; border-radius: 3px; margin: 20px 0;">
            <strong>Subject:</strong> ${contact.subject}<br><br>
            <strong>Your original message:</strong><br>
            ${contact.message}
          </div>
          <div style="background-color: #e8f5e8; padding: 15px; border-radius: 3px; border-left: 4px solid #4caf50;">
            <strong>Our reply:</strong><br>
            ${replyMessage}
          </div>
          <p>If you have any further questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br>Raj Electrical Service Team</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: contact.email,
      subject: emailSubject,
      html: emailHtml
    });

    // Update contact in database
    await Contact.findByIdAndUpdate(id, {
      status: 'replied',
      repliedAt: new Date(),
      replyMessage: replyMessage
    });

    res.status(200).json({
      success: true,
      message: 'Reply sent successfully'
    });

  } catch (error) {
    console.error('Reply to contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reply'
    });
  }
};

module.exports = {
  submitContact,
  getAllContacts,
  replyToContact
};
