const PDFDocument = require('pdfkit');
const { SystemConfig } = require('../models/SystemSetting');
const Template = require('../models/Template');
const Handlebars = require('handlebars');
const cloudinary = require('./cloudinary');


// ─── Brand Colors ───────────────────────────────────────────────
const TEAL = '#0C7C84';
const TEAL_DARK = '#095F65';
const ORANGE = '#E8792B';
const ORANGE_LIGHT = '#F5A623';
const WHITE = '#FFFFFF';
const GRAY_TEXT = '#555555';
const GRAY_LIGHT = '#888888';
const BLACK = '#222222';

// ─── Page Constants ─────────────────────────────────────────────
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

/**
 * Fetches an image from URL and returns as Buffer.
 */
const fetchImageBuffer = async (url) => {
  if (!url) return null;
  try {
    const axios = require('axios');
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    return Buffer.from(response.data, 'binary');
  } catch (e) {
    console.error('Failed to fetch image:', e.message);
    return null;
  }
};

/**
 * Draw decorative corner accent (top-right triangle)
 */
const drawCornerAccent = (doc) => {
  // Large teal triangle
  doc.save();
  doc.moveTo(PAGE_WIDTH - 80, 0)
    .lineTo(PAGE_WIDTH, 0)
    .lineTo(PAGE_WIDTH, 80)
    .closePath()
    .fill(TEAL);
  doc.restore();

  // Small orange triangle
  doc.save();
  doc.moveTo(PAGE_WIDTH - 50, 0)
    .lineTo(PAGE_WIDTH, 0)
    .lineTo(PAGE_WIDTH, 50)
    .closePath()
    .fill(ORANGE);
  doc.restore();
};

// ─── Vector Icon Drawers ─────────────────────────────────────────

const drawPhoneIcon = (doc, cx, cy) => {
  doc.save();
  doc.translate(cx + 0.8, cy + 0.6);
  doc.lineWidth(1.1).strokeColor(WHITE);
  doc.moveTo(-2.5, -1.5)
    .lineTo(-1.5, -2.5)
    .lineTo(-0.5, -1.5)
    .lineTo(-1, -1)
    .bezierCurveTo(-0.2, -0.2, 0.8, 0.8, 1.5, 1.5)
    .lineTo(2, 1)
    .lineTo(3, 2)
    .lineTo(2, 3)
    .bezierCurveTo(0.5, 3, -2.5, 0, -2.5, -1.5)
    .stroke();
  doc.restore();
};

const drawMailIcon = (doc, cx, cy) => {
  doc.save();
  doc.translate(cx + 0.8, cy + 0.6);
  doc.lineWidth(1).strokeColor(WHITE);
  doc.rect(-4.5, -3, 9, 6).stroke();
  doc.moveTo(-4.5, -3).lineTo(0, 0.5).lineTo(4.5, -3).stroke();
  doc.restore();
};

const drawGlobeIcon = (doc, cx, cy) => {
  doc.save();
  doc.translate(cx, cy);
  doc.lineWidth(1).strokeColor(WHITE);
  doc.circle(0, 0, 4.5).stroke();
  doc.moveTo(-4.5, 0).lineTo(4.5, 0).stroke();
  doc.moveTo(0, -4.5).lineTo(0, 4.5).stroke();
  doc.restore();
};

const drawPinIcon = (doc, cx, cy) => {
  doc.save();
  doc.translate(cx + 0.8, cy + 0.3);
  doc.fillColor(WHITE).strokeColor(WHITE).lineWidth(0.8);
  doc.circle(0, -1, 2).fill();
  doc.moveTo(-2, -1)
    .bezierCurveTo(-2, 1, 0, 3.5, 0, 3.5)
    .bezierCurveTo(0, 3.5, 2, 1, 2, -1)
    .closePath()
    .fill();
  doc.fillColor(TEAL).circle(0, -1, 0.8).fill();
  doc.restore();
};

