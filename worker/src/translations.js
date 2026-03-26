/**
 * Pricing Text Translations
 * GET  /api/pricing-text/:lang  — read from KV (public)
 * PUT  /api/pricing-text/:lang  — write to KV (requires auth)
 */

import { requireAuth } from './auth.js';

const VALID_LANGS = ['nl', 'en'];

export async function handlePricingText(request, env, { jsonResponse, errorResponse }) {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const lang = parts[parts.length - 1];

  if (!VALID_LANGS.includes(lang)) {
    return errorResponse('Invalid language. Use "nl" or "en".', 400, env, request);
  }

  const kvKey = `pricing:${lang}`;

  // GET — public, no auth needed
  if (request.method === 'GET') {
    if (!env.TRANSLATIONS_KV) {
      return jsonResponse({}, 200, env, request);
    }
    const stored = await env.TRANSLATIONS_KV.get(kvKey);
    if (!stored) {
      return jsonResponse({}, 200, env, request);
    }
    return jsonResponse(JSON.parse(stored), 200, env, request);
  }

  // PUT — requires admin token
  if (request.method === 'PUT') {
    const user = await requireAuth(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401, env, request);
    }

    if (!env.TRANSLATIONS_KV) {
      return errorResponse('KV storage not configured', 503, env, request);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400, env, request);
    }

    await env.TRANSLATIONS_KV.put(kvKey, JSON.stringify(body));
    return jsonResponse({ success: true }, 200, env, request);
  }

  return errorResponse('Method not allowed', 405, env, request);
}
