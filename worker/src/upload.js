/**
 * Upload Module
 * Handles file uploads to Cloudflare R2
 */

import { requireAuth } from './auth.js';

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

// Max file sizes (in bytes)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB for videos

/**
 * Generate a unique filename
 */
function generateFilename(originalName, folder) {
  const ext = originalName.split('.').pop().toLowerCase();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${folder}/${timestamp}-${random}.${ext}`;
}

/**
 * Get the public URL for an R2 object
 */
function getPublicUrl(key, env) {
  // If you have a custom domain for R2, use it here
  // Otherwise, you'll need to set up a public bucket or use signed URLs
  // For now, we'll return a path that the worker can serve
  return `/api/media/${key}`;
}

/**
 * Handle upload routes
 */
export async function handleUpload(request, env, { jsonResponse, errorResponse }) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // POST /api/upload - Upload a file
  if (path === '/api/upload' && method === 'POST') {
    const user = await requireAuth(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401, env, request);
    }

    try {
      const contentType = request.headers.get('Content-Type') || '';

      // Handle multipart form data
      if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        const file = formData.get('file');
        const folder = formData.get('folder') || 'uploads';

        if (!file || !(file instanceof File)) {
          return errorResponse('No file provided', 400, env, request);
        }

        // Validate file type
        const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
        const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

        if (!isImage && !isVideo) {
          return errorResponse(`Invalid file type: ${file.type}. Allowed: images (jpg, png, webp, gif) and videos (mp4, webm, mov, avi)`, 400, env, request);
        }

        // Validate file size
        const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
        if (file.size > maxSize) {
          const maxMB = Math.round(maxSize / (1024 * 1024));
          return errorResponse(`File too large. Maximum size: ${maxMB}MB`, 400, env, request);
        }

        // Generate unique filename
        const key = generateFilename(file.name, folder);

        // Upload to R2
        await env.PORTFOLIO_BUCKET.put(key, file.stream(), {
          httpMetadata: {
            contentType: file.type,
          },
        });

        // Return the URL
        const fileUrl = getPublicUrl(key, env);

        return jsonResponse({
          success: true,
          url: fileUrl,
          key: key,
          filename: file.name,
          size: file.size,
          type: file.type,
        }, 200, env, request);
      }

      return errorResponse('Content-Type must be multipart/form-data', 400, env, request);

    } catch (error) {
      console.error('Upload error:', error);
      return errorResponse('Failed to upload file', 500, env, request);
    }
  }

  // DELETE /api/upload/:key - Delete a file
  if (path.startsWith('/api/upload/') && method === 'DELETE') {
    const user = await requireAuth(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401, env, request);
    }

    try {
      // Get the key from the path (everything after /api/upload/)
      const key = decodeURIComponent(path.substring('/api/upload/'.length));

      if (!key) {
        return errorResponse('No file key provided', 400, env, request);
      }

      // Check if file exists
      const object = await env.PORTFOLIO_BUCKET.head(key);
      if (!object) {
        return errorResponse('File not found', 404, env, request);
      }

      // Delete from R2
      await env.PORTFOLIO_BUCKET.delete(key);

      return jsonResponse({
        success: true,
        deleted: key,
      }, 200, env, request);

    } catch (error) {
      console.error('Delete error:', error);
      return errorResponse('Failed to delete file', 500, env, request);
    }
  }

  // GET /api/media/* - Serve files from R2 (public)
  if (path.startsWith('/api/media/') && method === 'GET') {
    try {
      const key = decodeURIComponent(path.substring('/api/media/'.length));

      const object = await env.PORTFOLIO_BUCKET.get(key);
      if (!object) {
        return errorResponse('File not found', 404, env, request);
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year cache

      return new Response(object.body, {
        headers,
      });

    } catch (error) {
      console.error('Media serve error:', error);
      return errorResponse('Failed to serve file', 500, env, request);
    }
  }

  return errorResponse('Not found', 404, env, request);
}