const drawLightningIcon = (doc, cx, cy) => {
  doc.save();
  doc.translate(cx - 3, cy - 5.5);
  doc.fillColor(WHITE);
  doc.moveTo(3.5, 0)
    .lineTo(0.5, 6)
    .lineTo(3, 6)
    .lineTo(1.5, 11)
    .lineTo(5.5, 4.5)
    .lineTo(3, 4.5)
    .closePath()
    .fill();
  doc.restore();
};

const drawWrenchIcon = (doc, cx, cy) => {
  doc.save();
  doc.translate(cx - 4, cy - 4);
  doc.lineWidth(1.2).strokeColor(WHITE).fillColor(WHITE);
  doc.moveTo(1, 7).lineTo(5, 3).lineWidth(2.2).stroke();
  doc.circle(6, 2, 2.2).fill();
  doc.lineWidth(1.2).strokeColor(TEAL).moveTo(5, 1).lineTo(7, 3).stroke();
  doc.restore();
};

const drawShieldIcon = (doc, cx, cy) => {
  doc.save();
  doc.translate(cx - 4, cy - 4.5);
  doc.fillColor(WHITE);
  doc.moveTo(0, 0)
    .lineTo(8, 0)
    .lineTo(8, 3.5)
    .bezierCurveTo(8, 6.5, 4, 9, 4, 9)
    .bezierCurveTo(4, 9, 0, 6.5, 0, 3.5)
    .closePath()
    .fill();
  doc.restore();
};

const drawGearIcon = (doc, cx, cy) => {
  doc.save();
  doc.translate(cx, cy);
  doc.lineWidth(1.2).strokeColor(WHITE);
  doc.circle(0, 0, 3.5).stroke();
  for (let a = 0; a < 360; a += 45) {
    const rad = (a * Math.PI) / 180;
    doc.moveTo(Math.cos(rad) * 3, Math.sin(rad) * 3)
      .lineTo(Math.cos(rad) * 5, Math.sin(rad) * 5)
      .stroke();
  }
  doc.circle(0, 0, 1.2).stroke();
  doc.restore();
};

/**
 * Draw the professional letterhead header
 */
const drawLetterheadHeader = async (doc, config, logoBuffer) => {
  drawCornerAccent(doc);

  let logoEndX = MARGIN_LEFT;

  // Company Logo
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, MARGIN_LEFT, 25, { width: 65, height: 65 });
      logoEndX = MARGIN_LEFT + 75;
    } catch (e) {
      console.error('Failed to embed logo:', e.message);
    }
  }

  // Company Name
  doc.save();
  doc.fontSize(22).font('Helvetica-Bold').fillColor(TEAL);
  doc.text(config.companyName || 'Company Name', logoEndX, 28, { width: 250 });
  doc.restore();

  // Tagline
  if (config.tagline) {
    doc.save();
    doc.fontSize(7).font('Helvetica').fillColor(TEAL);
    const taglineY = 68;
    doc.moveTo(logoEndX, taglineY + 4).lineTo(logoEndX + 70, taglineY + 4).lineWidth(1.5).strokeColor(ORANGE).stroke();
    doc.text(config.tagline.toUpperCase(), logoEndX + 75, taglineY, { width: 200 });
    doc.restore();
  }

  // Right side: Contact Info Panel
  const panelX = 370;
  const panelStartY = 25;
  const lineH = 16;

  const contactItems = [];
  if (config.phone) contactItems.push({ drawIcon: drawPhoneIcon, label: config.phone });
  if (config.email) contactItems.push({ drawIcon: drawMailIcon, label: config.email });
  if (config.website) contactItems.push({ drawIcon: drawGlobeIcon, label: config.website });
  if (config.address) contactItems.push({ drawIcon: drawPinIcon, label: config.address });

  contactItems.forEach((item, i) => {
    const y = panelStartY + (i * lineH);

    doc.save();
    doc.circle(panelX + 6, y + 5, 6).fill(TEAL);
    item.drawIcon(doc, panelX + 6, y + 5);
    doc.restore();

    doc.save();
    doc.fontSize(8).font('Helvetica').fillColor(GRAY_TEXT);
    doc.text(item.label, panelX + 18, y + 1, { width: 180 });
    doc.restore();
  });

  // Separator line
  const sepY = 95;
  doc.save();
  doc.moveTo(MARGIN_LEFT, sepY).lineTo(PAGE_WIDTH - MARGIN_RIGHT, sepY).lineWidth(0.5).strokeColor(GRAY_LIGHT).stroke();
  doc.restore();

  return sepY + 10;
};

