const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const sendMail = async ({ to, subject, text }) => {
  // Local development: if Resend is not configured,
  // print the email in the terminal.
  if (!resend) {
    console.log(
      `\n--- EMAIL (Resend not configured) ---\n` +
      `To: ${to}\n` +
      `Subject: ${subject}\n\n` +
      `${text}\n` +
      `------------------------------------\n`
    );
    return;
  }

  const { data, error } = await resend.emails.send({
    from: process.env.MAIL_FROM || 'ChatConnect <onboarding@resend.dev>',
    to: [to],
    subject,
    text,
  });

  if (error) {
    console.error('Resend email error:', error.message);
    throw new Error('Failed to send email');
  }

  console.log('Email sent successfully. ID:', data?.id);
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