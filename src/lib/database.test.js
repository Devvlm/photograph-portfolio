/**
 * Tests for storageService.uploadLargeFile()
 *
 * Mocks globalThis.fetch so no real network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock auth service before importing database ──────────────────────────────

vi.mock('./auth.js', () => ({
  authService: {
    getAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
  },
}));

// Mock import.meta.env
vi.stubGlobal('import', { meta: { env: { VITE_API_URL: 'https://api.test' } } });

// ─── Import after mocks ───────────────────────────────────────────────────────

import { storageService } from './database.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHUNK = 10 * 1024 * 1024; // 10MB

/** Create a File of `size` bytes with given name and type */
function makeFile(size, name = 'test.mp4', type = 'video/mp4') {
  return new File([new Uint8Array(size)], name, { type });
}

/** Build a fetch mock that responds according to a map of URL → Response */
function mockFetch(responses) {
  return vi.fn(async (url, opts) => {
    // Find matching pattern
    const key = Object.keys(responses).find(k => url.includes(k));
    if (!key) throw new Error(`Unexpected fetch: ${url}`);

    const handler = responses[key];
    return typeof handler === 'function' ? handler(url, opts) : handler;
  });
}

function okJson(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorJson(message, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('storageService.uploadLargeFile()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads a file smaller than one chunk in a single part', async () => {
    const file = makeFile(5 * 1024 * 1024); // 5MB → 1 chunk

    let partCalls = 0;
    let completeCalled = false;

    globalThis.fetch = mockFetch({
      'multipart/start': () => okJson({ uploadId: 'uid-1', key: 'videos/test.mp4' }),
      'multipart/part': () => {
        partCalls++;
        return okJson({ partNumber: 1, etag: 'etag-1' });
      },
      'multipart/complete': (url, opts) => {
        completeCalled = true;
        const body = JSON.parse(opts.body);
        expect(body.parts).toHaveLength(1);
        expect(body.parts[0]).toEqual({ partNumber: 1, etag: 'etag-1' });
        return okJson({ success: true, url: '/api/media/videos/test.mp4', key: 'videos/test.mp4' });
      },
    });

    const url = await storageService.uploadLargeFile(file, 'videos');

    expect(partCalls).toBe(1);
    expect(completeCalled).toBe(true);
    expect(url).toBe('/api/media/videos/test.mp4');
  });

  it('splits a 25MB file into 3 chunks (10+10+5)', async () => {
    const file = makeFile(25 * 1024 * 1024); // 25MB → ceil(25/10) = 3 chunks

    let partNumbers = [];

    globalThis.fetch = mockFetch({
      'multipart/start': () => okJson({ uploadId: 'uid-2', key: 'videos/big.mp4' }),
      'multipart/part': (url, opts) => {
        const num = parseInt(opts.headers['X-Part-Number'], 10);
        partNumbers.push(num);
        return okJson({ partNumber: num, etag: `etag-${num}` });
      },
      'multipart/complete': () =>
        okJson({ success: true, url: '/api/media/videos/big.mp4', key: 'videos/big.mp4' }),
    });

    await storageService.uploadLargeFile(file, 'videos');

    expect(partNumbers).toEqual([1, 2, 3]);
  });

  it('calls onProgress with 0–100% values', async () => {
    const file = makeFile(20 * 1024 * 1024); // 20MB → 2 chunks

    const progressValues = [];

    globalThis.fetch = mockFetch({
      'multipart/start': () => okJson({ uploadId: 'uid-3', key: 'videos/prog.mp4' }),
      'multipart/part': (url, opts) => {
        const num = parseInt(opts.headers['X-Part-Number'], 10);
        return okJson({ partNumber: num, etag: `etag-${num}` });
      },
      'multipart/complete': () =>
        okJson({ success: true, url: '/api/media/videos/prog.mp4', key: 'videos/prog.mp4' }),
    });

    await storageService.uploadLargeFile(file, 'videos', (pct) => {
      progressValues.push(pct);
    });

    // Should receive one progress per chunk (95% scaled) plus 100% at the end
    expect(progressValues).toContain(100);
    expect(progressValues.length).toBeGreaterThanOrEqual(3); // chunk 1 (~47%), chunk 2 (~95%), done (100%)
    progressValues.forEach(p => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    });
  });

  it('sends correct auth headers on every request', async () => {
    const file = makeFile(1024); // tiny file
    const seenHeaders = [];

    globalThis.fetch = mockFetch({
      'multipart/start': (url, opts) => {
        seenHeaders.push({ url, auth: opts.headers.Authorization });
        return okJson({ uploadId: 'uid-4', key: 'videos/auth.mp4' });
      },
      'multipart/part': (url, opts) => {
        seenHeaders.push({ url, auth: opts.headers['Authorization'] });
        return okJson({ partNumber: 1, etag: 'etag-1' });
      },
      'multipart/complete': (url, opts) => {
        seenHeaders.push({ url, auth: opts.headers.Authorization });
        return okJson({ success: true, url: '/api/media/videos/auth.mp4', key: 'videos/auth.mp4' });
      },
    });

    await storageService.uploadLargeFile(file, 'videos');

    seenHeaders.forEach(({ auth }) => {
      expect(auth).toBe('Bearer test-token');
    });
  });

  it('aborts and throws when a part upload fails', async () => {
    const file = makeFile(15 * 1024 * 1024); // 15MB → 2 chunks

    let abortCalled = false;
    let partCount = 0;

    globalThis.fetch = mockFetch({
      'multipart/start': () => okJson({ uploadId: 'uid-5', key: 'videos/fail.mp4' }),
      'multipart/part': (url, opts) => {
        partCount++;
        // Fail on the second part
        if (partCount === 2) return errorJson('Part upload failed', 500);
        return okJson({ partNumber: 1, etag: 'etag-1' });
      },
      'multipart/complete': () => okJson({ success: true, url: '/x', key: 'x' }),
      'multipart/abort': (url, opts) => {
        abortCalled = true;
        const body = JSON.parse(opts.body);
        expect(body.uploadId).toBe('uid-5');
        expect(body.key).toBe('videos/fail.mp4');
        return okJson({ success: true });
      },
    });

    await expect(storageService.uploadLargeFile(file, 'videos')).rejects.toThrow(
      /Failed to upload part 2|Part upload failed/
    );

    // Give the fire-and-forget abort a tick to run
    await new Promise(r => setTimeout(r, 10));
    expect(abortCalled).toBe(true);
  });

  it('aborts and throws when complete fails', async () => {
    const file = makeFile(1024);
    let abortCalled = false;

    globalThis.fetch = mockFetch({
      'multipart/start': () => okJson({ uploadId: 'uid-6', key: 'videos/fail2.mp4' }),
      'multipart/part': () => okJson({ partNumber: 1, etag: 'etag-1' }),
      'multipart/complete': () => errorJson('Complete failed', 500),
      'multipart/abort': () => {
        abortCalled = true;
        return okJson({ success: true });
      },
    });

    await expect(storageService.uploadLargeFile(file, 'videos')).rejects.toThrow(
      /Failed to complete upload|Complete failed/
    );

    await new Promise(r => setTimeout(r, 10));
    expect(abortCalled).toBe(true);
  });

  it('sends each chunk with correct Content-Type and headers', async () => {
    const file = makeFile(1024, 'video.webm', 'video/webm');
    const partHeaders = [];

    globalThis.fetch = mockFetch({
      'multipart/start': () => okJson({ uploadId: 'uid-7', key: 'videos/hdr.webm' }),
      'multipart/part': (url, opts) => {
        partHeaders.push(opts.headers);
        return okJson({ partNumber: 1, etag: 'etag-1' });
      },
      'multipart/complete': () =>
        okJson({ success: true, url: '/api/media/videos/hdr.webm', key: 'videos/hdr.webm' }),
    });

    await storageService.uploadLargeFile(file, 'videos');

    expect(partHeaders[0]['Content-Type']).toBe('application/octet-stream');
    expect(partHeaders[0]['X-Part-Number']).toBe('1');
    expect(partHeaders[0]['X-Upload-Key']).toBe('videos/hdr.webm');
    expect(partHeaders[0]['X-Upload-Id']).toBe('uid-7');
  });
});