/**
 * Draw watermark
 */
const drawWatermark = (doc, logoBuffer) => {
  if (!logoBuffer) return;
  try {
    doc.save();
    doc.opacity(0.06);
    const wmSize = 280;
    doc.image(logoBuffer, (PAGE_WIDTH - wmSize) / 2, (PAGE_HEIGHT - wmSize) / 2 - 30, { width: wmSize, height: wmSize });
    doc.restore();
  } catch (e) {
    console.error('Failed to draw watermark:', e.message);
  }
};

/**
 * Draw the professional footer
 */
const drawFooter = (doc, config) => {
  const footerH = 55;
  const footerY = PAGE_HEIGHT - footerH;

  doc.save();
  doc.rect(0, footerY, PAGE_WIDTH, footerH).fill(TEAL_DARK);
  doc.restore();

  const categories = [
    { drawIcon: drawLightningIcon, label: 'ELECTRICAL\nINSTALLATION' },
    { drawIcon: drawWrenchIcon, label: 'REPAIR &\nMAINTENANCE' },
    { drawIcon: drawShieldIcon, label: 'SAFETY\nSOLUTIONS' },
    { drawIcon: drawGearIcon, label: 'INDUSTRIAL\nSERVICES' }
  ];

  const catStartX = 30;
  const catSpacing = 90;

  categories.forEach((cat, i) => {
    const x = catStartX + (i * catSpacing);
    const y = footerY + 8;

    doc.save();
    doc.circle(x + 12, y + 10, 10).fillAndStroke(ORANGE, ORANGE);
    cat.drawIcon(doc, x + 12, y + 10);
    doc.restore();

    doc.save();
    doc.fontSize(5).font('Helvetica-Bold').fillColor(WHITE);
    doc.text(cat.label, x - 5, y + 24, { width: 50, align: 'center', lineGap: 1 });
    doc.restore();

    if (i < categories.length - 1) {
      doc.save();
      doc.moveTo(x + catSpacing - 20, footerY + 10).lineTo(x + catSpacing - 20, footerY + footerH - 10)
        .lineWidth(0.5).strokeColor(TEAL).stroke();
      doc.restore();
    }
  });

  const badgeX = 410;
  const badgeY = footerY + 8;
  const badgeW = 165;
  const badgeH = 38;

  doc.save();
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 5).fill(TEAL);
  doc.restore();

  doc.save();
  doc.fontSize(10).font('Helvetica-Oblique').fillColor(ORANGE_LIGHT);
  doc.text('Powering Your World', badgeX + 10, badgeY + 5, { width: badgeW - 20, align: 'center' });
  doc.restore();

  doc.save();
  doc.fontSize(8).font('Helvetica-Bold').fillColor(WHITE);
  doc.text('SAFELY & EFFICIENTLY', badgeX + 10, badgeY + 22, { width: badgeW - 20, align: 'center' });
  doc.restore();
};

/**
 * Draw Ref No and Date row
 */
