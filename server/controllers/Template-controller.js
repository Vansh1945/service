const Template = require('../models/Template-model');
const { SystemConfig } = require('../models/SystemSetting-model');
const Provider = require('../models/Provider-model');
const Handlebars = require('handlebars');
const { fetchImageBuffer, generateLetterheadDocument } = require('../services/agreementGenerator');

// Mask helper functions
const maskAadhaar = (num) => {
  if (!num) return 'N/A';
  const clean = num.toString().replace(/[-\s]/g, '');
  if (clean.length < 4) return 'XXXX-XXXX-XXXX';
  return `XXXX-XXXX-${clean.slice(-4)}`;
};

const maskPan = (num) => {
  if (!num) return 'N/A';
  const clean = num.toString().trim();
  if (clean.length < 4) return 'XXXXX-XXXX';
  return `XXXXX${clean.slice(-4)}`;
};

const maskBankAccount = (num) => {
  if (!num) return 'N/A';
  const clean = num.toString().trim();
  if (clean.length < 4) return 'XXXXXX';
  return `XXXXXX${clean.slice(-4)}`;
};

const MOCK_PROVIDER = {
  name: 'Aman Sharma',
  providerId: 'PRO-98721',
  email: 'aman.sharma@example.com',
  phone: '+91 98765 43210',
  category: 'Electrician',
  status: 'approved',
  dateOfBirth: new Date('1992-05-15'),
  kycDetails: {
    aadhaarNumber: '123456789012',
    panNumber: 'ABCDE1234F',
    verificationStatus: 'verified'
  },
  currentAddress: {
    houseNumber: '12A, Ground Floor',
    street: 'Sector 62',
    landmark: 'Near Metro Station',
    villageCity: 'Noida',
    district: 'Gautam Buddha Nagar',
    state: 'Uttar Pradesh',
    pincode: '201301'
  },
  permanentAddress: {
    houseNumber: '12A, Ground Floor',
    street: 'Sector 62',
    landmark: 'Near Metro Station',
    villageCity: 'Noida',
    district: 'Gautam Buddha Nagar',
    state: 'Uttar Pradesh',
    pincode: '201301'
  },
  bankDetails: {
    bankName: 'HDFC Bank',
    accountNumber: '50100123456789',
    ifsc: 'HDFC0000123',
    branchName: 'Sector 62 Noida'
  },
  legalAcceptance: {
    version: '1.0',
    acceptedAt: new Date(),
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  },
  digitalSignature: {
    signedName: 'Aman Sharma',
    deviceInfo: 'Chrome Browser on Windows 11'
  }
};

