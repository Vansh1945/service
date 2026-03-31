const axios = require('axios');

/**
 * Reusable mail sender utility using Brevo API
 *
 * @param {Object} options
 * @param {string} options.to       - Recipient email address
 * @param {string} options.subject  - Email subject line
 * @param {string} options.html     - HTML body of the email
 */
const sendMail = async ({ to, subject, html }) => {
  const apiKey = process.env.SMTP_PASS;
  const senderEmail = process.env.SMTP_USER;

  const payload = {
    sender: { name: "Support Team", email: senderEmail },
    to: [{ email: to }],
    subject: subject,
    htmlContent: html
  };

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

module.exports = { sendMail };