const drawRefDateRow = (doc, y, refNo) => {
  doc.save();
  doc.fontSize(8.5).font('Helvetica').fillColor(BLACK);
  doc.text(`Ref. No. : ${refNo || '_______________'}`, MARGIN_LEFT, y);
  doc.text(`Date : ${new Date().toLocaleDateString('en-IN')}`, 0, y, { width: PAGE_WIDTH - MARGIN_RIGHT, align: 'right' });
  doc.restore();
  return y + 16;
};

/**
 * Draw a section title with teal underline
 */
const drawSectionTitle = (doc, title, y) => {
  doc.save();
  doc.fontSize(10).font('Helvetica-Bold').fillColor(TEAL);
  doc.text(title, MARGIN_LEFT, y);
  const textWidth = doc.widthOfString(title);
  doc.moveTo(MARGIN_LEFT, y + 13).lineTo(MARGIN_LEFT + textWidth + 10, y + 13)
    .lineWidth(1.2).strokeColor(ORANGE).stroke();
  doc.restore();
  return y + 18;
};

/**
 * Draw a key-value info line
 */
const drawInfoLine = (doc, label, value, y) => {
  doc.save();
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(BLACK);
  doc.text(`${label}: `, MARGIN_LEFT + 5, y, { continued: true });
  doc.font('Helvetica').fillColor(GRAY_TEXT);
  doc.text(value || 'N/A');
  doc.restore();
  return y + 11;
};

/**
 * Draw body paragraph text
 */
const drawParagraph = (doc, text, y, options = {}) => {
  doc.save();
  doc.fontSize(options.fontSize || 8).font(options.font || 'Helvetica').fillColor(options.color || GRAY_TEXT);
  doc.text(text, MARGIN_LEFT + (options.indent || 0), y, {
    width: CONTENT_WIDTH - (options.indent || 0),
    align: options.align || 'justify',
    lineGap: 1
  });
  const h = doc.heightOfString(text, {
    width: CONTENT_WIDTH - (options.indent || 0),
    lineGap: 1
  });
  doc.restore();
  return y + h + (options.spacing || 4);
};

/**
 * Draw authorization signatures / stamps side-by-side (NO BORDERS)
 */
const drawAuthorizedSignOff = async (doc, y, config, signatureBuffer, stampBuffer) => {
  const boxWidth = 180;
  const boxHeight = 65;
  const startX = MARGIN_LEFT + 10;
  const spacing = 40;

  doc.save();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(TEAL);
  doc.text('Authorized Signature', startX, y);
  doc.restore();

  const signBoxY = y + 12;
  if (signatureBuffer) {
    try {
      doc.save();
      doc.image(signatureBuffer, startX, signBoxY, { fit: [boxWidth, boxHeight], align: 'left', valign: 'center' });
      doc.restore();
    } catch (e) {
      console.error('Failed to embed authorized signature:', e.message);
    }
  } else {
    doc.save();
    doc.fontSize(8).fillColor(GRAY_LIGHT).text('[Signature]', startX, signBoxY + 20, { width: boxWidth });
    doc.restore();
  }

  const stampX = startX + boxWidth + spacing;
  doc.save();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(TEAL);
  doc.text('Company Stamp', stampX, y);
  doc.restore();

  if (stampBuffer) {
    try {
      doc.save();
      doc.image(stampBuffer, stampX, signBoxY, { fit: [boxWidth, boxHeight], align: 'left', valign: 'center' });
      doc.restore();
    } catch (e) {
      console.error('Failed to embed company stamp:', e.message);
    }
  } else {
    doc.save();
    doc.fontSize(8).fillColor(GRAY_LIGHT).text('[Official Stamp]', stampX, signBoxY + 20, { width: boxWidth });
    doc.restore();
  }

  return signBoxY + boxHeight + 10;
};


/**
 * Shared layout runner to draw the same letterhead UI for all documents.
 */
