/**
 * Tests for multipart upload routes in upload.js
 *
 * Uses a hand-rolled mock for the R2 bucket binding so we
 * can run entirely in Node without Miniflare / wrangler.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleUpload } from './upload.js';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Build a synthetic Request object */
function makeRequest(method, path, { body, headers = {}, json } = {}) {
  const url = `https://worker.test${path}`;
  const init = {
    method,
    headers: new Headers({
      Origin: 'https://dtrmndvisuals.com',
      ...headers,
    }),
  };

  if (json !== undefined) {
    init.body = JSON.stringify(json);
    init.headers.set('Content-Type', 'application/json');
  } else if (body !== undefined) {
    init.body = body;
  }

  return new Request(url, init);
}

/** Minimal jsonResponse / errorResponse implementations */
const helpers = {
  jsonResponse: (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  errorResponse: (message, status = 400) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
};

async function json(res) {
  return res.json();
}

// ─── Mock R2 bucket ──────────────────────────────────────────────────────────

function makeMockBucket() {
  const uploads = {}; // uploadId → { key, parts }

  return {
    createMultipartUpload: vi.fn(async (key, opts) => {
      const uploadId = `mock-upload-${Date.now()}`;
      uploads[uploadId] = { key, parts: [] };
      return {
        uploadId,
        key,
        uploadPart: vi.fn(async (partNumber, body) => ({
          partNumber,
          etag: `etag-${partNumber}`,
        })),
        complete: vi.fn(async (parts) => ({ key })),
        abort: vi.fn(async () => {}),
      };
    }),
    resumeMultipartUpload: vi.fn((key, uploadId) => ({
      uploadId,
      key,
      uploadPart: vi.fn(async (partNumber, body) => ({
        partNumber,
        etag: `etag-${partNumber}`,
      })),
      complete: vi.fn(async (parts) => ({ key })),
      abort: vi.fn(async () => {}),
    })),
    put: vi.fn(async () => {}),
    get: vi.fn(async () => null),
    head: vi.fn(async () => null),
    delete: vi.fn(async () => {}),
  };
}

// ─── Mock auth ───────────────────────────────────────────────────────────────

// requireAuth is imported inside upload.js; we mock the module
vi.mock('./auth.js', () => ({
  requireAuth: vi.fn(async () => ({ user: 'admin' })),
}));

import { requireAuth } from './auth.js';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/upload/multipart/start', () => {
  let env;

  beforeEach(() => {
    env = { PORTFOLIO_BUCKET: makeMockBucket() };
    vi.clearAllMocks();
    requireAuth.mockResolvedValue({ user: 'admin' });
  });

  it('returns uploadId and key for a valid video', async () => {
    const req = makeRequest('POST', '/api/upload/multipart/start', {
      json: { folder: 'videos', filename: 'event.mp4', contentType: 'video/mp4' },
    });

    const res = await handleUpload(req, env, helpers);
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.uploadId).toBeTruthy();
    expect(body.key).toMatch(/^videos\//);
    expect(env.PORTFOLIO_BUCKET.createMultipartUpload).toHaveBeenCalledOnce();
  });

  it('rejects a non-video content type', async () => {
    const req = makeRequest('POST', '/api/upload/multipart/start', {
      json: { folder: 'videos', filename: 'photo.jpg', contentType: 'image/jpeg' },
    });

    const res = await handleUpload(req, env, helpers);
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error).toMatch(/Invalid video type/);
  });

  it('rejects when filename is missing', async () => {
    const req = makeRequest('POST', '/api/upload/multipart/start', {
      json: { folder: 'videos', contentType: 'video/mp4' },
    });

    const res = await handleUpload(req, env, helpers);
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    requireAuth.mockResolvedValue(null);
    const req = makeRequest('POST', '/api/upload/multipart/start', {
      json: { folder: 'videos', filename: 'event.mp4', contentType: 'video/mp4' },
    });

    const res = await handleUpload(req, env, helpers);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/upload/multipart/part', () => {
  let env;

  beforeEach(() => {
    env = { PORTFOLIO_BUCKET: makeMockBucket() };
    vi.clearAllMocks();
    requireAuth.mockResolvedValue({ user: 'admin' });
  });

  it('uploads a part and returns partNumber + etag', async () => {
    const chunk = new Uint8Array(1024).fill(0xAB);
    const req = makeRequest('POST', '/api/upload/multipart/part', {
      body: chunk,
      headers: {
        'X-Upload-Id': 'test-upload-id',
        'X-Upload-Key': 'videos/test.mp4',
        'X-Part-Number': '1',
        'Content-Type': 'application/octet-stream',
      },
    });

    const res = await handleUpload(req, env, helpers);
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.partNumber).toBe(1);
    expect(body.etag).toBe('etag-1');
    expect(env.PORTFOLIO_BUCKET.resumeMultipartUpload).toHaveBeenCalledWith(
      'videos/test.mp4',
      'test-upload-id'
    );
  });

  it('rejects when X-Upload-Id header is missing', async () => {
    const req = makeRequest('POST', '/api/upload/multipart/part', {
      body: new Uint8Array(1024),
      headers: {
        'X-Upload-Key': 'videos/test.mp4',
        'X-Part-Number': '1',
        'Content-Type': 'application/octet-stream',
      },
    });

    const res = await handleUpload(req, env, helpers);
    expect(res.status).toBe(400);
  });

  it('rejects part number 0 (invalid)', async () => {
    const req = makeRequest('POST', '/api/upload/multipart/part', {
      body: new Uint8Array(1024),
      headers: {
        'X-Upload-Id': 'test-id',
        'X-Upload-Key': 'videos/test.mp4',
        'X-Part-Number': '0',
        'Content-Type': 'application/octet-stream',
      },
    });

    const res = await handleUpload(req, env, helpers);
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    requireAuth.mockResolvedValue(null);
    const req = makeRequest('POST', '/api/upload/multipart/part', {
      body: new Uint8Array(1024),
      headers: {
        'X-Upload-Id': 'id',
        'X-Upload-Key': 'videos/test.mp4',
        'X-Part-Number': '1',
      },
    });

    const res = await handleUpload(req, env, helpers);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/upload/multipart/complete', () => {
  let env;

  beforeEach(() => {
    env = { PORTFOLIO_BUCKET: makeMockBucket() };
    vi.clearAllMocks();
    requireAuth.mockResolvedValue({ user: 'admin' });
  });

  it('completes the upload and returns a public URL', async () => {
    const parts = [
      { partNumber: 1, etag: 'etag-1' },
      { partNumber: 2, etag: 'etag-2' },
    ];
    const req = makeRequest('POST', '/api/upload/multipart/complete', {
      json: { uploadId: 'test-id', key: 'videos/test.mp4', parts },
    });

    const res = await handleUpload(req, env, helpers);
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.url).toBe('/api/media/videos/test.mp4');
    expect(body.key).toBe('videos/test.mp4');

    const mockUpload = env.PORTFOLIO_BUCKET.resumeMultipartUpload.mock.results[0].value;
    expect(mockUpload.complete).toHaveBeenCalledWith(parts);
  });

  it('rejects when parts array is empty', async () => {
    const req = makeRequest('POST', '/api/upload/multipart/complete', {
      json: { uploadId: 'test-id', key: 'videos/test.mp4', parts: [] },
    });

    const res = await handleUpload(req, env, helpers);
    expect(res.status).toBe(400);
  });

  it('rejects when uploadId is missing', async () => {
    const req = makeRequest('POST', '/api/upload/multipart/complete', {
      json: { key: 'videos/test.mp4', parts: [{ partNumber: 1, etag: 'e' }] },
    });

    const res = await handleUpload(req, env, helpers);
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    requireAuth.mockResolvedValue(null);
    const req = makeRequest('POST', '/api/upload/multipart/complete', {
      json: { uploadId: 'id', key: 'k', parts: [{ partNumber: 1, etag: 'e' }] },
    });

    const res = await handleUpload(req, env, helpers);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/upload/multipart/abort', () => {
  let env;

  beforeEach(() => {
    env = { PORTFOLIO_BUCKET: makeMockBucket() };
    vi.clearAllMocks();
    requireAuth.mockResolvedValue({ user: 'admin' });
  });

  it('calls abort and returns success', async () => {
    const req = makeRequest('DELETE', '/api/upload/multipart/abort', {
      json: { uploadId: 'test-id', key: 'videos/test.mp4' },
    });

    const res = await handleUpload(req, env, helpers);
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.success).toBe(true);

    const mockUpload = env.PORTFOLIO_BUCKET.resumeMultipartUpload.mock.results[0].value;
    expect(mockUpload.abort).toHaveBeenCalledOnce();
  });

  it('rejects when key is missing', async () => {
    const req = makeRequest('DELETE', '/api/upload/multipart/abort', {
      json: { uploadId: 'test-id' },
    });

    const res = await handleUpload(req, env, helpers);
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    requireAuth.mockResolvedValue(null);
    const req = makeRequest('DELETE', '/api/upload/multipart/abort', {
      json: { uploadId: 'id', key: 'k' },
    });

    const res = await handleUpload(req, env, helpers);
    expect(res.status).toBe(401);
  });
});
