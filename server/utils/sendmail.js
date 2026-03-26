const nodemailer = require('nodemailer');

/**
 * Reusable mail sender utility.
 *
 * @param {Object} options
 * @param {string} options.to       - Recipient email address
 * @param {string} options.subject  - Email subject line
 * @param {string} options.html     - HTML body of the email
 */
const sendMail = async ({ to, subject, html }) => {
  const port = Number(process.env.EMAIL_PORT) || 587;

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: port === 465, // true for SSL (465), false for STARTTLS (587)
    auth: {
      user: process.env.EMAIL_SENDER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Support Team" <${process.env.EMAIL_SENDER}>`,
    to,
    subject,
    html,
  });
};

module.exports = { sendMail };