const generateLetterheadDocument = async (provider, refPrefix, drawContentCallback) => {
  return new Promise(async (resolve, reject) => {
    try {
      const config = await SystemConfig.findOne() || { companyName: 'Raj Electrical Services' };
      const logoBuffer = await fetchImageBuffer(config.logo);
      const signatureBuffer = null;
      const stampBuffer = null;

      const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      // ─── Apply Branding Watermark ───
      drawWatermark(doc, logoBuffer);

      // ─── Header ───
      let y = await drawLetterheadHeader(doc, config, logoBuffer);

      // ─── Ref & Date ───
      y = drawRefDateRow(doc, y, `${refPrefix}-${provider.providerId || provider._id}`);

      // ─── Run custom content callback ───
      y = await drawContentCallback(doc, y, config, signatureBuffer, stampBuffer);

      // ─── Apply Footer on all pages ───
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        drawFooter(doc, config);
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
};

// ─── Dynamic Template Helper Utilities ────────────────────────────────
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

const getContext = async (provider, customVars = {}) => {
  const config = await SystemConfig.findOne() || { companyName: 'Raj Electrical Services' };
  
  const cAddr = provider.currentAddress || {};
  const currentAddressStr = [cAddr.houseNumber, cAddr.street, cAddr.landmark, cAddr.villageCity, cAddr.district, cAddr.state]
    .filter(Boolean).join(', ') + (cAddr.pincode ? ` - ${cAddr.pincode}` : '');

  const pAddr = provider.permanentAddress || {};
  const permanentAddressStr = [pAddr.houseNumber, pAddr.street, pAddr.landmark, pAddr.villageCity, pAddr.district, pAddr.state]
    .filter(Boolean).join(', ') + (pAddr.pincode ? ` - ${pAddr.pincode}` : '');

  return {
    companyName: config.companyName || 'Raj Electrical Services',
    companyAddress: config.address || 'N/A',
    companyEmail: config.email || 'support@rajelectrical.com',
    companyPhone: config.phone || 'N/A',
    companyWebsite: config.website || 'N/A',
    providerName: provider.name || 'N/A',
    providerId: provider.providerId || 'PENDING',
    providerEmail: provider.email || 'N/A',
    providerPhone: provider.phone || 'N/A',
    providerCategory: provider.category || 'N/A',
    providerStatus: provider.status || 'N/A',
    approvalDate: new Date().toLocaleDateString('en-IN'),
    agreementDate: new Date().toLocaleDateString('en-IN'),
    documentNumber: provider.providerId ? `AGR-${provider.providerId}` : 'PENDING',
    verificationStatus: provider.kycDetails?.verificationStatus || 'unverified',
    aadhaarNumberMasked: maskAadhaar(provider.kycDetails?.aadhaarNumber),
    panNumberMasked: maskPan(provider.kycDetails?.panNumber),
    currentAddress: currentAddressStr || 'N/A',
    permanentAddress: permanentAddressStr || 'N/A',
    bankName: provider.bankDetails?.bankName || 'N/A',
    accountNumberMasked: maskBankAccount(provider.bankDetails?.accountNumber),
    ifsc: provider.bankDetails?.ifsc || 'N/A',
    branch: provider.bankDetails?.branchName || 'N/A',
    city: cAddr.villageCity || 'N/A',
    state: cAddr.state || 'N/A',
    adminName: 'Administrator',
    generatedDate: new Date().toLocaleDateString('en-IN'),
    generatedTime: new Date().toLocaleTimeString('en-IN'),
    agreementVersion: provider.legalAcceptance?.version || '1.0',
    supportEmail: config.email || 'support@rajelectrical.com',
    supportPhone: config.phone || 'N/A',
    currentYear: new Date().getFullYear(),
    ...customVars
  };
};

const stripHtml = (html) => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '') // Strip all other HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
};

const drawDynamicTemplate = async (doc, y, config, provider, templateKey, customVars = {}) => {
  const template = await Template.findOne({ key: templateKey });
  if (!template) return null;

  const activeVersion = template.versions.find(v => v.isActive);
  if (!activeVersion) return null;

  const context = await getContext(provider, customVars);
  const compile = (text) => {
    if (!text) return '';
    try {
      return Handlebars.compile(text)(context);
    } catch (err) {
      return text;
    }
  };

  const parsedTitle = stripHtml(compile(activeVersion.title));
  const parsedSubtitle = stripHtml(compile(activeVersion.subtitle));
  const parsedHeader = stripHtml(compile(activeVersion.headerText));
  const parsedBody = stripHtml(compile(activeVersion.body));
  const parsedTerms = stripHtml(compile(activeVersion.terms));
  const parsedNotes = stripHtml(compile(activeVersion.notes));
  const parsedSignatory = stripHtml(compile(activeVersion.authorizedSignatory));


  const MARGIN_LEFT = 50;
  const CONTENT_WIDTH = 595.28 - 100;
  
  if (parsedTitle) {
    doc.save();
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#0C7C84');
    doc.text(parsedTitle, MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'center' });
    doc.restore();
    y += 18;
  }

  if (parsedSubtitle) {
    doc.save();
    doc.fontSize(9.5).font('Helvetica-Oblique').fillColor('#555555');
    doc.text(parsedSubtitle, MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'center' });
    doc.restore();
    y += 14;
  }

  doc.save();
  doc.moveTo(MARGIN_LEFT, y).lineTo(595.28 - 50, y).lineWidth(0.5).strokeColor('#888888').stroke();
  doc.restore();
  y += 12;

  if (parsedHeader) {
    doc.save();
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#222222');
    doc.text(parsedHeader, MARGIN_LEFT, y, { width: CONTENT_WIDTH });
    doc.restore();
    y += 15;
  }

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

  if (parsedNotes) {
    doc.save();
    doc.fontSize(7).font('Helvetica-Oblique').fillColor('#888888');
    doc.text(parsedNotes, MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'center' });
    doc.restore();
    y += 12;
  }

  if (parsedSignatory || activeVersion.hasCompanySeal) {
    y += 10;
    let signatureBuffer = null;
    let stampBuffer = null;
    if (config.digitalSignature) {
      signatureBuffer = await fetchImageBuffer(config.digitalSignature);
    }
    if (config.companySeal) {
      stampBuffer = await fetchImageBuffer(config.companySeal);
    }
    y = await drawAuthorizedSignOff(doc, y, config, signatureBuffer, stampBuffer);
  }


  return y;
};

