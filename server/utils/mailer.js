// Sends mail through the Gmail API over HTTPS (port 443).
// Render Free blocks SMTP ports (25/465/587), so Gmail SMTP times out there.
// Needs in env: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER
// Without them (local dev) the email is printed in the server console instead.
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

let cached = { token: null, expiresAt: 0 };

const getAccessToken = async () => {
  if (cached.token && Date.now() < cached.expiresAt - 60000) return cached.token;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Gmail token error: ${data.error_description || data.error || res.status}`);
  }
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return cached.token;
};

const clean = (s) => String(s).replace(/[\r\n]+/g, ' ');
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

const buildRaw = ({ to, subject, text }) => {
  const from = process.env.GMAIL_USER;
  const raw = [
    `From: "ChatConnect" <${clean(from)}>`,
    `To: ${clean(to)}`,
    `Subject: =?UTF-8?B?${b64(clean(subject))}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    b64(text).replace(/(.{76})/g, '$1\r\n'),
  ].join('\r\n');
  return Buffer.from(raw, 'utf8').toString('base64url');
};

const sendMail = async ({ to, subject, text }) => {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !GMAIL_USER) {
    console.log(`\n--- EMAIL (Gmail API not configured, printed here) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n-------------------------------------------------\n`);
    return;
  }
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(SEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: buildRaw({ to, subject, text }) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) cached = { token: null, expiresAt: 0 };
      throw new Error(`Gmail API ${res.status}: ${(data.error && data.error.message) || 'send failed'}`);
    }
    console.log('Email sent successfully:', data.id);
  } catch (error) {
    console.error('Gmail API error:', error.message);
    throw new Error('Failed to send email');
  }
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