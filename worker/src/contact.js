/**
 * Contact form handler
 * Rate-limited (global burst + per-IP), validates input, sends email via Resend API
 */

// Global limits (all visitors combined)
const GLOBAL_PER_SECOND = 2;
const GLOBAL_PER_MINUTE = 50;

// Per-IP limit
const IP_PER_HOUR    = 5;
const IP_HOUR_TTL    = 3600;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function strip(str) {
  return str.replace(/<[^>]*>/g, '').trim();
}

async function checkAndIncrement(kv, key, limit, ttl) {
  const val = await kv.get(key);
  const count = val ? parseInt(val, 10) : 0;
  if (count >= limit) return false;
  await kv.put(key, String(count + 1), { expirationTtl: ttl });
  return true;
}

export async function handleContact(request, env, { jsonResponse, errorResponse }) {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405, env, request);
  }

  const kv = env.TRANSLATIONS_KV;
  const now = Math.floor(Date.now() / 1000);
  const ip  = request.headers.get('CF-Connecting-IP') || 'unknown';

  // --- Global: 2 per second ---
  const secKey = `ratelimit:contact:global:s:${now}`;
  if (!await checkAndIncrement(kv, secKey, GLOBAL_PER_SECOND, 60)) {
    return errorResponse('Too many requests. Please try again in a moment.', 429, env, request);
  }

  // --- Global: 50 per minute ---
  const minKey = `ratelimit:contact:global:m:${Math.floor(now / 60)}`;
  if (!await checkAndIncrement(kv, minKey, GLOBAL_PER_MINUTE, 120)) {
    return errorResponse('Service is busy. Please try again shortly.', 429, env, request);
  }

  // --- Per-IP: 5 per hour ---
  const ipKey = `ratelimit:contact:ip:${ip}`;
  if (!await checkAndIncrement(kv, ipKey, IP_PER_HOUR, IP_HOUR_TTL)) {
    return errorResponse('Too many requests from your IP. Please try again later.', 429, env, request);
  }

  // --- Parse body ---
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid request body', 400, env, request);
  }

  const { name, email, subject, message } = body ?? {};

  // --- Validate ---
  const nameTrim    = (name    ?? '').trim();
  const emailTrim   = (email   ?? '').trim().toLowerCase();
  const subjectTrim = (subject ?? '').trim();
  const messageTrim = (message ?? '').trim();

  if (nameTrim.length < 2 || nameTrim.length > 100) {
    return errorResponse('Name must be between 2 and 100 characters.', 400, env, request);
  }
  if (!EMAIL_RE.test(emailTrim)) {
    return errorResponse('Invalid email address.', 400, env, request);
  }
  if (subjectTrim.length < 2 || subjectTrim.length > 200) {
    return errorResponse('Subject must be between 2 and 200 characters.', 400, env, request);
  }
  if (messageTrim.length < 10 || messageTrim.length > 2000) {
    return errorResponse('Message must be between 10 and 2000 characters.', 400, env, request);
  }

  // --- Sanitize ---
  const safeName    = strip(nameTrim);
  const safeSubject = strip(subjectTrim);
  const safeMessage = strip(messageTrim);

  // --- Send via Resend ---
  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY secret is not set');
    return errorResponse('Email service not configured.', 503, env, request);
  }

  const htmlMessage = safeMessage.replace(/\n/g, '<br>');
  const payload = {
    from: 'Dtrmnd Visuals <contact@dtrmndvisuals.com>',
    to: ['devinio17@hotmail.com'],
    reply_to: emailTrim,
    subject: `Nieuwe contactaanvraag: ${safeSubject}`,
    text: `Naam: ${safeName}\nE-mail: ${emailTrim}\nOnderwerp: ${safeSubject}\n\n${safeMessage}`,
    html: `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#111;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a1a;border-radius:12px 12px 0 0;padding:36px 40px 28px;text-align:center;border-bottom:2px solid #e63329;">
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:3px;color:#e63329;text-transform:uppercase;font-weight:600;">Dtrmnd Visuals</p>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Nieuwe contactaanvraag</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#1e1e1e;padding:32px 40px;">

              <!-- Sender info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:14px 16px;background:#252525;border-radius:8px;border-left:3px solid #e63329;">
                    <p style="margin:0 0 6px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1.5px;">Van</p>
                    <p style="margin:0;font-size:16px;color:#fff;font-weight:600;">${safeName}</p>
                    <a href="mailto:${emailTrim}" style="color:#e63329;font-size:14px;text-decoration:none;">${emailTrim}</a>
                  </td>
                </tr>
              </table>

              <!-- Subject -->
              <p style="margin:0 0 8px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1.5px;">Onderwerp</p>
              <p style="margin:0 0 24px;font-size:17px;color:#ffffff;font-weight:600;">${safeSubject}</p>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #333;margin:0 0 24px;">

              <!-- Message -->
              <p style="margin:0 0 8px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1.5px;">Bericht</p>
              <p style="margin:0;font-size:15px;color:#ccc;line-height:1.7;">${htmlMessage}</p>

            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background:#1e1e1e;padding:0 40px 32px;text-align:center;">
              <a href="mailto:${emailTrim}?subject=Re: ${safeSubject}"
                 style="display:inline-block;background:#e63329;color:#fff;text-decoration:none;padding:13px 32px;border-radius:6px;font-size:14px;font-weight:700;letter-spacing:0.5px;">
                Beantwoorden
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#161616;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;border-top:1px solid #2a2a2a;">
              <p style="margin:0;font-size:12px;color:#555;">Verzonden via dtrmndvisuals.com</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };

  let resendRes;
  try {
    resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('Resend fetch error:', err);
    return errorResponse('Failed to send email. Please try again later.', 502, env, request);
  }

  if (!resendRes.ok) {
    const errText = await resendRes.text().catch(() => '');
    console.error('Resend API error:', resendRes.status, errText);
    return errorResponse('Failed to send email. Please try again later.', 502, env, request);
  }

  return jsonResponse({ success: true }, 200, env, request);
}