/**
 * Uploads PDF Buffer to Cloudinary as raw file.
 */
const uploadPdfBuffer = (buffer, folder, publicId) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'raw', folder, public_id: publicId, format: 'pdf' },
      (error, result) => error ? reject(error) : resolve(result)
    );
    stream.end(buffer);
  });
};

// ═══════════════════════════════════════════════════════════════════
//  Generate PDF Agreement
// ═══════════════════════════════════════════════════════════════════
const generateAgreement = async (provider) => {
  return generateLetterheadDocument(provider, 'AGR', async (doc, y, config, signatureBuffer, stampBuffer) => {
    // Check and draw dynamic template if active
    const dynamicY = await drawDynamicTemplate(doc, y, config, provider, 'agreement');
    if (dynamicY !== null) return dynamicY;

    // Fallback to original hardcoded layout
    doc.save();
    doc.fontSize(13).font('Helvetica-Bold').fillColor(TEAL);
    doc.text('PROVIDER SERVICE AGREEMENT', MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'center' });
    doc.restore();
    y += 18;

    y = drawSectionTitle(doc, 'Provider Details', y);
    y = drawInfoLine(doc, 'Full Name', provider.name, y);
    y = drawInfoLine(doc, 'Email', provider.email, y);
    y = drawInfoLine(doc, 'Phone', provider.phone, y);
    y = drawInfoLine(doc, 'Provider ID', provider.providerId || 'PENDING', y);
    y = drawInfoLine(doc, 'Date of Birth', provider.dateOfBirth ? new Date(provider.dateOfBirth).toLocaleDateString('en-IN') : 'N/A', y);

    if (provider.currentAddress) {
      y = drawSectionTitle(doc, 'Address Details', y);
      const cAddr = provider.currentAddress;
      const addrParts = [cAddr.houseNumber, cAddr.street, cAddr.landmark, cAddr.villageCity, cAddr.district, cAddr.state].filter(Boolean);
      const fullAddr = addrParts.join(', ') + (cAddr.pincode ? ` - ${cAddr.pincode}` : '');
      y = drawInfoLine(doc, 'Current Address', fullAddr, y);
    }

    y = drawSectionTitle(doc, 'Self Declaration & Legal Consent', y);
    const declarations = [
      '1. The provider declares all the information, identity documents (Aadhaar, PAN) and bank details submitted are genuine and verifiable.',
      '2. The provider agrees to abide by the service SLAs, professional conduct guidelines, and customer safety rules of the platform.',
      '3. The provider consents to background verification checks and security vetting as required by the platform.',
      '4. Any misrepresentation of information may result in immediate termination of this agreement and legal action.'
    ];
    for (const decl of declarations) {
      y = drawParagraph(doc, decl, y, { indent: 10 });
    }

    y = drawSectionTitle(doc, 'Digital Consent Log', y);
    y = drawInfoLine(doc, 'Consent Accepted', 'Yes (Self-Declaration, Agreement, Terms, and Privacy accepted)', y);
    y = drawInfoLine(doc, 'Consent Version', provider.legalAcceptance?.version || '1.0', y);
    y = drawInfoLine(doc, 'Consent Timestamp', provider.legalAcceptance?.acceptedAt ? new Date(provider.legalAcceptance.acceptedAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN'), y);
    y = drawInfoLine(doc, 'IP Address', provider.legalAcceptance?.ipAddress || 'N/A', y);
    y = drawInfoLine(doc, 'User Agent', provider.legalAcceptance?.userAgent || 'N/A', y);

    y = drawSectionTitle(doc, 'Provider Digital Signature', y);
    y = drawInfoLine(doc, 'Signed Name', provider.digitalSignature?.signedName || provider.name, y);
    
    const signatureImgY = y;
    if (provider.digitalSignature?.signatureUrl) {
      try {
        const sigBuffer = await fetchImageBuffer(provider.digitalSignature.signatureUrl);
        if (sigBuffer) {
          doc.save();
          doc.image(sigBuffer, MARGIN_LEFT + 220, signatureImgY - 15, { width: 120, height: 40 });
          doc.restore();
        }
      } catch (e) {
        console.error(e);
      }
    }
    y = drawInfoLine(doc, 'Signing Device', provider.digitalSignature?.deviceInfo || 'N/A', y);
    y += 10;

    y = await drawAuthorizedSignOff(doc, y, config, signatureBuffer, stampBuffer);

    doc.save();
    doc.fontSize(6.5).font('Helvetica-Oblique').fillColor(GRAY_LIGHT);
    doc.text(
      'This document is system-generated from secure database records and is legally binding. All provider profile changes require re-execution of this agreement.',
      MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'center' }
    );
    doc.restore();
    return y;
  });
};