const DEFAULT_TEMPLATES = [
  {
    key: 'agreement',
    name: 'Provider Service Agreement',
    type: 'pdf',
    description: 'Service agreement contract generated when a provider profile gets approved.',
    allowedVariables: [
      'companyName', 'companyAddress', 'companyEmail', 'companyPhone', 'companyWebsite', 'companyGST', 'companyPAN',
      'providerName', 'providerId', 'providerEmail', 'providerPhone', 'providerCategory', 'providerStatus',
      'approvalDate', 'agreementDate', 'documentNumber', 'verificationStatus', 'aadhaarNumberMasked', 'panNumberMasked',
      'currentAddress', 'permanentAddress', 'bankName', 'accountNumberMasked', 'ifsc', 'branch', 'city', 'state',
      'adminName', 'generatedDate', 'generatedTime', 'agreementVersion', 'supportEmail', 'supportPhone', 'currentYear'
    ],
    versions: [
      {
        version: 1,
        isActive: true,
        title: 'PROVIDER SERVICE AGREEMENT',
        subtitle: 'Raj Electrical Services Partner Agreement',
        hasLetterHead: true,
        headerText: 'OFFICIAL SERVICE AGREEMENT',
        footerText: 'Powered by Raj Electrical Services',
        authorizedSignatory: 'Manager - Operations',
        hasCompanySeal: true,
        hasQrSection: true,
        hasWatermark: true,
        terms: `1. The provider declares all the information, identity documents (Aadhaar, PAN) and bank details submitted are genuine and verifiable.\n2. The provider agrees to abide by the service SLAs, professional conduct guidelines, and customer safety rules of the platform.\n3. The provider consents to background verification checks and security vetting.\n4. Any misrepresentation of information may result in immediate termination of this agreement and legal action.`,
        notes: 'This document is system-generated from secure database records and is legally binding.',
        body: `<p>This Provider Service Agreement is executed on <strong>{{agreementDate}}</strong> by and between <strong>{{companyName}}</strong> (hereinafter referred to as the Company) and <strong>{{providerName}}</strong> (hereinafter referred to as the Service Provider).</p>
<h3>1. Provider Identification</h3>
<p><strong>Name:</strong> {{providerName}}<br/>
<strong>Provider ID:</strong> {{providerId}}<br/>
<strong>Email:</strong> {{providerEmail}}<br/>
<strong>Phone:</strong> {{providerPhone}}</p>
<h3>2. Address & KYC Information</h3>
<p><strong>Verification Status:</strong> {{verificationStatus}}<br/>
<strong>Aadhaar Number:</strong> {{aadhaarNumberMasked}}<br/>
<strong>PAN Number:</strong> {{panNumberMasked}}<br/>
<strong>Current Address:</strong> {{currentAddress}}<br/>
<strong>Permanent Address:</strong> {{permanentAddress}}</p>
<h3>3. Bank Account Information</h3>
<p><strong>Bank Name:</strong> {{bankName}}<br/>
<strong>Account Number:</strong> {{accountNumberMasked}}<br/>
<strong>IFSC Code:</strong> {{ifsc}} (Branch: {{branch}})</p>`
      }
    ]
  },
  {
    key: 'approval_letter',
    name: 'Official Provider Approval Letter',
    type: 'pdf',
    description: 'Letter sent to provider as verification confirmation after profile approval.',
    allowedVariables: [
      'companyName', 'companyAddress', 'companyEmail', 'companyPhone', 'companyWebsite',
      'providerName', 'providerId', 'providerEmail', 'providerPhone', 'approvalDate',
      'currentAddress', 'adminName', 'generatedDate', 'supportEmail', 'supportPhone', 'currentYear'
    ],
    versions: [
      {
        version: 1,
        isActive: true,
        title: 'OFFICIAL PROVIDER APPROVAL LETTER',
        subtitle: 'Account Activation and Platform Approval Notice',
        hasLetterHead: true,
        headerText: 'ACCOUNT ACTIVATION LETTER',
        footerText: 'Powered by Raj Electrical Services',
        authorizedSignatory: 'Administrator',
        hasCompanySeal: true,
        hasQrSection: true,
        hasWatermark: true,
        terms: '',
        notes: 'Thank you for choosing to partner with us. We wish you great success.',
        body: `<p>Dear <strong>{{providerName}}</strong>,</p>
<p>We are pleased to inform you that your application to join <strong>{{companyName}}</strong> as a partner provider has been reviewed and approved. Your profile verification is complete, and your account is now fully active on our platform.</p>
<p>You are now authorized to accept customer bookings, provide professional electrical services, and process earnings through your digital wallet dashboard.</p>
<p>Please ensure the highest standards of service quality and professionalism at all times.</p>`
      }
    ]
  }
];

// Helper to seed missing templates and clean old ones
const seedDefaultTemplates = async () => {
  try {
    const allowedKeys = DEFAULT_TEMPLATES.map(t => t.key);
    await Template.deleteMany({ key: { $nin: allowedKeys } });

    for (const def of DEFAULT_TEMPLATES) {
      const exists = await Template.findOne({ key: def.key });
      if (!exists) {
        await new Template(def).save();
      }
    }
  } catch (error) {
    console.error('Failed to seed templates:', error);
  }
};

