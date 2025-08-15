const generateCustomerInvoiceHTML = (invoice) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${invoice.invoiceNo}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #eee;
          padding-bottom: 20px;
        }
        .header h1 {
          margin: 0;
          color: #2c3e50;
        }
        .invoice-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .from-to {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }
        .from, .to {
          width: 48%;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f2f2f2;
        }
        .totals {
          float: right;
          width: 300px;
        }
        .totals table {
          width: 100%;
        }
        .footer {
          margin-top: 50px;
          text-align: center;
          font-size: 0.9em;
          color: #777;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>INVOICE</h1>
        <p>Invoice #: ${invoice.invoiceNo}</p>
        <p>Date: ${new Date(invoice.generatedAt).toLocaleDateString()}</p>
      </div>
      
      <div class="from-to">
        <div class="from">
          <h3>From:</h3>
          <p><strong>${invoice.provider.businessName || invoice.provider.name}</strong></p>
          ${invoice.provider.address ? `<p>${invoice.provider.address.street}</p>` : ''}
          ${invoice.provider.address ? `<p>${invoice.provider.address.city}, ${invoice.provider.address.state} ${invoice.provider.address.postalCode}</p>` : ''}
          <p>Phone: ${invoice.provider.phone}</p>
          <p>Email: ${invoice.provider.email}</p>
        </div>
        
        <div class="to">
          <h3>To:</h3>
          <p><strong>${invoice.customer.name}</strong></p>
          ${invoice.customer.address ? `<p>${invoice.customer.address.street}</p>` : ''}
          ${invoice.customer.address ? `<p>${invoice.customer.address.city}, ${invoice.customer.address.state} ${invoice.customer.address.postalCode}</p>` : ''}
          <p>Phone: ${invoice.customer.phone}</p>
          <p>Email: ${invoice.customer.email}</p>
        </div>
      </div>
      
      ${invoice.booking ? `
      <div class="booking-info">
        <h3>Booking Details:</h3>
        <p>Date: ${new Date(invoice.booking.date).toLocaleDateString()}</p>
        <p>Status: ${invoice.booking.status}</p>
      </div>
      ` : ''}
      
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantity</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.invoiceType === 'service' ? `
          <tr>
            <td>${invoice.service.title}</td>
            <td>1</td>
            <td>₹${invoice.serviceAmount.toFixed(2)}</td>
            <td>₹${invoice.serviceAmount.toFixed(2)}</td>
          </tr>
          ` : ''}
          
          ${invoice.productsUsed.map(product => `
          <tr>
            <td>${product.name}${product.description ? `<br><small>${product.description}</small>` : ''}</td>
            <td>${product.quantity}</td>
            <td>₹${product.rate.toFixed(2)}</td>
            <td>₹${product.total.toFixed(2)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="totals">
        <table>
          <tr>
            <th>Subtotal:</th>
            <td>₹${(invoice.serviceAmount + invoice.productsUsed.reduce((sum, p) => sum + p.total, 0)).toFixed(2)}</td>
          </tr>
          ${invoice.tax > 0 ? `
          <tr>
            <th>Tax:</th>
            <td>₹${invoice.tax.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${invoice.discount > 0 ? `
          <tr>
            <th>Discount:</th>
            <td>-₹${invoice.discount.toFixed(2)}</td>
          </tr>
          ` : ''}
          <tr>
            <th>Total:</th>
            <td>₹${invoice.totalAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <th>Payment Status:</th>
            <td>${invoice.paymentStatus.charAt(0).toUpperCase() + invoice.paymentStatus.slice(1)}</td>
          </tr>
        </table>
      </div>
      
      <div style="clear: both;"></div>
      
      ${invoice.notes ? `
      <div class="notes">
        <h3>Notes:</h3>
        <p>${invoice.notes}</p>
      </div>
      ` : ''}
      
      <div class="footer">
        <p>Thank you for your business!</p>
        <p>Please make payments to the account details provided above.</p>
      </div>
    </body>
    </html>
  `;
};

module.exports = { generateCustomerInvoiceHTML };