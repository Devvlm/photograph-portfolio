/**
 * Admin Dashboard
 * Handles authentication and portfolio CRUD operations
 * Uses Cloudflare Worker API for backend
 */

import './styles/main.css';
import './styles/admin.css';

import { authService } from './lib/auth.js';
import { portfolioService, storageService } from './lib/database.js';
import { ImageCropper } from './lib/imageCropper.js';

const API_BASE = import.meta.env.VITE_API_URL || '';

// State
let currentFilter = 'all';
let portfolioItems = [];
let editingItem = null;
let deleteTargetId = null;
let imageCropper = null;
let videoThumbnailCropper = null;
let currentImageFile = null;
let currentVideoFile = null;
let currentVideoThumbnailFile = null;

// DOM Elements
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const portfolioGrid = document.getElementById('portfolioGrid');
const emptyState = document.getElementById('emptyState');
const filterBtns = document.querySelectorAll('.filter-btn');
const addItemBtn = document.getElementById('addItemBtn');
const itemModal = document.getElementById('itemModal');
const itemForm = document.getElementById('itemForm');
const modalTitle = document.getElementById('modalTitle');
const deleteModal = document.getElementById('deleteModal');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');

// Image upload elements
const imageUploadGroup = document.getElementById('imageUploadGroup');
const imageUpload = document.getElementById('imageUpload');
const imageFile = document.getElementById('imageFile');
const cropperContainer = document.getElementById('cropperContainer');

// Video upload elements
const videoUploadGroup = document.getElementById('videoUploadGroup');
const videoUpload = document.getElementById('videoUpload');
const videoFile = document.getElementById('videoFile');
const videoPreview = document.getElementById('videoPreview');
const videoThumbnailGroup = document.getElementById('videoThumbnailGroup');
const videoThumbnailUpload = document.getElementById('videoThumbnailUpload');
const videoThumbnailFile = document.getElementById('videoThumbnailFile');
const videoThumbnailCropperContainer = document.getElementById('videoThumbnailCropperContainer');

// Type selector
const itemType = document.getElementById('itemType');

/**
 * Initialize the admin panel
 */
async function init() {
  // Check if user is already authenticated
  if (authService.isAuthenticated()) {
    showDashboard();
    loadPortfolioItems();
  } else {
    showLogin();
  }

  // Set up event listeners
  setupEventListeners();
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Login form
  loginForm.addEventListener('submit', handleLogin);

  // Logout button
  logoutBtn.addEventListener('click', handleLogout);

  // Filter buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentFilter = e.target.dataset.filter;
      filterBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      renderPortfolioGrid();
    });
  });

  // Add item button
  addItemBtn.addEventListener('click', () => openModal());

  // Item form submit
  itemForm.addEventListener('submit', handleSaveItem);

  // Type selector change
  itemType.addEventListener('change', handleTypeChange);

  // Image upload handler
  setupImageUpload();

  // Video upload handlers
  setupVideoUpload();
  setupVideoThumbnailUpload();

  // Delete confirmation
  confirmDeleteBtn.addEventListener('click', handleDeleteConfirm);

  // Close modals on backdrop click
  itemModal.addEventListener('click', (e) => {
    if (e.target === itemModal) closeModal();
  });
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDeleteModal();
    }
  });
}

/**
 * Handle type change (Image/Video)
 */
function handleTypeChange() {
  const type = itemType.value;

  if (type === 'image') {
    imageUploadGroup.style.display = 'block';
    videoUploadGroup.style.display = 'none';
    videoThumbnailGroup.style.display = 'none';
  } else {
    imageUploadGroup.style.display = 'none';
    videoUploadGroup.style.display = 'block';
    videoThumbnailGroup.style.display = 'block';
  }
}

/**
 * Set up image upload with cropper
 */
function setupImageUpload() {
  // Click to upload
  imageUpload.addEventListener('click', () => imageFile.click());

  // Drag and drop
  imageUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageUpload.classList.add('dragover');
  });

  imageUpload.addEventListener('dragleave', () => {
    imageUpload.classList.remove('dragover');
  });

  imageUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    imageUpload.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageSelect(files[0]);
    }
  });

  // File input change
  imageFile.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleImageSelect(e.target.files[0]);
    }
  });
}

