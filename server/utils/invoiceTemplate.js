const generateCustomerInvoiceHTML = (invoice) => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
      <title>Invoice ${invoice.invoiceNo}</title>
    </head>
    <body class="bg-gray-50 p-8">
      <div class="max-w-4xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        <!-- Header -->
        <div class="bg-blue-600 p-6 text-white">
          <div class="flex justify-between items-center">
            <div>
              <h1 class="text-2xl font-bold">Raj Electrical Service</h1>
              <p class="text-blue-100">123 Electric Avenue, Mumbai</p>
            </div>
            <div class="text-right">
              <h2 class="text-2xl font-bold">INVOICE</h2>
              <p class="text-blue-100">#${invoice.invoiceNo}</p>
            </div>
          </div>
        </div>

        <!-- Invoice Info -->
        <div class="p-6 grid grid-cols-2 gap-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-700">Bill To:</h3>
            <p class="font-medium">${invoice.customer.name}</p>
            <p>${invoice.customer.email}</p>
            <p>${invoice.customer.phone}</p>
            <p>${invoice.customer.address.street}, ${invoice.customer.address.city}</p>
          </div>
          <div class="text-right">
            <h3 class="text-lg font-semibold text-gray-700">Service By:</h3>
            <p class="font-medium">${invoice.provider.name}</p>
            <p>${invoice.provider.email}</p>
            <p>${invoice.provider.phone}</p>
            <p>${invoice.provider.address.street}, ${invoice.provider.address.city}</p>

            <p>${new Date(invoice.generatedAt).toLocaleDateString()}</p>
          </div>
        </div>

        <!-- Service Details -->
        <div class="px-6 pb-4">
          <h3 class="text-lg font-semibold text-gray-700 border-b pb-2">Service Details</h3>
          <div class="mt-4">
            <p><span class="font-medium">Service:</span> ${invoice.service.title}</p>
            <p><span class="font-medium">Category:</span> ${invoice.service.category}</p>
            <p><span class="font-medium">Duration:</span> ${invoice.service.duration} hours</p>
            <p><span class="font-medium">Description:</span> ${invoice.service.description}</p>
          </div>
        </div>

        <!-- Products Table -->
        ${invoice.productsUsed.length > 0 ? `
        <div class="px-6 pb-4">
          <h3 class="text-lg font-semibold text-gray-700 border-b pb-2">Products Used</h3>
          <div class="mt-4 overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                ${invoice.productsUsed.map(product => `
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap">${product.name}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-right">${product.quantity}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-right">₹${product.rate.toFixed(2)}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-right">₹${product.total.toFixed(2)}</td>
                </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        ` : ''}

        <!-- Payment Summary -->
        <div class="px-6 pb-6">
          <h3 class="text-lg font-semibold text-gray-700 border-b pb-2">Payment Summary</h3>
          <div class="mt-4 grid grid-cols-2 gap-4 max-w-md ml-auto">
            <p class="font-medium">Service Amount:</p>
            <p class="text-right">₹${invoice.serviceAmount.toFixed(2)}</p>

            ${invoice.productsUsed.length > 0 ? `
            <p class="font-medium">Products Total:</p>
            <p class="text-right">₹${invoice.productsUsed.reduce((sum, p) => sum + p.total, 0).toFixed(2)}</p>
            ` : ''}

            ${invoice.tax > 0 ? `
            <p class="font-medium">Tax:</p>
            <p class="text-right">₹${invoice.tax.toFixed(2)}</p>
            ` : ''}

            ${invoice.discount > 0 ? `
            <p class="font-medium">Discount:</p>
            <p class="text-right">-₹${invoice.discount.toFixed(2)}</p>
            ` : ''}

            <p class="font-medium border-t pt-2">Total Amount:</p>
            <p class="text-right border-t pt-2 font-bold">₹${invoice.totalAmount.toFixed(2)}</p>

            <p class="font-medium">Payment Status:</p>
            <p class="text-right">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium 
                ${invoice.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
            invoice.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'}">
                ${invoice.paymentStatus}
              </span>
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div class="bg-gray-100 p-4 text-center text-gray-600 text-sm">
          <p>Thank you for your business!</p>
          <p class="mt-1">If you have any questions about this invoice, please contact our support team.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = { generateCustomerInvoiceHTML };