/**
 * Portfolio Module
 * Handles CRUD operations for portfolio items stored in R2 as JSON
 */

import { requireAuth } from './auth.js';

const PORTFOLIO_FILE = 'portfolio.json';

/**
 * Get portfolio data from R2
 */
async function getPortfolioData(env) {
  try {
    const object = await env.PORTFOLIO_BUCKET.get(PORTFOLIO_FILE);
    if (!object) {
      // Return empty portfolio if file doesn't exist
      return { items: [], lastModified: new Date().toISOString() };
    }
    const text = await object.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('Error reading portfolio data:', error);
    return { items: [], lastModified: new Date().toISOString() };
  }
}

/**
 * Save portfolio data to R2
 */
async function savePortfolioData(env, data) {
  data.lastModified = new Date().toISOString();
  await env.PORTFOLIO_BUCKET.put(PORTFOLIO_FILE, JSON.stringify(data, null, 2), {
    httpMetadata: {
      contentType: 'application/json',
    },
  });
}

/**
 * Generate a unique ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Handle portfolio routes
 */
export async function handlePortfolio(request, env, { jsonResponse, errorResponse }) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // GET /api/portfolio - Get all portfolio items (public)
  if (path === '/api/portfolio' && method === 'GET') {
    const category = url.searchParams.get('category');
    const data = await getPortfolioData(env);

    let items = data.items || [];

    // Filter by category if specified
    if (category && category !== 'all') {
      items = items.filter(item => item.category === category);
    }

    // Sort by created_at descending (newest first)
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return jsonResponse({ items }, 200, env, request);
  }

  // GET /api/portfolio/:id - Get single item (public)
  if (path.match(/^\/api\/portfolio\/[^/]+$/) && method === 'GET') {
    const id = path.split('/').pop();
    const data = await getPortfolioData(env);
    const item = data.items.find(i => i.id === id);

    if (!item) {
      return errorResponse('Item not found', 404, env, request);
    }

    return jsonResponse(item, 200, env, request);
  }

  // POST /api/portfolio - Create new item (requires auth)
  if (path === '/api/portfolio' && method === 'POST') {
    const user = await requireAuth(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401, env, request);
    }

    try {
      const body = await request.json();

      // Validate required fields
      const { title, type, thumbnail_url, fullsize_url } = body;
      if (!title || !type || !thumbnail_url || !fullsize_url) {
        return errorResponse('Missing required fields', 400, env, request);
      }

      // Validate type
      if (!['image', 'video'].includes(type)) {
        return errorResponse('Invalid type', 400, env, request);
      }

      // Create new item
      const newItem = {
        id: generateId(),
        title,
        category,
        type,
        thumbnail_url,
        fullsize_url,
        video_url: body.video_url || null,
        description: body.description || null,
        display_order: body.display_order || 0,
        is_featured: body.is_featured || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add to portfolio
      const data = await getPortfolioData(env);
      data.items.push(newItem);
      await savePortfolioData(env, data);

      return jsonResponse(newItem, 201, env, request);

    } catch (error) {
      console.error('Create error:', error);
      return errorResponse('Failed to create item', 500, env, request);
    }
  }

  // PUT /api/portfolio/:id - Update item (requires auth)
  if (path.match(/^\/api\/portfolio\/[^/]+$/) && method === 'PUT') {
    const user = await requireAuth(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401, env, request);
    }

    try {
      const id = path.split('/').pop();
      const body = await request.json();

      const data = await getPortfolioData(env);
      const index = data.items.findIndex(i => i.id === id);

      if (index === -1) {
        return errorResponse('Item not found', 404, env, request);
      }

      // Validate category if provided
      // Validate type if provided
      if (body.type && !['image', 'video'].includes(body.type)) {
        return errorResponse('Invalid type', 400, env, request);
      }

      // Update item
      const updatedItem = {
        ...data.items[index],
        ...body,
        id: data.items[index].id, // Prevent ID change
        created_at: data.items[index].created_at, // Preserve original creation date
        updated_at: new Date().toISOString(),
      };

      data.items[index] = updatedItem;
      await savePortfolioData(env, data);

      return jsonResponse(updatedItem, 200, env, request);

    } catch (error) {
      console.error('Update error:', error);
      return errorResponse('Failed to update item', 500, env, request);
    }
  }

  // DELETE /api/portfolio/:id - Delete item (requires auth)
  if (path.match(/^\/api\/portfolio\/[^/]+$/) && method === 'DELETE') {
    const user = await requireAuth(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401, env, request);
    }

    try {
      const id = path.split('/').pop();
      const data = await getPortfolioData(env);
      const index = data.items.findIndex(i => i.id === id);

      if (index === -1) {
        return errorResponse('Item not found', 404, env, request);
      }

      // Get item for potential file cleanup
      const deletedItem = data.items[index];

      // Remove from array
      data.items.splice(index, 1);
      await savePortfolioData(env, data);

      return jsonResponse({
        success: true,
        deleted: deletedItem
      }, 200, env, request);

    } catch (error) {
      console.error('Delete error:', error);
      return errorResponse('Failed to delete item', 500, env, request);
    }
  }

  return errorResponse('Not found', 404, env, request);
}
