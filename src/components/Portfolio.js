/**
 * Portfolio Component
 * Handles gallery filtering, rendering, and lightbox
 * Supports both API data and static fallback
 */

import { portfolioItems as staticItems } from '../data/portfolio.js';
import { portfolioService } from '../lib/database.js';

export async function initPortfolio() {
  const grid = document.getElementById('portfolioGrid');
  const lightbox = document.getElementById('lightbox');
  const lightboxContent = document.getElementById('lightboxContent');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');

  let currentIndex = 0;
  let portfolioItems = [];
  let filteredItems = [];

  // Load portfolio items (from API or fallback to static)
  async function loadItems() {
    try {
      const apiItems = await portfolioService.getAll();
      if (apiItems && apiItems.length > 0) {
        // Transform API data to match expected format
        portfolioItems = apiItems.map(item => ({
          id: item.id,
          title: item.title,
          category: item.category,
          type: item.type,
          thumbnail: item.thumbnail_url,
          fullsize: item.fullsize_url,
          videoUrl: item.video_url,
          description: item.description
        }));
      } else {
        // Fall back to static items if API is empty
        portfolioItems = staticItems;
      }
    } catch (error) {
      console.warn('Failed to load from API, using static data:', error);
      portfolioItems = staticItems;
    }

    renderItems();
  }

  // Render portfolio items
  function renderItems() {
    filteredItems = [...portfolioItems];

    grid.innerHTML = filteredItems.map((item, index) => `
      <div class="portfolio-item" data-index="${index}" data-type="${item.type}">
        <img src="${item.thumbnail}" alt="${item.title}" loading="lazy">
        ${item.type === 'video' && item.videoUrl ? `
          <video class="portfolio-hover-video" muted loop playsinline preload="none">
            <source src="${item.videoUrl}" type="video/mp4">
          </video>
        ` : ''}
        <div class="portfolio-overlay">
          <span class="portfolio-category">DTRMNDVISUALS</span>
          <h3 class="portfolio-title">${item.title}</h3>
        </div>
      </div>
    `).join('');

    // Add click listeners and hover-to-play for video items
    const items = grid.querySelectorAll('.portfolio-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        openLightbox(index);
      });

      const hoverVideo = item.querySelector('.portfolio-hover-video');
      if (hoverVideo) {
        item.addEventListener('mouseenter', () => {
          hoverVideo.currentTime = 0;
          hoverVideo.style.opacity = '1';
          item.classList.add('is-playing');
          hoverVideo.play().catch(() => {});
        });
        item.addEventListener('mouseleave', () => {
          hoverVideo.pause();
          hoverVideo.currentTime = 0;
          hoverVideo.style.opacity = '0';
          item.classList.remove('is-playing');
        });
      }
    });

    // Animate items in
    items.forEach((item, i) => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(20px)';
      setTimeout(() => {
        item.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        item.style.opacity = '1';
        item.style.transform = 'translateY(0)';
      }, i * 100);
    });
  }

  // Lightbox functions
  function openLightbox(index) {
    currentIndex = index;
    updateLightboxContent();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  function updateLightboxContent() {
    const item = filteredItems[currentIndex];

    if (item.type === 'video' && item.videoUrl) {
      // Check if it's a YouTube or Vimeo URL
      const youtubeMatch = item.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
      const vimeoMatch = item.videoUrl.match(/vimeo\.com\/(\d+)/);

      if (youtubeMatch) {
        lightboxContent.innerHTML = `
          <iframe
            width="854"
            height="480"
            src="https://www.youtube.com/embed/${youtubeMatch[1]}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            style="max-width: 90vw; max-height: 80vh;"
          ></iframe>
        `;
      } else if (vimeoMatch) {
        lightboxContent.innerHTML = `
          <iframe
            width="854"
            height="480"
            src="https://player.vimeo.com/video/${vimeoMatch[1]}"
            frameborder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowfullscreen
            style="max-width: 90vw; max-height: 80vh;"
          ></iframe>
        `;
      } else {
        // Direct video URL
        lightboxContent.innerHTML = `
          <video
            controls
            autoplay
            playsinline
            controlsList="nodownload"
            disablePictureInPicture
            oncontextmenu="return false"
            style="max-width: 90vw; max-height: 75vh; display: block;">
            <source src="${item.videoUrl}" type="video/mp4">
            Your browser does not support the video tag.
          </video>
        `;
      }
    } else if (item.type === 'video') {
      // Video type but no video URL - show image with play button
      lightboxContent.innerHTML = `
        <img src="${item.fullsize}" alt="${item.title}" style="max-width: 90vw; max-height: 80vh;">
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background: rgba(230, 57, 70, 0.9); border-radius: 50%; width: 80px; height: 80px;
                    display: flex; align-items: center; justify-content: center;">
          <div style="border-style: solid; border-width: 15px 0 15px 25px;
                      border-color: transparent transparent transparent white; margin-left: 5px;"></div>
        </div>
      `;
    } else {
      lightboxContent.innerHTML = `<img src="${item.fullsize}" alt="${item.title}" style="max-width: 90vw; max-height: 80vh;">`;
    }
  }

  function navigateLightbox(direction) {
    currentIndex = (currentIndex + direction + filteredItems.length) % filteredItems.length;
    updateLightboxContent();
  }

  // Event listeners
  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
  }

  if (lightboxPrev) {
    lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
  }

  if (lightboxNext) {
    lightboxNext.addEventListener('click', () => navigateLightbox(1));
  }

  // Close on backdrop click
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;

    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });

  // Load and render items
  await loadItems();
}
