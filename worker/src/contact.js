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
  if (!await checkAndIncrement(kv, secKey, GLOBAL_PER_SECOND, 2)) {
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
    subject: `[Contact] ${safeSubject}`,
    text: `Name: ${safeName}\nEmail: ${emailTrim}\n\n${safeMessage}`,
    html: `
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> <a href="mailto:${emailTrim}">${emailTrim}</a></p>
      <hr>
      <p>${htmlMessage}</p>
    `,
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
