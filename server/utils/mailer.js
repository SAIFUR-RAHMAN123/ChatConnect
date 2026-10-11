const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendMail = async ({ to, subject, text }) => {
  try {
    const info = await transporter.sendMail({
      from: `"ChatConnect" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });

    console.log('Email sent successfully:', info.messageId);
  } catch (error) {
    console.error('Gmail SMTP error:', error.message);
    throw new Error('Failed to send email');
  }
};

const sendResetEmail = (user, link) =>
  sendMail({
    to: user.email,
    subject: 'Reset your ChatConnect password',
    text:
      `Hi ${user.name},\n\n` +
      `Use the link below to reset your password. ` +
      `It expires in 15 minutes.\n\n` +
      `${link}\n\n` +
      `If you did not request this, you can ignore this email.`,
  });

module.exports = { sendMail, sendResetEmail };