/**
 * Set up video upload
 */
function setupVideoUpload() {
  // Click to upload
  videoUpload.addEventListener('click', () => videoFile.click());

  // Drag and drop
  videoUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    videoUpload.classList.add('dragover');
  });

  videoUpload.addEventListener('dragleave', () => {
    videoUpload.classList.remove('dragover');
  });

  videoUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    videoUpload.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleVideoSelect(files[0]);
    }
  });

  // File input change
  videoFile.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleVideoSelect(e.target.files[0]);
    }
  });
}

/**
 * Set up video thumbnail upload
 */
function setupVideoThumbnailUpload() {
  // Click to upload
  videoThumbnailUpload.addEventListener('click', () => videoThumbnailFile.click());

  // Drag and drop
  videoThumbnailUpload.addEventListener('dragover', (e) => {
    e.preventDefault();
    videoThumbnailUpload.classList.add('dragover');
  });

  videoThumbnailUpload.addEventListener('dragleave', () => {
    videoThumbnailUpload.classList.remove('dragover');
  });

  videoThumbnailUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    videoThumbnailUpload.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleVideoThumbnailSelect(files[0]);
    }
  });

  // File input change
  videoThumbnailFile.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleVideoThumbnailSelect(e.target.files[0]);
    }
  });
}

/**
 * Handle image selection and show cropper
 */
async function handleImageSelect(file) {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file', 'error');
    return;
  }

  // Validate file size (10MB max)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast('File size must be less than 10MB', 'error');
    return;
  }

  // Store the file for later upload
  currentImageFile = file;

  // Read image and show cropper
  const reader = new FileReader();
  reader.onload = async (e) => {
    const imageDataUrl = e.target.result;

    // Store original image data
    document.getElementById('originalImageData').value = imageDataUrl;

    // Hide upload area and show cropper
    imageUpload.style.display = 'none';
    cropperContainer.style.display = 'block';

    // Initialize or update cropper
    if (imageCropper) {
      imageCropper.destroy();
    }
    imageCropper = new ImageCropper(cropperContainer, {
      aspectRatio: 4 / 3,
      outputWidth: 600,
      outputHeight: 450
    });

    try {
      await imageCropper.setImage(imageDataUrl);
    } catch (error) {
      console.error('Failed to load image in cropper:', error);
      showToast('Failed to load image', 'error');
      resetImageUpload();
    }
  };
  reader.readAsDataURL(file);
}

/**
 * Handle video selection
 */
async function handleVideoSelect(file) {
  // Validate file type
  if (!file.type.startsWith('video/')) {
    showToast('Please select a video file', 'error');
    return;
  }

  // Validate file size (500MB max)
  const maxSize = 500 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast('Video must be less than 500MB', 'error');
    return;
  }

  // Store the file for later upload
  currentVideoFile = file;

  // Show video preview
  videoUpload.style.display = 'none';
  videoPreview.style.display = 'block';
  videoPreview.innerHTML = `
    <div class="video-preview-content">
      <div class="video-preview-icon">🎬</div>
      <p class="video-preview-name">${file.name}</p>
      <p class="video-preview-size">${(file.size / (1024 * 1024)).toFixed(2)} MB</p>
      <button type="button" class="btn btn-outline btn-sm" onclick="window.resetVideoUpload()">Verander video</button>
    </div>
  `;
}

/**
 * Handle video thumbnail selection
 */
async function handleVideoThumbnailSelect(file) {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file', 'error');
    return;
  }

  // Validate file size (10MB max)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast('File size must be less than 10MB', 'error');
    return;
  }

  // Store the file for later upload
  currentVideoThumbnailFile = file;

  // Read image and show cropper
  const reader = new FileReader();
  reader.onload = async (e) => {
    const imageDataUrl = e.target.result;

    // Hide upload area and show cropper
    videoThumbnailUpload.style.display = 'none';
    videoThumbnailCropperContainer.style.display = 'block';

    // Initialize or update cropper
    if (videoThumbnailCropper) {
      videoThumbnailCropper.destroy();
    }
    videoThumbnailCropper = new ImageCropper(videoThumbnailCropperContainer, {
      aspectRatio: 4 / 3,
      outputWidth: 600,
      outputHeight: 450
    });

    try {
      await videoThumbnailCropper.setImage(imageDataUrl);
    } catch (error) {
      console.error('Failed to load image in cropper:', error);
      showToast('Failed to load image', 'error');
      resetVideoThumbnailUpload();
    }
  };
  reader.readAsDataURL(file);
}

