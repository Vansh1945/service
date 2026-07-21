const axios = require('axios');
const Handlebars = require('handlebars');
const { SystemConfig } = require('../models/SystemSetting-model');

/**
 * Default templates defined internally in the server
 */
const DEFAULT_EMAIL_TEMPLATES = {
  forgotPasswordOtp: {
    subject: "Your Verification Code",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
  <h2 style="color: #333; text-align: center;">Verification Code</h2>
  <p style="color: #555; font-size: 16px;">Hello,</p>
  <p style="color: #555; font-size: 16px;">Your One-Time Password (OTP) for verification is:</p>
  <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 4px; margin: 20px 0;">
    <strong style="font-size: 24px; color: #2c3e50; letter-spacing: 2px;">{{otp}}</strong>
  </div>
  <p style="color: #555; font-size: 14px;">This code will expire in {{expiry}} minutes.</p>
  <p style="color: #555; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
</div>`,
    isActive: true,
    allowedVariables: ["otp", "email", "expiry"]
  },
  providerRegistrationOtp: {
    subject: "Your Provider Registration OTP",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
  <h2 style="color: #333; text-align: center;">Registration OTP</h2>
  <p style="color: #555; font-size: 16px;">Hello,</p>
  <p style="color: #555; font-size: 16px;">Your One-Time Password (OTP) for provider registration is:</p>
  <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 4px; margin: 20px 0;">
    <strong style="font-size: 24px; color: #2c3e50; letter-spacing: 2px;">{{otp}}</strong>
  </div>
  <p style="color: #555; font-size: 14px;">This code will expire in {{expiry}} minutes.</p>
  <p style="color: #555; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
</div>`,
    isActive: true,
    allowedVariables: ["otp", "email", "expiry"]
  },
  providerApproval: {
    subject: "Congratulations! Your Provider Account is Active",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
    <h2 style="color: #2c3e50; text-align: center;">Account Active!</h2>
    <p>Dear {{name}},</p>
    <p>Your provider account has been manually activated and approved by the administrator.</p>
    <p>Your Provider ID is: <strong>{{providerName}}</strong></p>
    {{#if reason}}
    <p><strong>Admin Remarks:</strong> {{reason}}</p>
    {{/if}}
    <div style="text-align: center; margin-top: 30px;">
        <a href="{{email}}" style="background-color: #0D9488; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Login to Dashboard</a>
    </div>
</div>`,
    isActive: true,
    allowedVariables: ["name", "providerName", "reason", "email", "agreementPdfUrl", "approvalLetterUrl"]
  },
  providerRejection: {
    subject: "Update Regarding Your Provider Account",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
    <h2 style="color: #c0392b; text-align: center;">Account Update</h2>
    <p>Dear {{name}},</p>
    <p>We regret to inform you that your provider account application has been <strong>Rejected</strong>.</p>
    <p><strong>Reason for Rejection:</strong> {{reason}}</p>
</div>`,
    isActive: true,
    allowedVariables: ["name", "reason"]
  },
  contactReply: {
    subject: "Re: {{subject}}",
    body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
  <div style="background:#4f46e5;padding:24px;text-align:center;">
    <h2 style="color:#ffffff;margin:0;">Reply to Your Message</h2>
  </div>
  <div style="padding:28px 32px;background:#ffffff;">
    <p style="color:#374151;font-size:15px;">Hi <strong>{{name}}</strong>,</p>
    <p style="color:#374151;font-size:15px;">Thank you for reaching out. Here is our response to your inquiry:</p>
    <div style="background:#f3f4f6;border-left:4px solid #4f46e5;padding:16px 20px;border-radius:4px;margin:20px 0;">
      <p style="margin:0;color:#1f2937;font-size:15px;white-space:pre-line;">{{remark}}</p>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <p style="color:#6b7280;font-size:13px;margin-bottom:4px;"><strong>Your original message:</strong></p>
    <p style="color:#6b7280;font-size:13px;font-style:italic;white-space:pre-line;">{{reason}}</p>
    <p style="color:#374151;font-size:14px;margin-top:24px;">If you have further questions, feel free to contact us again.</p>
    <p style="color:#374151;font-size:14px;margin:0;">Regards,<br/><strong>Support Team</strong></p>
  </div>
  <div style="background:#f9fafb;padding:16px;text-align:center;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">This is an automated email. Please do not reply directly to this message.</p>
  </div>
</div>`,
    isActive: true,
    allowedVariables: ["name", "remark", "reason", "email"]
  },
  withdrawApproved: {
    subject: "Withdrawal Request Approved",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
    <h2 style="color: #2c3e50; text-align: center;">Withdrawal Approved!</h2>
    <p>Dear {{name}},</p>
    <p>Your withdrawal request for <strong>₹{{withdrawAmount}}</strong> has been successfully approved and processed.</p>
    {{#if remark}}
    <p><strong>Remarks:</strong> {{remark}}</p>
    {{/if}}
    <p>Date: {{date}}</p>
</div>`,
    isActive: true,
    allowedVariables: ["name", "withdrawAmount", "remark", "date"]
  },
  withdrawRejected: {
    subject: "Withdrawal Request Rejected",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
    <h2 style="color: #c0392b; text-align: center;">Withdrawal Rejected</h2>
    <p>Dear {{name}},</p>
    <p>Your withdrawal request for <strong>₹{{withdrawAmount}}</strong> has been rejected.</p>
    <p><strong>Reason:</strong> {{reason}}</p>
    <p>Date: {{date}}</p>
</div>`,
    isActive: true,
    allowedVariables: ["name", "withdrawAmount", "reason", "date"]
  },
  complaintResponse: {
    subject: "Complaint Response Update",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
    <h2 style="color: #2c3e50; text-align: center;">Complaint Response</h2>
    <p>Hello {{name}},</p>
    <p>Your complaint regarding Booking <strong>#{{bookingId}}</strong> has been updated. Status: <strong>{{status}}</strong>.</p>
    <p><strong>Remarks / Resolution Details:</strong> {{remark}}</p>
</div>`,
    isActive: true,
    allowedVariables: ["name", "bookingId", "status", "remark"]
  },
  adminBookingCancelledCustomer: {
    subject: "Booking Cancelled By Support Team",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
    <h2 style="color: #c0392b; text-align: center;">Booking Cancelled By Support Team</h2>
    <p>Hello {{name}},</p>
    <p>We would like to inform you that your booking has been cancelled by our support team.</p>
    <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #f3f4f6;">
      <p style="margin: 4px 0;"><strong>Booking ID:</strong> {{bookingId}}</p>
      <p style="margin: 4px 0;"><strong>Service Name:</strong> {{serviceName}}</p>
      <p style="margin: 4px 0;"><strong>Cancellation Reason:</strong> {{cancellationReason}}</p>
      <p style="margin: 4px 0;"><strong>Complaint ID:</strong> {{complaintId}}</p>
      <p style="margin: 4px 0;"><strong>Refund Amount:</strong> ₹{{refundAmount}}</p>
      <p style="margin: 4px 0;"><strong>Platform Fee Retained:</strong> ₹{{platformFeeRetained}}</p>
      <p style="margin: 4px 0;"><strong>Refund Destination:</strong> {{refundDestination}}</p>
    </div>
    <p style="color: #555;"><strong>Timeline note:</strong> If refunded to original payment method, the amount may take 2–10 business days to reflect depending on your bank or payment provider. If refunded to Customer Wallet, the credit is instant.</p>
    <p>Regards,<br/><strong>Support Team</strong></p>
</div>`,
    isActive: true,
    allowedVariables: ["name", "bookingId", "serviceName", "cancellationReason", "complaintId", "refundAmount", "platformFeeRetained", "refundDestination", "expectedRefundTimeline"]
  },
  adminBookingCancelledProvider: {
    subject: "Assigned Booking Cancelled",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
    <h2 style="color: #c0392b; text-align: center;">Assigned Booking Cancelled</h2>
    <p>Hello {{name}},</p>
    <p>Please note that the booking assigned to you has been cancelled by the support team/admin.</p>
    <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #f3f4f6;">
      <p style="margin: 4px 0;"><strong>Booking ID:</strong> {{bookingId}}</p>
      <p style="margin: 4px 0;"><strong>Customer Name:</strong> {{customerName}}</p>
      <p style="margin: 4px 0;"><strong>Cancellation Reason:</strong> {{cancellationReason}}</p>
      <p style="margin: 4px 0;"><strong>Complaint ID:</strong> {{complaintId}}</p>
    </div>
    <p style="color: #e74c3c;">The slot is now available. Provider earnings split and recalculations have been applied where applicable.</p>
</div>`,
    isActive: true,
    allowedVariables: ["name", "bookingId", "customerName", "cancellationReason", "complaintId"]
  }
};

/**
 * Reusable mail sender utility using Brevo API with Handbars dynamic templates
 *
 * @param {Object} options
 * @param {string} options.to           - Recipient email address
 * @param {string} [options.subject]    - Email subject line (ignored if dynamic template is active)
 * @param {string} [options.html]       - HTML body of the email (ignored if dynamic template is active)
 * @param {string} [options.templateType] - Key of the emailTemplates object in SystemSettings
 * @param {Object} [options.variables]   - Key-value pairs to inject into the template placeholders
 * @param {Object} [options.attachment]  - Optional single attachment info (name, content as base64)
 * @param {Array} [options.attachments]  - Optional array of attachment objects
 */
const sendMail = async ({ to, subject, html, templateType, variables, attachment, attachments }) => {
  try {
    const config = await SystemConfig.findOne();
    if (config && config.notificationSettings && config.notificationSettings.emailEnabled === false) {
      console.log(`[sendMail] Skipped sending email to ${to} because the email system is globally disabled.`);
      return {
        success: false,
        message: "Email sending skipped: Email system is globally disabled."
      };
    }
  } catch (error) {
    console.error("[sendMail] Error checking global email system status:", error);
  }

  const apiKey = process.env.SMTP_PASS;
  const senderEmail = process.env.SMTP_USER;

  let finalHtml = html || '';
  let finalSubject = subject || '';

  if (templateType) {
    try {
      const config = await SystemConfig.findOne();
      const Template = require('../models/Template-model');
      let templateDoc = await Template.findOne({ key: templateType });
      if (!templateDoc) {
        templateDoc = await Template.findOne({ key: `email_${templateType}` });
      }

      let template = null;
      if (templateDoc) {
        const activeVersion = templateDoc.versions.find(v => v.isActive);
        if (activeVersion) {
          template = {
            subject: activeVersion.title,
            body: activeVersion.body,
            isActive: true
          };
        }
      }

      if (!template) {
        template = config?.emailTemplates?.[templateType];
      }

      // Fallback to internal default template if not found in database
      if (!template || !template.body) {
        template = DEFAULT_EMAIL_TEMPLATES[templateType];
      }

      if (template) {

        // If template is explicitly deactivated by admin, skip sending
        if (template.isActive === false) {
          console.log(`[sendMail] Skipped sending template ${templateType} because it is deactivated.`);
          return {
            success: false,
            message: `Email sending skipped: template ${templateType} is inactive.`
          };
        }

        const runtimeVars = {
          companyName: config?.companyName || "Raj Electrical Service",
          ...variables
        };

        let bodyMarkup = template.body || '';

        // Auto-inject reason/remarks if passed in variables but missing in template body reference
        if (variables?.reason && !bodyMarkup.includes('{{reason}}') && !bodyMarkup.includes('reason')) {
          const isRejection = templateType.toLowerCase().includes('reject');
          const borderColor = isRejection ? '#ef4444' : '#0d9488';
          const bgColor = isRejection ? '#fef2f2' : '#f0fdf4';
          const textColor = isRejection ? '#991b1b' : '#115e59';
          const title = isRejection ? 'Reason for Rejection' : 'Admin Remarks';

          const remarksBox = `\n<div style="margin-top: 20px; padding: 15px; border-left: 4px solid ${borderColor}; background-color: ${bgColor}; color: ${textColor}; border-radius: 6px; font-family: sans-serif; font-size: 14px;"><strong>${title}:</strong> {{reason}}</div>`;

          if (bodyMarkup.includes('</div>')) {
            const lastIndex = bodyMarkup.lastIndexOf('</div>');
            bodyMarkup = bodyMarkup.slice(0, lastIndex) + remarksBox + bodyMarkup.slice(lastIndex);
          } else {
            bodyMarkup += remarksBox;
          }
        } else if (variables?.remark && !bodyMarkup.includes('{{remark}}') && !bodyMarkup.includes('remark')) {
          const remarksBox = `\n<div style="margin-top: 20px; padding: 15px; border-left: 4px solid #0d9488; background-color: #f0fdf4; color: #115e59; border-radius: 6px; font-family: sans-serif; font-size: 14px;"><strong>Remarks:</strong> {{remark}}</div>`;

          if (bodyMarkup.includes('</div>')) {
            const lastIndex = bodyMarkup.lastIndexOf('</div>');
            bodyMarkup = bodyMarkup.slice(0, lastIndex) + remarksBox + bodyMarkup.slice(lastIndex);
          } else {
            bodyMarkup += remarksBox;
          }
        }

        const compiledBody = Handlebars.compile(bodyMarkup);
        const compiledSubject = Handlebars.compile(template.subject);

        finalHtml = compiledBody(runtimeVars);
        finalSubject = compiledSubject(runtimeVars);
      }
    } catch (err) {
      console.error(`[sendMail] Template compilation error for ${templateType}:`, err.message);
      // Fallback to static values if they were supplied or default templates
      if (!finalHtml && DEFAULT_EMAIL_TEMPLATES[templateType]) {
        try {
          const fallback = DEFAULT_EMAIL_TEMPLATES[templateType];
          let bodyMarkup = fallback.body || '';
          if (variables?.reason && !bodyMarkup.includes('{{reason}}') && !bodyMarkup.includes('reason')) {
            const isRejection = templateType.toLowerCase().includes('reject');
            const borderColor = isRejection ? '#ef4444' : '#0d9488';
            const bgColor = isRejection ? '#fef2f2' : '#f0fdf4';
            const textColor = isRejection ? '#991b1b' : '#115e59';
            const title = isRejection ? 'Reason for Rejection' : 'Admin Remarks';
            const remarksBox = `\n<div style="margin-top: 20px; padding: 15px; border-left: 4px solid ${borderColor}; background-color: ${bgColor}; color: ${textColor}; border-radius: 6px; font-family: sans-serif; font-size: 14px;"><strong>${title}:</strong> {{reason}}</div>`;
            if (bodyMarkup.includes('</div>')) {
              const lastIndex = bodyMarkup.lastIndexOf('</div>');
              bodyMarkup = bodyMarkup.slice(0, lastIndex) + remarksBox + bodyMarkup.slice(lastIndex);
            } else {
              bodyMarkup += remarksBox;
            }
          }
          finalHtml = Handlebars.compile(bodyMarkup)(variables || {});
          finalSubject = Handlebars.compile(fallback.subject)(variables || {});
        } catch (_) { }
      }
    }
  }

  // Fetch company name for sender identity (avoids generic "Support Team" spam trigger)
  let senderName = "Raj Electrical Service";
  try {
    const config = await SystemConfig.findOne();
    if (config?.companyName) senderName = config.companyName;
  } catch (_) { }

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to }],
    replyTo: { name: senderName, email: senderEmail },
    subject: finalSubject,
    htmlContent: finalHtml,
    headers: {
      "X-Mailer": senderName,
      "List-Unsubscribe": `<mailto:${senderEmail}?subject=Unsubscribe>`,
      "Precedence": "bulk"
    },
    tags: [templateType || "transactional"]
  };

  if (attachments && Array.isArray(attachments)) {
    payload.attachment = attachments.map(att => ({
      content: att.content,
      name: att.name
    }));
  } else if (attachment && attachment.content && attachment.name) {
    payload.attachment = [
      {
        content: attachment.content,
        name: attachment.name
      }
    ];
  }

  try {
    const response = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      }
    });

    console.log(`Email sent successfully to ${to}, Message ID: ${response.data.messageId}`);
    return {
      success: true,
      messageId: response.data.messageId
    };
  } catch (error) {
    console.error("Brevo API Error in sendMail:", error.response?.data || error.message);
    throw new Error(`Failed to send email via Brevo API: ${error.response?.data?.message || error.message}`);
  }
};

module.exports = { sendMail, DEFAULT_EMAIL_TEMPLATES };