// ═══════════════════════════════════════════════════════════════════
//  Generate PDF Approval Letter
// ═══════════════════════════════════════════════════════════════════
const generateApprovalLetter = async (provider, remarks = '') => {
  return generateLetterheadDocument(provider, 'APL', async (doc, y, config, signatureBuffer, stampBuffer) => {
    // Check and draw dynamic template if active
    const dynamicY = await drawDynamicTemplate(doc, y, config, provider, 'approval_letter', { reason: remarks });
    if (dynamicY !== null) return dynamicY;

    // Fallback to original hardcoded layout
    doc.save();
    doc.fontSize(13).font('Helvetica-Bold').fillColor(TEAL);
    doc.text('OFFICIAL PROVIDER APPROVAL LETTER', MARGIN_LEFT, y, { width: CONTENT_WIDTH, align: 'center' });
    doc.restore();
    y += 18;

    y = drawInfoLine(doc, 'Date', new Date().toLocaleDateString('en-IN'), y);
    y = drawInfoLine(doc, 'Provider ID', provider.providerId || 'PENDING', y);
    y += 5;

    doc.save();
    doc.fontSize(9).font('Helvetica-Bold').fillColor(BLACK);
    doc.text('To,', MARGIN_LEFT, y);
    doc.restore();
    y += 12;

    doc.save();
    doc.fontSize(8.5).font('Helvetica').fillColor(GRAY_TEXT);
    doc.text(provider.name, MARGIN_LEFT + 5, y);
    y += 11;
    doc.text(`Email: ${provider.email}`, MARGIN_LEFT + 5, y);
    y += 11;
    doc.text(`Phone: ${provider.phone}`, MARGIN_LEFT + 5, y);
    doc.restore();
    y += 15;

    doc.save();
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(TEAL);
    doc.text('Subject: Account Activation and Platform Approval', MARGIN_LEFT, y);
    doc.moveTo(MARGIN_LEFT, y + 13).lineTo(MARGIN_LEFT + 250, y + 13).lineWidth(1.2).strokeColor(ORANGE).stroke();
    doc.restore();
    y += 18;

    y = drawParagraph(doc, `Dear ${provider.name},`, y, { font: 'Helvetica-Bold', color: BLACK });

    y = drawParagraph(doc, `We are pleased to inform you that your application to join ${config.companyName || 'the platform'} as a partner provider has been reviewed and approved. Your profile verification is complete, and your account is now fully active on our platform.`, y, { spacing: 8 });

    y = drawParagraph(doc, 'You are now authorized to:', y, { font: 'Helvetica-Bold', color: BLACK, spacing: 4 });

    const privileges = [
      '•  Receive and accept service bookings from customers',
      '•  Provide professional services to clients on our platform',
      '•  Process payments and track earnings through your dashboard',
      '•  Access all provider tools and features'
    ];
    for (const priv of privileges) {
      y = drawParagraph(doc, priv, y, { indent: 15, spacing: 2 });
    }
    y += 4;

    y = drawParagraph(doc, 'Please ensure the highest standards of service quality and professionalism at all times. Your conduct reflects on the reputation of our platform and community of trusted providers.', y, { spacing: 8 });

    if (remarks) {
      y = drawSectionTitle(doc, 'Administrator Remarks', y);
      y = drawParagraph(doc, remarks, y, { indent: 5, spacing: 8 });
    }

    y = drawParagraph(doc, 'Thank you for choosing to partner with us. We wish you great success and look forward to a long-lasting and mutually beneficial association.', y, { spacing: 10 });

    y += 5;

    y = await drawAuthorizedSignOff(doc, y, config, signatureBuffer, stampBuffer);
    return y;
  });
};

// Generic dynamic PDF generator for other/future templates
const generatePdfFromTemplate = async (templateKey, provider, customVars = {}) => {
  return generateLetterheadDocument(provider, templateKey.toUpperCase().slice(0, 3), async (doc, y, config, signatureBuffer, stampBuffer) => {
    const dynamicY = await drawDynamicTemplate(doc, y, config, provider, templateKey, customVars);
    if (dynamicY !== null) return dynamicY;
    
    // Minimal fallback
    doc.save();
    doc.fontSize(12).text(`Dynamic Document: ${templateKey}`, 50, y);
    doc.restore();
    return y + 30;
  });
};

module.exports = {
  generateAgreement,
  generateApprovalLetter,
  generatePdfFromTemplate,
  uploadPdfBuffer,
  fetchImageBuffer,
  generateLetterheadDocument,
  drawAuthorizedSignOff,
  stripHtml
};