// 1. List all templates (seeds defaults on execution to ensure database integrity)
exports.getTemplates = async (req, res, next) => {
  try {
    await seedDefaultTemplates();
    const templates = await Template.find();
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
};

// 2. Get single template details
exports.getTemplateByKey = async (req, res, next) => {
  try {
    const { key } = req.params;
    const template = await Template.findOne({ key });
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.status(200).json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

// 3. Save new version or draft version
exports.saveTemplateVersion = async (req, res, next) => {
  try {
    const { key } = req.params;
    const fields = req.body; // title, body, terms, etc.

    const template = await Template.findOne({ key });
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    // Determine the next version number
    const maxVersion = template.versions.length > 0 
      ? Math.max(...template.versions.map(v => v.version)) 
      : 0;
    const nextVersion = maxVersion + 1;

    // Set all previous versions to inactive
    template.versions.forEach(v => {
      v.isActive = false;
    });

    const newVersion = {
      version: nextVersion,
      isActive: true,
      title: fields.title || '',
      subtitle: fields.subtitle || '',
      hasLetterHead: fields.hasLetterHead !== false,
      headerText: fields.headerText || '',
      body: fields.body || '',
      footerText: fields.footerText || '',
      terms: fields.terms || '',
      notes: fields.notes || '',
      authorizedSignatory: fields.authorizedSignatory || '',
      hasCompanySeal: fields.hasCompanySeal !== false,
      hasQrSection: fields.hasQrSection !== false,
      hasWatermark: fields.hasWatermark !== false,
      createdBy: req.admin?.name || 'Admin',
      updatedAt: new Date()
    };

    template.versions.push(newVersion);
    await template.save();


    res.status(201).json({ success: true, message: `Version ${nextVersion} saved successfully`, data: newVersion });
  } catch (error) {
    next(error);
  }
};

// 4. Publish a version (set active, deactivate others)
exports.publishTemplateVersion = async (req, res, next) => {
  try {
    const { key, versionNumber } = req.params;
    const vNum = parseInt(versionNumber);

    const template = await Template.findOne({ key });
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    let found = false;
    template.versions.forEach(v => {
      if (v.version === vNum) {
        v.isActive = true;
        found = true;
      } else {
        v.isActive = false;
      }
    });

    if (!found) {
      return res.status(404).json({ success: false, message: `Version ${versionNumber} not found` });
    }

    await template.save();
    res.status(200).json({ success: true, message: `Version ${vNum} published successfully` });
  } catch (error) {
    next(error);
  }
};

// 5. Restore a past version (copies its fields as a new draft)
exports.restoreTemplateVersion = async (req, res, next) => {
  try {
    const { key, versionNumber } = req.params;
    const vNum = parseInt(versionNumber);

    const template = await Template.findOne({ key });
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const versionToRestore = template.versions.find(v => v.version === vNum);
    if (!versionToRestore) {
      return res.status(404).json({ success: false, message: `Version ${versionNumber} not found` });
    }

    const maxVersion = Math.max(...template.versions.map(v => v.version));
    const newVersion = {
      version: maxVersion + 1,
      isActive: false,
      title: versionToRestore.title,
      subtitle: versionToRestore.subtitle,
      hasLetterHead: versionToRestore.hasLetterHead,
      headerText: versionToRestore.headerText,
      body: versionToRestore.body,
      footerText: versionToRestore.footerText,
      terms: versionToRestore.terms,
      notes: versionToRestore.notes,
      authorizedSignatory: versionToRestore.authorizedSignatory,
      hasCompanySeal: versionToRestore.hasCompanySeal,
      hasQrSection: versionToRestore.hasQrSection,
      hasWatermark: versionToRestore.hasWatermark,
      createdBy: req.admin?.name || 'Admin',
      updatedAt: new Date()
    };

    template.versions.push(newVersion);
    await template.save();

    res.status(201).json({ success: true, message: `Version ${versionNumber} restored as a new draft version ${newVersion.version}`, data: newVersion });
  } catch (error) {
    next(error);
  }
};

// 6. Duplicate a version (copies details as a new draft)
exports.duplicateTemplateVersion = async (req, res, next) => {
  try {
    const { key, versionNumber } = req.params;
    const vNum = parseInt(versionNumber);

    const template = await Template.findOne({ key });
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const versionToDuplicate = template.versions.find(v => v.version === vNum);
    if (!versionToDuplicate) {
      return res.status(404).json({ success: false, message: `Version ${versionNumber} not found` });
    }

    const maxVersion = Math.max(...template.versions.map(v => v.version));
    const newVersion = {
      version: maxVersion + 1,
      isActive: false,
      title: `${versionToDuplicate.title} (Copy)`,
      subtitle: versionToDuplicate.subtitle,
      hasLetterHead: versionToDuplicate.hasLetterHead,
      headerText: versionToDuplicate.headerText,
      body: versionToDuplicate.body,
      footerText: versionToDuplicate.footerText,
      terms: versionToDuplicate.terms,
      notes: versionToDuplicate.notes,
      authorizedSignatory: versionToDuplicate.authorizedSignatory,
      hasCompanySeal: versionToDuplicate.hasCompanySeal,
      hasQrSection: versionToDuplicate.hasQrSection,
      hasWatermark: versionToDuplicate.hasWatermark,
      createdBy: req.admin?.name || 'Admin',
      updatedAt: new Date()
    };

    template.versions.push(newVersion);
    await template.save();

    res.status(201).json({ success: true, message: `Version ${versionNumber} duplicated as version ${newVersion.version}`, data: newVersion });
  } catch (error) {
    next(error);
  }
};

// 7. Preview template with compiled mock data
exports.previewTemplate = async (req, res, next) => {
  try {
    const { key } = req.params;
    const fields = req.body; // draft fields

    const config = await SystemConfig.findOne() || { companyName: 'Raj Electrical Services' };

    // Resolve context placeholders
    const context = {
      companyName: config.companyName || 'Raj Electrical Services',
      companyAddress: config.address || 'N/A',
      companyEmail: config.email || 'support@rajelectrical.com',
      companyPhone: config.phone || 'N/A',
      companyWebsite: config.website || 'N/A',
      companyGST: '07AAAAA1111A1Z1',
      companyPAN: 'AAAAA1111A',
      providerName: MOCK_PROVIDER.name,
      providerId: MOCK_PROVIDER.providerId,
      providerEmail: MOCK_PROVIDER.email,
      providerPhone: MOCK_PROVIDER.phone,
      providerCategory: MOCK_PROVIDER.category,
      providerStatus: MOCK_PROVIDER.status,
      approvalDate: new Date().toLocaleDateString('en-IN'),
      agreementDate: new Date().toLocaleDateString('en-IN'),
      documentNumber: 'PREVIEW-REF-99999',
      verificationStatus: MOCK_PROVIDER.kycDetails.verificationStatus,
      aadhaarNumberMasked: maskAadhaar(MOCK_PROVIDER.kycDetails.aadhaarNumber),
      panNumberMasked: maskPan(MOCK_PROVIDER.kycDetails.panNumber),
      currentAddress: '12A, Sector 62, Noida, Uttar Pradesh - 201301',
      permanentAddress: '12A, Sector 62, Noida, Uttar Pradesh - 201301',
      bankName: MOCK_PROVIDER.bankDetails.bankName,
      accountNumberMasked: maskBankAccount(MOCK_PROVIDER.bankDetails.accountNumber),
      ifsc: MOCK_PROVIDER.bankDetails.ifsc,
      branch: MOCK_PROVIDER.bankDetails.branchName,
      city: 'Noida',
      state: 'Uttar Pradesh',
      adminName: req.admin?.name || 'Administrator',
      generatedDate: new Date().toLocaleDateString('en-IN'),
      generatedTime: new Date().toLocaleTimeString('en-IN'),
      agreementVersion: 'v1.0',
      supportEmail: config.email || 'support@rajelectrical.com',
      supportPhone: config.phone || 'N/A',
      currentYear: new Date().getFullYear()
    };

    // Compile dynamic contents using Handlebars
    const compile = (text) => {
      if (!text) return '';
      try {
        return Handlebars.compile(text)(context);
      } catch (err) {
        return text;
      }
    };

    const { generateLetterheadDocument, stripHtml } = require('../services/agreementGenerator');

    const parsedTitle = stripHtml(compile(fields.title));
    const parsedSubtitle = stripHtml(compile(fields.subtitle));
    const parsedHeader = stripHtml(compile(fields.headerText));
    const parsedBody = stripHtml(compile(fields.body));
    const parsedFooter = stripHtml(compile(fields.footerText));
    const parsedTerms = stripHtml(compile(fields.terms));
    const parsedNotes = stripHtml(compile(fields.notes));
    const parsedSignatory = stripHtml(compile(fields.authorizedSignatory));

    const pdfBuffer = await generateLetterheadDocument(MOCK_PROVIDER, 'PREVIEW', async (doc, y, currentConfig, sigBuf, stampBuf) => {
      const MARGIN_LEFT = 50;
      const CONTENT_WIDTH = 595.28 - 100;
      
      // Render Title
      if (parsedTitle) {
        doc.save();
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#0C7C84');
        doc.text(parsedTitle, MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'center' });
        doc.restore();
        y += 18;
      }

      // Render Subtitle
      if (parsedSubtitle) {
        doc.save();
        doc.fontSize(9.5).font('Helvetica-Oblique').fillColor('#555555');
        doc.text(parsedSubtitle, MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'center' });
        doc.restore();
        y += 14;
      }

      // Draw custom separator line
      doc.save();
      doc.moveTo(MARGIN_LEFT, y).lineTo(595.28 - 50, y).lineWidth(0.5).strokeColor('#888888').stroke();
      doc.restore();
      y += 12;

      // Render Header text
      if (parsedHeader) {
        doc.save();
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#222222');
        doc.text(parsedHeader, MARGIN_LEFT, y, { width: CONTENT_WIDTH });
        doc.restore();
        y += 15;
      }

      // Render Body text
      if (parsedBody) {
        const paragraphs = parsedBody.split('\n');
        for (const p of paragraphs) {
          if (p.trim()) {
            doc.save();
            doc.fontSize(8.5).font('Helvetica').fillColor('#555555');
            doc.text(p.trim(), MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'justify', lineGap: 1 });
            const h = doc.heightOfString(p.trim(), { width: CONTENT_WIDTH, lineGap: 1 });
            doc.restore();
            y += h + 6;
          }
        }
      }

      // Render Terms
      if (parsedTerms) {
        doc.save();
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0C7C84');
        doc.text('Terms & Conditions', MARGIN_LEFT, y);
        doc.restore();
        y += 14;

        const termsList = parsedTerms.split('\n');
        for (const t of termsList) {
          if (t.trim()) {
            doc.save();
            doc.fontSize(7.5).font('Helvetica').fillColor('#555555');
            doc.text(t.trim(), MARGIN_LEFT + 10, y, { width: CONTENT_WIDTH - 10, align: 'justify' });
            const h = doc.heightOfString(t.trim(), { width: CONTENT_WIDTH - 10 });
            doc.restore();
            y += h + 4;
          }
        }
        y += 6;
      }

      // Render Notes
      if (parsedNotes) {
        doc.save();
        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#888888');
        doc.text(parsedNotes, MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'center' });
        doc.restore();
        y += 12;
      }

      // Render Signatory section
      if (parsedSignatory || fields.hasCompanySeal) {
        y += 10;
        let signatureBuffer = null;
        let stampBuffer = null;
        const { fetchImageBuffer, drawAuthorizedSignOff } = require('../services/agreementGenerator');
        if (config.digitalSignature) {
          signatureBuffer = await fetchImageBuffer(config.digitalSignature);
        }
        if (config.companySeal) {
          stampBuffer = await fetchImageBuffer(config.companySeal);
        }
        y = await drawAuthorizedSignOff(doc, y, config, signatureBuffer, stampBuffer);
      }



      return y;
    });

    res.contentType('application/pdf');
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
