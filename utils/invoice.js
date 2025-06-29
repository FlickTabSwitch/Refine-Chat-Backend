const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateInvoicePDF = (user, transaction, callback) => {
  const doc = new PDFDocument({ margin: 50 });
  const fileName = `invoice_${Date.now()}.pdf`;
  const filePath = path.join(__dirname, '..', 'invoices', fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  doc
    .fillColor('#333')
    .fontSize(22)
    .text('🧾 Refine AI - Invoice', { align: 'center' })
    .moveDown();

  // Invoice Info
  doc
    .fontSize(12)
    .fillColor('#000')
    .text(`Invoice ID: ${transaction.txnId}`)
    .text(`Date: ${new Date(transaction.createdAt).toLocaleString()}`)
    .moveDown();

  // User Info
  doc
    .fontSize(13)
    .fillColor('#444')
    .text('Billed To:', { underline: true })
    .fillColor('#000')
    .text(`${user.email}`)
    .moveDown();

  // Plan & Payment Info
  const planTitle = transaction.plan === 'elite' ? 'Refine Elite' : 'Refine Pro';
  const credits = transaction.plan === 'elite' ? 2500 : 1000;

  doc
    .fontSize(13)
    .fillColor('#444')
    .text('Plan Details:', { underline: true })
    .fillColor('#000')
    .text(`Plan: ${planTitle}`)
    .text(`Credits: ${credits}`)
    .text(`Amount Paid: ${transaction.amount} ${transaction.currency}`)
    .text(`Gateway: ${transaction.gateway.toUpperCase()}`)
    .text(`Status: ${transaction.status}`)
    .moveDown();

  // Footer
  doc
    .fontSize(11)
    .fillColor('#888')
    .text('Thank you for choosing Refine AI!', { align: 'center', lineGap: 10 });

  doc.end();

  stream.on('finish', () => callback(filePath));
};

module.exports = { generateInvoicePDF };
