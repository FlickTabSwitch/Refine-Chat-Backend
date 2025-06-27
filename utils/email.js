// utils/email.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER, // Your Gmail
    pass: process.env.GMAIL_PASS  // App password (not regular Gmail password)
  }
});

// Optional: Verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter config failed:', error);
  } else {
    console.log('✅ Email transporter ready to send mails');
  }
});

module.exports = transporter;
