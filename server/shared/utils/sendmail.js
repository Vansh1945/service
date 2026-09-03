const axios = require('axios');
const Handlebars = require('handlebars');
const { SystemConfig } = require('../../features/system-setting/system-setting-model');

/**
 * Default templates defined internally in the server
 */
/**
 * Lightweight dynamic HTML layout builder
 */
const buildLayout = (title, bodyContent) => `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
  <h2 style="color: #2c3e50; text-align: center;">${title}</h2>
  ${bodyContent}
  <p style="color: #6b7280; font-size: 12px; margin-top: 24px; text-align: center;">Regards,<br/><strong>Support Team</strong></p>
</div>`;

/**
 * Default templates initialized in database
 */
const DEFAULT_EMAIL_TEMPLATES = {
  forgotPasswordOtp: {
    subject: "Your Verification Code",
    body: buildLayout("Verification Code", `<p>Hello,</p><p>Your One-Time Password (OTP) for verification is:</p><div style="background:#f4f4f4;padding:15px;text-align:center;border-radius:4px;margin:20px 0;"><strong style="font-size:24px;color:#2c3e50;">{{otp}}</strong></div><p>This code will expire in {{expiry}} minutes.</p>`),
    isActive: true,
    allowedVariables: ["otp", "email", "expiry"]
  },
  providerRegistrationOtp: {
    subject: "Your Provider Registration OTP",
    body: buildLayout("Registration OTP", `<p>Hello,</p><p>Your registration OTP is:</p><div style="background:#f4f4f4;padding:15px;text-align:center;border-radius:4px;margin:20px 0;"><strong style="font-size:24px;color:#2c3e50;">{{otp}}</strong></div><p>This code will expire in {{expiry}} minutes.</p>`),
    isActive: true,
    allowedVariables: ["otp", "email", "expiry"]
  },
  providerApproval: {
    subject: "Congratulations! Your Provider Account is Active",
    body: buildLayout("Account Active!", `<p>Dear {{name}},</p><p>Your provider account has been approved and activated.</p><p>Provider ID: <strong>{{providerName}}</strong></p>{{#if reason}}<p><strong>Remarks:</strong> {{reason}}</p>{{/if}}`),
    isActive: true,
    allowedVariables: ["name", "providerName", "reason", "email", "agreementPdfUrl", "approvalLetterUrl"]
  },
  providerRejection: {
    subject: "Update Regarding Your Provider Account Application",
    body: buildLayout("Application Status Update", `<p>Dear {{name}},</p><p>We regret to inform you that your provider account application has been <strong>Rejected</strong>.</p><p><strong>Reason:</strong> {{reason}}</p>`),
    isActive: true,
    allowedVariables: ["name", "reason"]
  },
  providerRestricted: {
    subject: "Notice: Temporary Restrictions Applied to Your Provider Account",
    body: buildLayout("Account Restricted", `<p>Dear {{name}},</p><p>Temporary account restrictions have been applied to your provider profile.</p><p><strong>Reason:</strong> {{reason}}</p>{{#if durationDays}}<p><strong>Duration:</strong> {{durationDays}} Days</p>{{/if}}`),
    isActive: true,
    allowedVariables: ["name", "reason", "durationDays"]
  },
  providerSuspended: {
    subject: "Important: Your Provider Account Has Been Suspended",
    body: buildLayout("Account Suspended", `<p>Dear {{name}},</p><p>Your provider account has been <strong>Suspended</strong> by administration.</p><p><strong>Reason:</strong> {{reason}}</p>`),
    isActive: true,
    allowedVariables: ["name", "reason"]
  },
  providerBlocked: {
    subject: "Urgent: Your Provider Account Has Been Blocked",
    body: buildLayout("Account Blocked", `<p>Dear {{name}},</p><p>Your provider account has been <strong>Blocked</strong> by administration.</p><p><strong>Reason:</strong> {{reason}}</p>{{#if durationDays}}<p><strong>Duration:</strong> {{durationDays}} Days</p>{{/if}}`),
    isActive: true,
    allowedVariables: ["name", "reason", "durationDays"]
  },
  contactReply: {
    subject: "Re: Support Inquiry Reply",
    body: buildLayout("Support Reply", `<p>Hi <strong>{{name}}</strong>,</p><p>{{remark}}</p>`),
    isActive: true,
    allowedVariables: ["name", "remark", "reason", "email"]
  },
  withdrawApproved: {
    subject: "Withdrawal Request Approved",
    body: buildLayout("Withdrawal Approved", `<p>Dear {{name}},</p><p>Your withdrawal request for <strong>₹{{withdrawAmount}}</strong> has been approved.</p>{{#if remark}}<p><strong>Remarks:</strong> {{remark}}</p>{{/if}}`),
    isActive: true,
    allowedVariables: ["name", "withdrawAmount", "remark", "date"]
  },
  withdrawRejected: {
    subject: "Withdrawal Request Rejected",
    body: buildLayout("Withdrawal Rejected", `<p>Dear {{name}},</p><p>Your withdrawal request for <strong>₹{{withdrawAmount}}</strong> has been rejected.</p><p><strong>Reason:</strong> {{reason}}</p>`),
    isActive: true,
    allowedVariables: ["name", "withdrawAmount", "reason", "date"]
  },
  complaintResponse: {
    subject: "Complaint Response Update",
    body: buildLayout("Complaint Update", `<p>Hello {{name}},</p><p>Your complaint regarding Booking <strong>#{{bookingId}}</strong> is updated to: <strong>{{status}}</strong>.</p><p><strong>Remarks:</strong> {{remark}}</p>`),
    isActive: true,
    allowedVariables: ["name", "bookingId", "status", "remark"]
  },
  adminBookingCancelledCustomer: {
    subject: "Booking Cancelled By Support Team",
    body: buildLayout("Booking Cancelled", `<p>Hello {{name}},</p><p>Your booking <strong>#{{bookingId}}</strong> has been cancelled.</p><p><strong>Reason:</strong> {{cancellationReason}}</p><p><strong>Refund Amount:</strong> ₹{{refundAmount}}</p>`),
    isActive: true,
    allowedVariables: ["name", "bookingId", "serviceName", "cancellationReason", "complaintId", "refundAmount", "platformFeeRetained", "refundDestination", "expectedRefundTimeline"]
  },
  adminBookingCancelledProvider: {
    subject: "Assigned Booking Cancelled",
    body: buildLayout("Booking Cancelled", `<p>Hello {{name}},</p><p>The booking <strong>#{{bookingId}}</strong> assigned to you has been cancelled.</p><p><strong>Reason:</strong> {{cancellationReason}}</p>`),
    isActive: true,
    allowedVariables: ["name", "bookingId", "customerName", "cancellationReason", "complaintId"]
  },
  refundCompleted: {
    subject: "Refund Processed for Booking #{{bookingId}}",
    body: buildLayout("Refund Processed", `<p>Dear {{customerName}},</p><p>Your refund of <strong>₹{{amount}}</strong> for Booking <strong>#{{bookingId}}</strong> is completed.</p><p><strong>Destination:</strong> {{refundDestination}}</p>`),
    isActive: true,
    allowedVariables: ["customerName", "bookingId", "refundId", "amount", "walletRefundAmount", "gatewayRefundAmount", "refundDestination"]
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
      const Template = require('../../features/template/template-model');
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
