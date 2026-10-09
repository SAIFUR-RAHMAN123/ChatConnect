const nodemailer = require('nodemailer');

// Configure SMTP in server/.env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM).
// Without SMTP (local development) the email is printed in the server console instead.
const sendMail = async ({ to, subject, text }) => {
  if (!process.env.SMTP_HOST) {
    console.log(`\n--- EMAIL (SMTP not configured, printed here) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n-------------------------------------------------\n`);
    return;
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
};

const sendResetEmail = (user, link) =>
  sendMail({
    to: user.email,
    subject: 'Reset your ChatConnect password',
    text:
      `Hi ${user.name},\n\nUse the link below to reset your password. It expires in 15 minutes.\n\n` +
      `${link}\n\nIf you did not request this, you can ignore this email.`,
  });

module.exports = { sendMail, sendResetEmail };