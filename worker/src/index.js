/**
 * Portfolio API - Cloudflare Worker
 * Handles authentication, portfolio CRUD, and R2 file uploads
 */

import { handleAuth } from './auth.js';
import { handlePortfolio } from './portfolio.js';
import { handleUpload } from './upload.js';
import { handlePricingText, handleAllTranslations } from './translations.js';

/**
 * CORS headers for all responses
 */
function corsHeaders(origin, env) {
  const allowedOrigin = env.CORS_ORIGIN === '*' ? origin : env.CORS_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowedOrigin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
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
        headers: corsHeaders(origin, env),
      });
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

      // Route: /api/upload/*
      if (path.startsWith('/api/upload') || path.startsWith('/api/media')) {
        return await handleUpload(request, env, { jsonResponse, errorResponse });
      }

      // Health check
      if (path === '/api/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }, 200, env, request);
      }

      // 404 for unknown routes
      console.log('No route matched for path:', path);
      return errorResponse('Not found', 404, env, request);

    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse('Internal server error', 500, env, request);
    }
  },
};
