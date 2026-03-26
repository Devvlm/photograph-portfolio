/**
 * Portfolio API - Cloudflare Worker
 * Handles authentication, portfolio CRUD, and R2 file uploads
 */

import { handleAuth } from './auth.js';
import { handlePortfolio } from './portfolio.js';
import { handleUpload } from './upload.js';
import { handlePricingText, handleAllTranslations } from './translations.js';
import { handleContact } from './contact.js';

/** Allowed origins — must match your production domain */
const ALLOWED_ORIGINS = [
  'https://dtrmndvisuals.com',
  'https://www.dtrmndvisuals.com',
  'http://localhost:5173',  // local dev
  'http://localhost:4173',  // local preview
];

/**
 * CORS headers — only reflects origin if it's in the allowlist
 */
function corsHeaders(origin, env) {
  const allowed = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

/**
 * Security headers added to every response
 */
function securityHeaders() {
  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

/**
 * CSRF check — for mutating requests, Origin must be in the allowlist
 */
function validateOrigin(request) {
  const method = request.method;
  if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') return true;

  const origin = request.headers.get('Origin');
  if (!origin) return false; // reject if no Origin on mutations
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * JSON response helper
 */
function jsonResponse(data, status = 200, env, request) {
  const origin = request.headers.get('Origin');
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin, env),
      ...securityHeaders(),
    },
  });
}

/**
 * Error response helper
 */
function errorResponse(message, status = 400, env, request) {
  return jsonResponse({ error: message }, status, env, request);
}

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      const origin = request.headers.get('Origin');
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(origin, env),
          ...securityHeaders(),
        },
      });
    }

    // CSRF: reject mutating requests from unknown origins
    if (!validateOrigin(request)) {
      return errorResponse('Forbidden: invalid origin', 403, env, request);
    }

    try {
      // Route: /api/auth/*
      if (path.startsWith('/api/auth')) {
        return await handleAuth(request, env, { jsonResponse, errorResponse });
      }

      // Route: /api/portfolio/*
      if (path.startsWith('/api/portfolio')) {
        return await handlePortfolio(request, env, { jsonResponse, errorResponse });
      }

      // Route: /api/pricing-text/*
      if (path.startsWith('/api/pricing-text')) {
        return await handlePricingText(request, env, { jsonResponse, errorResponse });
      }

      // Route: /api/translations/*
      if (path.startsWith('/api/translations')) {
        return await handleAllTranslations(request, env, { jsonResponse, errorResponse });
      }

      // Route: /api/contact
      if (path === '/api/contact') {
        return await handleContact(request, env, { jsonResponse, errorResponse });
      }

      // Route: /api/upload/*
      if (path.startsWith('/api/upload') || path.startsWith('/api/media')) {
        return await handleUpload(request, env, { jsonResponse, errorResponse });
      }

      // Health check
      if (path === '/api/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }, 200, env, request);
      }

      return errorResponse('Not found', 404, env, request);

    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse('Internal server error', 500, env, request);
    }
  },
};
