/**
 * Hero Component
 * Integrates Three.js scene with the hero section
 */

import { SceneManager } from '../three/SceneManager.js';
import { floatingImages as staticImages } from '../data/portfolio.js';
import { portfolioService } from '../lib/database.js';

let sceneManager = null;

/**
 * Get floating images from API or fallback to static
 */
async function getFloatingImages() {
  try {
    const items = await portfolioService.getAll();
    if (items && items.length > 0) {
      const apiBase = import.meta.env.VITE_API_URL || '';
      return items.slice(0, 12).map(item => {
        const url = item.thumbnail_url;
        return url && url.startsWith('/') ? `${apiBase}${url}` : url;
      });
    }
  } catch (error) {
    console.warn('Failed to load images from API:', error);
  }
  return staticImages;
}

export async function initHero() {
  const heroCanvas = document.getElementById('heroCanvas');
  const heroLoader = document.getElementById('heroLoader');

  if (!heroCanvas) {
    console.error('Hero canvas container not found');
    return;
  }

  // Initialize Three.js scene
  sceneManager = new SceneManager(heroCanvas);

  // Get floating images
  const imageUrls = await getFloatingImages();

  // Load assets
  try {
    await sceneManager.loadAssets({
      modelUrl: '/models/clapperboard.glb',
      imageUrls: imageUrls,
      onProgress: (progress) => {
        // Update loading indicator if needed
        console.log(`Loading: ${Math.round(progress * 100)}%`);
      }
    });

    // Hide loader
    if (heroLoader) {
      heroLoader.classList.add('hidden');
      setTimeout(() => {
        heroLoader.style.display = 'none';
      }, 500);
    }

    // Start animation loop
    sceneManager.start();

  } catch (error) {
    console.error('Error initializing hero:', error);

    // Hide loader and show fallback
    if (heroLoader) {
      heroLoader.innerHTML = `
        <p class="hero-loader-text">Experience Ready</p>
      `;
      setTimeout(() => {
        heroLoader.classList.add('hidden');
      }, 1000);
    }

    // Still start the scene with fallback model
    sceneManager.start();
  }

  // Handle hero CTA buttons smooth scroll
  const heroButtons = document.querySelectorAll('.hero-cta a');
  heroButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const href = btn.getAttribute('href');
      if (href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          const navHeight = document.getElementById('nav')?.offsetHeight || 0;
          window.scrollTo({
            top: target.offsetTop - navHeight,
            behavior: 'smooth'
          });
        }
      }
    });
  });
}

// Export scene manager for external control
export function getSceneManager() {
  return sceneManager;
}

// Cleanup function
export function destroyHero() {
  if (sceneManager) {
    sceneManager.dispose();
    sceneManager = null;
  }
}
