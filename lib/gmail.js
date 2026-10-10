/**
 * Send a transactional email through the Gmail API.
 * Required server-only env vars:
 * GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN.
 */
export async function sendGmail({ to, subject, text, html }) {
  const { GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_USER || !GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error('Gmail API non configurata: controlla le variabili d’ambiente.');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error('Impossibile autorizzare Gmail API. Verifica le credenziali OAuth.');
  }

  const boundary = 'motodna_alt_' + Math.random().toString(16).slice(2);
  const safeSubject = String(subject || 'MotoDNA').replace(/[\r\n]/g, ' ');
  const message = [
    `From: MotoDNA <${GMAIL_USER}>`,
    `To: ${to}`,
    `Subject: ${safeSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    text || '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html || '',
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const sendResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: Buffer.from(message, 'utf8').toString('base64url') }),
    cache: 'no-store',
  });
  if (!sendResponse.ok) {
    throw new Error(`Gmail API ha rifiutato l’invio (HTTP ${sendResponse.status}).`);
  }
}