/**
 * Reset image upload state
 */
function resetImageUpload() {
  imageUpload.style.display = 'flex';
  cropperContainer.style.display = 'none';
  cropperContainer.innerHTML = '';
  document.getElementById('originalImageData').value = '';
  document.getElementById('thumbnailUrl').value = '';
  document.getElementById('fullsizeUrl').value = '';
  currentImageFile = null;
  if (imageCropper) {
    imageCropper.destroy();
    imageCropper = null;
  }
  imageFile.value = '';
}

/**
 * Reset video upload state
 */
function resetVideoUpload() {
  videoUpload.style.display = 'flex';
  videoPreview.style.display = 'none';
  videoPreview.innerHTML = '';
  document.getElementById('videoFileUrl').value = '';
  currentVideoFile = null;
  videoFile.value = '';
}
window.resetVideoUpload = resetVideoUpload;

/**
 * Reset video thumbnail upload state
 */
function resetVideoThumbnailUpload() {
  videoThumbnailUpload.style.display = 'flex';
  videoThumbnailCropperContainer.style.display = 'none';
  videoThumbnailCropperContainer.innerHTML = '';
  document.getElementById('videoThumbnailUrl').value = '';
  document.getElementById('videoFullsizeUrl').value = '';
  currentVideoThumbnailFile = null;
  if (videoThumbnailCropper) {
    videoThumbnailCropper.destroy();
    videoThumbnailCropper = null;
  }
  videoThumbnailFile.value = '';
}
window.resetVideoThumbnailUpload = resetVideoThumbnailUpload;

/**
 * Handle login form submission
 */
async function handleLogin(e) {
  e.preventDefault();
  hideError();

  const password = document.getElementById('password').value;

  try {
    showLoading('Signing in...');
    await authService.signIn(password);
    hideLoading();
    showDashboard();
    loadPortfolioItems();
  } catch (error) {
    hideLoading();
    showError(error.message || 'Invalid password');
  }
}

/**
 * Handle logout
 */
async function handleLogout() {
  try {
    await authService.signOut();
    showLogin();
  } catch (error) {
    showToast('Failed to sign out', 'error');
  }
}

/**
 * Load portfolio items from API
 */
async function loadPortfolioItems() {
  try {
    showLoading('Loading portfolio items...');
    portfolioItems = await portfolioService.getAll();
    renderPortfolioGrid();
    hideLoading();
  } catch (error) {
    hideLoading();
    showToast('Failed to load portfolio items', 'error');
    console.error(error);
  }
}

/**
 * Render the portfolio grid
 */
