const QRCode = require('qrcode');

exports.handler = async (event, context) => {
  try {
    const { uuid } = event.queryStringParameters;

    if (!uuid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'UUID parameter is required' }),
      };
    }

    // Get the site URL from Netlify environment or default to localhost for development
    const siteUrl = process.env.URL || 'http://localhost:3000';

    // Create the URL for the QR code
    const qrUrl = `${siteUrl}/claim/${uuid}`;

    // Generate QR code as buffer
    const qrBuffer = await QRCode.toBuffer(qrUrl, {
      type: 'png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
      body: qrBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('QR Code generation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate QR code' }),
    };
  }
};
