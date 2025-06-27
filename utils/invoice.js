const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateInvoicePDF = (user, transaction, callback) => {
  const doc = new PDFDocument();
  const fileName = `invoice_${Date.now()}.pdf`;
  const filePath = path.join(__dirname, '..', 'invoices', fileName);

  // Ensure invoices folder exists
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(20).text('Refine AI - Invoice', { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).text(`Invoice ID: ${transaction.txnId}`);
  doc.text(`Date: ${new Date(transaction.createdAt).toLocaleString()}`);
  doc.text(`User Email: ${user.email}`);
  doc.text(`Plan: ${transaction.plan}`);
  doc.text(`Credits: ${transaction.plan === 'elite' ? 2500 : 1000}`);
  doc.text(`Amount: ${transaction.amount} ${transaction.currency}`);
  doc.text(`Gateway: ${transaction.gateway}`);
  doc.text(`Status: ${transaction.status}`);
  
  doc.end();

  stream.on('finish', () => callback(filePath));
};

module.exports = { generateInvoicePDF };