function renderPortfolioGrid() {
  const filtered = currentFilter === 'all'
    ? portfolioItems
    : portfolioItems.filter(item => item.category === currentFilter);

  if (filtered.length === 0) {
    portfolioGrid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  portfolioGrid.innerHTML = filtered.map(item => `
    <div class="admin-card" data-id="${item.id}">
      <div class="admin-card-image">
        <img src="${item.thumbnail_url}" alt="${item.title}" loading="lazy">
        <span class="admin-card-badge ${item.category}">${item.category}</span>
        ${item.type === 'video' ? '<span class="admin-card-video-icon">▶</span>' : ''}
      </div>
      <div class="admin-card-content">
        <h3 class="admin-card-title">${item.title}</h3>
        <p class="admin-card-meta">${item.type} • ${formatDate(item.created_at)}</p>
        <div class="admin-card-actions">
          <button class="btn btn-edit" onclick="editItem('${item.id}')">Edit</button>
          <button class="btn btn-delete" onclick="deleteItem('${item.id}', '${escapeHtml(item.title)}')">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * Escape HTML for safe insertion
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Open modal for adding/editing
 */
function openModal(item = null) {
  editingItem = item;
  modalTitle.textContent = item ? 'Edit Portfolio Item' : 'Add Portfolio Item';

  // Reset form
  itemForm.reset();
  document.getElementById('itemId').value = '';
  document.getElementById('thumbnailUrl').value = '';
  document.getElementById('fullsizeUrl').value = '';
  document.getElementById('originalImageData').value = '';
  document.getElementById('videoFileUrl').value = '';
  document.getElementById('videoThumbnailUrl').value = '';
  document.getElementById('videoFullsizeUrl').value = '';

  resetImageUpload();
  resetVideoUpload();
  resetVideoThumbnailUpload();

  // Default to image type
  itemType.value = 'image';
  handleTypeChange();

  // Populate form if editing
  if (item) {
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemTitle').value = item.title;
    document.getElementById('itemCategory').value = item.category;
    document.getElementById('itemType').value = item.type;
    document.getElementById('itemDescription').value = item.description || '';

    // Trigger type change to show correct upload sections
    handleTypeChange();

    if (item.type === 'image') {
      document.getElementById('thumbnailUrl').value = item.thumbnail_url;
      document.getElementById('fullsizeUrl').value = item.fullsize_url;

      // Show existing image in cropper container
      imageUpload.style.display = 'none';
      cropperContainer.style.display = 'block';
      cropperContainer.innerHTML = `
        <div class="existing-image-preview">
          <img src="${item.fullsize_url}" alt="Current image">
          <p class="existing-image-hint">Huidige afbeelding. Upload een nieuwe om te wijzigen.</p>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.triggerImageReupload()">Verander afbeelding</button>
        </div>
      `;
    } else {
      // Video type
      document.getElementById('videoThumbnailUrl').value = item.thumbnail_url;
      document.getElementById('videoFullsizeUrl').value = item.fullsize_url;
      document.getElementById('videoFileUrl').value = item.video_url || '';

      // Show existing video
      if (item.video_url) {
        videoUpload.style.display = 'none';
        videoPreview.style.display = 'block';
        videoPreview.innerHTML = `
          <div class="video-preview-content">
            <div class="video-preview-icon">🎬</div>
            <p class="video-preview-name">Huidige video</p>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.resetVideoUpload()">Verander video</button>
          </div>
        `;
      }

      // Show existing thumbnail
      videoThumbnailUpload.style.display = 'none';
      videoThumbnailCropperContainer.style.display = 'block';
      videoThumbnailCropperContainer.innerHTML = `
        <div class="existing-image-preview">
          <img src="${item.fullsize_url}" alt="Current thumbnail">
          <p class="existing-image-hint">Huidige thumbnail. Upload een nieuwe om te wijzigen.</p>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.resetVideoThumbnailUpload(); videoThumbnailFile.click();">Verander thumbnail</button>
        </div>
      `;
    }
  }

  itemModal.classList.add('active');
}

/**
 * Trigger image re-upload when editing
 */
window.triggerImageReupload = function() {
  resetImageUpload();
  imageFile.click();
};

/**
 * Close add/edit modal
 */
function closeModal() {
  itemModal.classList.remove('active');
  editingItem = null;
  resetImageUpload();
  resetVideoUpload();
  resetVideoThumbnailUpload();
}

/**
 * Handle save item (create/update)
 */
async function handleSaveItem(e) {
  e.preventDefault();

  const itemId = document.getElementById('itemId').value;
  const type = document.getElementById('itemType').value;

  let thumbnailUrl, fullsizeUrl, videoUrl;

  if (type === 'image') {
    thumbnailUrl = document.getElementById('thumbnailUrl').value;
    fullsizeUrl = document.getElementById('fullsizeUrl').value;

    // If there's a new image to upload
    if (currentImageFile && imageCropper) {
      try {
        showLoading('Uploading images...');

        // Upload full size image
        fullsizeUrl = await storageService.uploadFile(currentImageFile, 'fullsize');

        // Get cropped thumbnail blob and upload
        const thumbnailBlob = await imageCropper.getCroppedBlob(0.85);
        if (thumbnailBlob) {
          const thumbnailFile = new File([thumbnailBlob], 'thumbnail.jpg', { type: 'image/jpeg' });
          thumbnailUrl = await storageService.uploadFile(thumbnailFile, 'thumbnails');
        }

        hideLoading();
      } catch (error) {
        hideLoading();
        showToast('Failed to upload images: ' + error.message, 'error');
        return;
      }
    }

    // Validate that we have images
    if (!thumbnailUrl || !fullsizeUrl) {
      showToast('Please upload an image', 'error');
      return;
    }
  } else {
    // Video type
    thumbnailUrl = document.getElementById('videoThumbnailUrl').value;
    fullsizeUrl = document.getElementById('videoFullsizeUrl').value;
    videoUrl = document.getElementById('videoFileUrl').value;

    // Upload new video if selected
    if (currentVideoFile) {
      try {
        showLoading('Uploading video... This may take a while for large files.');
        videoUrl = await storageService.uploadFile(currentVideoFile, 'videos');
        hideLoading();
      } catch (error) {
        hideLoading();
        showToast('Failed to upload video: ' + error.message, 'error');
        return;
      }
    }

    // Upload new thumbnail if selected
    if (currentVideoThumbnailFile && videoThumbnailCropper) {
      try {
        showLoading('Uploading thumbnail...');

        // Upload full size thumbnail
        fullsizeUrl = await storageService.uploadFile(currentVideoThumbnailFile, 'fullsize');

        // Get cropped thumbnail blob and upload
        const thumbnailBlob = await videoThumbnailCropper.getCroppedBlob(0.85);
        if (thumbnailBlob) {
          const thumbFile = new File([thumbnailBlob], 'thumbnail.jpg', { type: 'image/jpeg' });
          thumbnailUrl = await storageService.uploadFile(thumbFile, 'thumbnails');
        }

        hideLoading();
      } catch (error) {
        hideLoading();
        showToast('Failed to upload thumbnail: ' + error.message, 'error');
        return;
      }
    }

    // Validate that we have required files
    if (!thumbnailUrl || !fullsizeUrl) {
      showToast('Please upload a thumbnail image', 'error');
      return;
    }
    if (!videoUrl) {
      showToast('Please upload a video file', 'error');
      return;
    }
  }

  const itemData = {
    title: document.getElementById('itemTitle').value,
    category: document.getElementById('itemCategory').value,
    type: type,
    thumbnail_url: thumbnailUrl,
    fullsize_url: fullsizeUrl,
    video_url: type === 'video' ? videoUrl : null,
    description: document.getElementById('itemDescription').value || null,
  };

  try {
    showLoading(itemId ? 'Updating item...' : 'Creating item...');

    if (itemId) {
      await portfolioService.update(itemId, itemData);
      showToast('Item updated successfully', 'success');
    } else {
      await portfolioService.create(itemData);
      showToast('Item created successfully', 'success');
    }

    closeModal();
    await loadPortfolioItems();
    hideLoading();
  } catch (error) {
    hideLoading();
    showToast('Failed to save item: ' + error.message, 'error');
  }
}

/**
 * Edit an item
 */
window.editItem = async function(id) {
  const item = portfolioItems.find(i => i.id === id);
  if (item) {
    openModal(item);
  }
};

/**
 * Delete an item (show confirmation)
 */
window.deleteItem = function(id, title) {
  deleteTargetId = id;
  document.getElementById('deleteItemTitle').textContent = title;
  deleteModal.classList.add('active');
};

/**
 * Close delete modal
 */
function closeDeleteModal() {
  deleteModal.classList.remove('active');
  deleteTargetId = null;
}

/**
 * Handle delete confirmation
 */
async function handleDeleteConfirm() {
  if (!deleteTargetId) return;

  try {
    showLoading('Deleting item...');
    await portfolioService.delete(deleteTargetId);
    showToast('Item deleted successfully', 'success');
    closeDeleteModal();
    await loadPortfolioItems();
    hideLoading();
  } catch (error) {
    hideLoading();
    showToast('Failed to delete item: ' + error.message, 'error');
  }
}

/**
 * Show login view
 */
function showLogin() {
  loginView.style.display = 'flex';
  dashboardView.style.display = 'none';
}

/**
 * Show dashboard view
 */
function showDashboard() {
  loginView.style.display = 'none';
  dashboardView.style.display = 'block';
}

/**
 * Show error message
 */
function showError(message) {
  loginError.textContent = message;
  loginError.style.display = 'block';
}

/**
 * Hide error message
 */
function hideError() {
  loginError.style.display = 'none';
}

/**
 * Show loading overlay
 */
function showLoading(message = 'Loading...') {
  loadingText.textContent = message;
  loadingOverlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
function hideLoading() {
  loadingOverlay.style.display = 'none';
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

/**
 * Format date
 */
function formatDate(dateString) {
  if (!dateString) return 'Unknown date';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Make functions available globally for onclick handlers
window.closeModal = closeModal;
window.closeDeleteModal = closeDeleteModal;

/* ===================================
   Pricing Editor
   =================================== */

let activePricingLang = 'nl';
/** In-memory store: { nl: {...}, en: {...} } */
const pricingData = { nl: {}, en: {} };

/**
 * Get nested value by dot-notation key
 */
function getPricingValue(obj, dotKey) {
  return dotKey.split('.').reduce((cur, k) => (cur && cur[k] !== undefined ? cur[k] : ''), obj);
}

/**
 * Set nested value by dot-notation key
 */
function setPricingValue(obj, dotKey, value) {
  const keys = dotKey.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]] || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

/**
 * Populate form fields from pricingData[lang]
 */
function populatePricingForm(lang) {
  const data = pricingData[lang] || {};
  document.querySelectorAll('[data-pricing-key]').forEach(el => {
    el.value = getPricingValue(data, el.dataset.pricingKey) || '';
  });
}

/**
 * Read form fields into pricingData[lang]
 */
function readPricingForm(lang) {
  if (!pricingData[lang]) pricingData[lang] = {};
  document.querySelectorAll('[data-pricing-key]').forEach(el => {
    setPricingValue(pricingData[lang], el.dataset.pricingKey, el.value);
  });
}

/**
 * Load pricing translations from the API for both languages
 */
async function loadPricingTranslations() {
  for (const lang of ['nl', 'en']) {
    try {
      // First load static file as baseline
      const staticRes = await fetch(`/translations/${lang}.json`);
      if (staticRes.ok) {
        const staticData = await staticRes.json();
        pricingData[lang] = staticData.pricing || {};
      }
      // Then try API overrides (KV)
      if (API_BASE) {
        const apiRes = await fetch(`${API_BASE}/api/pricing-text/${lang}`);
        if (apiRes.ok) {
          const overrides = await apiRes.json();
          if (overrides && Object.keys(overrides).length > 0) {
            // Deep merge overrides on top of static
            deepMergeInto(pricingData[lang], overrides);
          }
        }
      }
    } catch (e) {
      console.error(`Failed to load pricing for ${lang}:`, e);
    }
  }
  populatePricingForm(activePricingLang);
}

function deepMergeInto(target, source) {
  for (const key of Object.keys(source || {})) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMergeInto(target[key], source[key]);
    } else if (source[key] !== undefined && source[key] !== '') {
      target[key] = source[key];
    }
  }
}

/**
 * Save pricing translations to the API for both languages
 */
async function savePricingTranslations() {
  // Capture current form into active lang first
  readPricingForm(activePricingLang);

  if (!API_BASE) {
    showToast('API niet geconfigureerd — sla wijzigingen op via de bronbestanden.', 'error');
    return;
  }

  const token = authService.getToken();
  if (!token) {
    showToast('Niet ingelogd', 'error');
    return;
  }

  showLoading('Opslaan...');
  try {
    for (const lang of ['nl', 'en']) {
      const res = await fetch(`${API_BASE}/api/pricing-text/${lang}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(pricingData[lang]),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Fout bij opslaan ${lang}`);
      }
    }
    showToast('Tarieven teksten opgeslagen', 'success');
  } catch (e) {
    showToast('Opslaan mislukt: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Set up pricing tab UI
 */
function setupPricingEditor() {
  // Tab switching
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.getElementById('tabPortfolio').style.display = target === 'portfolio' ? '' : 'none';
      document.getElementById('tabPricing').style.display = target === 'pricing' ? '' : 'none';
      if (target === 'pricing') loadPricingTranslations();
    });
  });

  // Language switching within pricing tab
  document.querySelectorAll('[data-pricing-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Save current form state before switching
      readPricingForm(activePricingLang);
      // Switch language
      activePricingLang = btn.dataset.pricingLang;
      document.querySelectorAll('[data-pricing-lang]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      populatePricingForm(activePricingLang);
    });
  });

  // Save button
  document.getElementById('savePricingBtn').addEventListener('click', savePricingTranslations);
}

// Initialize
init();
setupPricingEditor();
