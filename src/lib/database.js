/**
 * Database Service
 * Handles all API operations for portfolio items via Cloudflare Worker
 */

import { authService } from './auth.js';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Check if API is configured
 */
export function isApiConfigured() {
  return !!API_BASE;
}

/**
 * Portfolio Items CRUD Operations
 */
export const portfolioService = {
  /**
   * Get all portfolio items
   * @param {string} category - Optional category filter ('photo', 'video', 'editing')
   * @returns {Promise<Array>}
   */
  async getAll(category = null) {
    try {
      const url = category && category !== 'all'
        ? `${API_BASE}/api/portfolio?category=${category}`
        : `${API_BASE}/api/portfolio`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch portfolio items');
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Error fetching portfolio items:', error);
      return [];
    }
  },

  /**
   * Get a single portfolio item by ID
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getById(id) {
    try {
      const response = await fetch(`${API_BASE}/api/portfolio/${id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch portfolio item');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching portfolio item:', error);
      return null;
    }
  },

  /**
   * Create a new portfolio item
   * @param {Object} item - Portfolio item data
   * @returns {Promise<Object>}
   */
  async create(item) {
    const response = await fetch(`${API_BASE}/api/portfolio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify({
        title: item.title,
        category: item.category,
        type: item.type,
        thumbnail_url: item.thumbnail_url,
        fullsize_url: item.fullsize_url,
        video_url: item.video_url || null,
        description: item.description || null,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Create failed' }));
      throw new Error(error.error || 'Failed to create portfolio item');
    }

    return await response.json();
  },

  /**
   * Update a portfolio item
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async update(id, updates) {
    const response = await fetch(`${API_BASE}/api/portfolio/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Update failed' }));
      throw new Error(error.error || 'Failed to update portfolio item');
    }

    return await response.json();
  },

  /**
   * Delete a portfolio item
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    const response = await fetch(`${API_BASE}/api/portfolio/${id}`, {
      method: 'DELETE',
      headers: authService.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Delete failed' }));
      throw new Error(error.error || 'Failed to delete portfolio item');
    }
  }
};

/**
 * Storage Service for image/video uploads via Cloudflare R2
 */
export const storageService = {
  /**
   * Upload a file to R2 via the Worker API
   * @param {File} file - The file to upload
   * @param {string} folder - Target folder ('thumbnails', 'fullsize', or 'videos')
   * @returns {Promise<string>} - Public URL of the uploaded file
   */
  async uploadFile(file, folder = 'uploads') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const response = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Failed to upload file');
    }

    const data = await response.json();
    return data.url;
  },

  /**
   * Upload a large file (video) to R2 via chunked multipart upload
   * @param {File} file - The video file
   * @param {string} folder - Target folder (default: 'videos')
   * @param {function} onProgress - Callback(percentage: 0-100)
   * @returns {Promise<string>} - Public URL of the uploaded file
   */
  async uploadLargeFile(file, folder = 'videos', onProgress = null) {
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per part
    const headers = authService.getAuthHeaders();

    // 1. Start multipart upload
    const startRes = await fetch(`${API_BASE}/api/upload/multipart/start`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, filename: file.name, contentType: file.type }),
    });
    if (!startRes.ok) {
      const err = await startRes.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to start upload');
    }
    const { uploadId, key } = await startRes.json();

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const parts = [];

    // 2. Upload each chunk
    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const chunk = file.slice(start, start + CHUNK_SIZE);

        const partRes = await fetch(`${API_BASE}/api/upload/multipart/part`, {
          method: 'POST',
          headers: {
            ...headers,
            'X-Upload-Id': uploadId,
            'X-Upload-Key': key,
            'X-Part-Number': String(i + 1),
            'Content-Type': 'application/octet-stream',
          },
          body: chunk,
        });

        if (!partRes.ok) {
          const err = await partRes.json().catch(() => ({}));
          throw new Error(err.error || `Failed to upload part ${i + 1}`);
        }

        const part = await partRes.json();
        parts.push({ partNumber: part.partNumber, etag: part.etag });

        if (onProgress) onProgress(Math.round(((i + 1) / totalChunks) * 95));
      }

      // 3. Complete the upload
      const completeRes = await fetch(`${API_BASE}/api/upload/multipart/complete`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, key, parts }),
      });
      if (!completeRes.ok) {
        const err = await completeRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to complete upload');
      }

      const data = await completeRes.json();
      if (onProgress) onProgress(100);
      return data.url;

    } catch (error) {
      // Abort the multipart upload to clean up R2
      fetch(`${API_BASE}/api/upload/multipart/abort`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, key }),
      }).catch(() => {});
      throw error;
    }
  },

  /**
   * Delete a file from R2
   * @param {string} url - URL of the file (or the key)
   * @returns {Promise<void>}
   */
  async deleteFile(url) {
    // Extract the key from the URL
    // URL format: /api/media/folder/filename.ext
    const key = url.replace(/^.*\/api\/media\//, '');

    const response = await fetch(`${API_BASE}/api/upload/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: authService.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Delete failed' }));
      throw new Error(error.error || 'Failed to delete file');
    }
  }
};
