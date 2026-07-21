const { SystemConfig } = require('../models/SystemSetting-model');
const Handlebars = require('handlebars');
const { sendMail, DEFAULT_EMAIL_TEMPLATES } = require('../utils/sendmail');

const MOCK_TEMPLATE_VARIABLES = {
  otp: "654321",
  name: "John Doe",
  providerName: "PROV-87629",
  customerName: "Jane Smith",
  reason: "Incomplete KYC documents provided.",
  remark: "Your verification request has been successfully reviewed.",
  withdrawAmount: "2500",
  bookingId: "BKG-991823",
  status: "Completed",
  email: "johndoe@example.com",
  expiry: "5",
  date: "2026-05-27",
  adminName: "Super Admin"
};

// getEmailTemplates()
const getEmailTemplates = async (req, res, next) => {
  try {
    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig({ companyName: 'Raj Electrical Service' });
    }

    // Initialize templates in DB if not already initialized
    let modified = false;
    if (!config.emailTemplates || Object.keys(config.emailTemplates).length === 0) {
      config.emailTemplates = DEFAULT_EMAIL_TEMPLATES;
      modified = true;
    } else {
      // Ensure all 9 templates exist
      for (const key of Object.keys(DEFAULT_EMAIL_TEMPLATES)) {
        if (!config.emailTemplates[key]) {
          config.emailTemplates[key] = DEFAULT_EMAIL_TEMPLATES[key];
          modified = true;
        }
      }
    }

    if (modified) {
      config.markModified('emailTemplates');
      await config.save();
    }

    res.status(200).json({
      success: true,
      data: config.emailTemplates
    });
  } catch (error) {
    global.logger.error(`[EmailTemplateController.getEmailTemplates] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// updateEmailTemplate()
const updateEmailTemplate = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { subject, body, isActive } = req.body;

    const allowedTypes = [
      'forgotPasswordOtp', 'providerRegistrationOtp', 'providerApproval',
      'providerRejection', 'contactReply', 'withdrawApproved',
      'withdrawRejected', 'complaintResponse',
      'adminBookingCancelledCustomer', 'adminBookingCancelledProvider'
    ];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template type'
      });
    }

    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig({ companyName: 'Raj Electrical Service' });
    }

    if (!config.emailTemplates) {
      config.emailTemplates = {};
    }

    if (!config.emailTemplates[type]) {
      config.emailTemplates[type] = DEFAULT_EMAIL_TEMPLATES[type] || { subject: '', body: '', allowedVariables: [] };
    }

    if (subject !== undefined) config.emailTemplates[type].subject = subject;
    if (body !== undefined) config.emailTemplates[type].body = body;
    if (isActive !== undefined) config.emailTemplates[type].isActive = isActive;
    config.emailTemplates[type].updatedAt = new Date();

    // Audit tracking
    config.metadata = {
      updatedBy: req.admin?.name || req.adminID || 'Admin',
      updatedAt: new Date()
    };

    config.markModified('emailTemplates');
    config.markModified('metadata');
    await config.save();

    res.status(200).json({
      success: true,
      message: 'Email template updated successfully',
      data: config.emailTemplates[type]
    });
  } catch (error) {
    global.logger.error(`[EmailTemplateController.updateEmailTemplate] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// previewEmailTemplate()
const previewEmailTemplate = async (req, res, next) => {
  try {
    const { subject, body, type } = req.body;

    if (!body || !subject) {
      return res.status(400).json({
        success: false,
        message: 'Subject and Body are required for preview'
      });
    }

    const config = await SystemConfig.findOne();
    const runtimeVars = {
      companyName: config?.companyName || "Raj Electrical Service",
      ...MOCK_TEMPLATE_VARIABLES
    };

    const compiledBody = Handlebars.compile(body);
    const compiledSubject = Handlebars.compile(subject);

    const renderedHtml = compiledBody(runtimeVars);
    const renderedSubject = compiledSubject(runtimeVars);

    res.status(200).json({
      success: true,
      data: {
        subject: renderedSubject,
        html: renderedHtml
      }
    });
  } catch (error) {
    global.logger.error(`[EmailTemplateController.previewEmailTemplate] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// testSendEmailTemplate()
const testSendEmailTemplate = async (req, res, next) => {
  try {
    const { type, testEmail, subject, body } = req.body;

    if (!testEmail || !type) {
      return res.status(400).json({
        success: false,
        message: 'Template type and recipient test email are required'
      });
    }

    const config = await SystemConfig.findOne();
    const runtimeVars = {
      companyName: config?.companyName || "Raj Electrical Service",
      ...MOCK_TEMPLATE_VARIABLES
    };

    let finalSubject = subject;
    let finalHtml = body;

    // If subject and body are not passed, we fetch them from dynamic template
    if (!finalSubject || !finalHtml) {
      let template = config?.emailTemplates?.[type] || DEFAULT_EMAIL_TEMPLATES[type];
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }
      finalSubject = template.subject;
      finalHtml = template.body;
    }

    const compiledBody = Handlebars.compile(finalHtml);
    const compiledSubject = Handlebars.compile(finalSubject);

    const renderedHtml = compiledBody(runtimeVars);
    const renderedSubject = compiledSubject(runtimeVars);

    const emailResponse = await sendMail({
      to: testEmail,
      subject: renderedSubject,
      html: renderedHtml
    });

    res.status(200).json({
      success: true,
      message: `Test email sent successfully to ${testEmail}`,
      data: emailResponse
    });
  } catch (error) {
    global.logger.error(`[EmailTemplateController.testSendEmailTemplate] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// restoreDefaultTemplate()
const restoreDefaultTemplate = async (req, res, next) => {
  try {
    const { type } = req.body;

    if (!type || !DEFAULT_EMAIL_TEMPLATES[type]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template type'
      });
    }

    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig({ companyName: 'Raj Electrical Service' });
    }

    if (!config.emailTemplates) {
      config.emailTemplates = {};
    }

    config.emailTemplates[type] = DEFAULT_EMAIL_TEMPLATES[type];
    config.emailTemplates[type].updatedAt = new Date();

    // Audit tracking
    config.metadata = {
      updatedBy: req.admin?.name || req.adminID || 'Admin',
      updatedAt: new Date()
    };

    config.markModified('emailTemplates');
    config.markModified('metadata');
    await config.save();

    res.status(200).json({
      success: true,
      message: 'Template restored to default successfully',
      data: config.emailTemplates[type]
    });
  } catch (error) {
    global.logger.error(`[EmailTemplateController.restoreDefaultTemplate] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

module.exports = {
  getEmailTemplates,
  updateEmailTemplate,
  previewEmailTemplate,
  testSendEmailTemplate,
  restoreDefaultTemplate
};

