/**
 * Three.js Scene Manager
 * Orchestrates the 3D scene, camera, renderer, and all components
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Lighting } from './Lighting.js';
import { ClapperboardModel } from './ClapperboardModel.js';
import { FloatingImages } from './FloatingImages.js';
import {
  isMobile,
  getDevicePixelRatio,
  shouldEnableAntialias,
} from './utils/responsive.js';

export class SceneManager {
  constructor(container) {
    this.container = container;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    // Flags
    this.isInitialized = false;
    this.isAnimating = false;
    this.isVisible = true;

    // Time tracking
    this.clock = new THREE.Clock();
    this.elapsedTime = 0;

    // Mouse tracking (unused, kept for potential future use)
    this.mouse = new THREE.Vector2();

    // Components
    this.lighting = null;
    this.clapperboard = null;
    this.floatingImages = null;

    this.init();
  }

  init() {
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupControls();
    this.setupComponents();
    this.setupEventListeners();

    this.isInitialized = true;
  }

  setupScene() {
    this.scene = new THREE.Scene();
    // Transparent background to show CSS background
    this.scene.background = null;
  }

  setupCamera() {
    const aspect = this.width / this.height;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 8);
    this.camera.lookAt(0, 0, 0);
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: shouldEnableAntialias(),
      alpha: true,
      powerPreference: 'high-performance',
    });

    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(getDevicePixelRatio());
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enabled = false;
  }

  setupComponents() {
    // Add lighting
    this.lighting = new Lighting(this.scene);

    // Create clapperboard handler
    this.clapperboard = new ClapperboardModel(this.scene);

    // Create floating images handler
    this.floatingImages = new FloatingImages(this.scene);
  }

  setupEventListeners() {
    // Window resize
    window.addEventListener('resize', () => this.onResize());

    // Visibility change for performance
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
      if (this.isVisible && !this.isAnimating) {
        this.clock.start();
        this.animate();
      }
    });

    // Scroll for hero fade effect
    window.addEventListener('scroll', () => this.onScroll());
  }

  onScroll() {
    const scrollY = window.scrollY;
    const heroHeight = this.container.clientHeight;
    const scrollProgress = Math.min(scrollY / heroHeight, 1);

    // Fade out based on scroll
    if (scrollProgress > 0.3) {
      const opacity = 1 - (scrollProgress - 0.3) / 0.7;
      this.container.style.opacity = Math.max(opacity, 0);
    } else {
      this.container.style.opacity = 1;
    }
  }

  onResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(getDevicePixelRatio());

    if (this.clapperboard) this.clapperboard.onResize();
    if (this.floatingImages) this.floatingImages.onResize();
  }

  /**
   * Load all 3D assets
   * @param {Object} options - Loading options
   * @param {string} options.modelUrl - Path to clapperboard GLB
   * @param {string[]} options.imageUrls - Array of floating image URLs
   * @param {Function} options.onProgress - Progress callback
   * @returns {Promise}
   */
  async loadAssets({ modelUrl, imageUrls, onProgress }) {
    let loadedCount = 0;
    const totalItems = 2; // Model + images batch

    const updateProgress = () => {
      loadedCount++;
      if (onProgress) {
        onProgress(loadedCount / totalItems);
      }
    };

    try {
      // Load clapperboard model
      await this.clapperboard.load(modelUrl, (progress) => {
        if (onProgress) onProgress(progress * 0.5);
      });
      updateProgress();

      // Load floating images
      await this.floatingImages.load(imageUrls);
      updateProgress();

      return true;
    } catch (error) {
      console.error('Error loading assets:', error);
      // Continue with fallback model
      updateProgress();
      await this.floatingImages.load(imageUrls);
      updateProgress();
      return true;
    }
  }

  animate() {
    if (!this.isVisible) {
      this.isAnimating = false;
      return;
    }

    this.isAnimating = true;
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    this.elapsedTime = this.clock.getElapsedTime();

    // Update controls
    this.controls.update();

    // Update components
    if (this.clapperboard) {
      this.clapperboard.update(delta, this.elapsedTime);
    }

    if (this.floatingImages) {
      this.floatingImages.update(delta, this.elapsedTime);
    }

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    this.clock.start();
    this.animate();
  }

  stop() {
    this.isAnimating = false;
    this.clock.stop();
  }

  dispose() {
    this.stop();

    // Remove event listeners
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('scroll', this.onScroll);

    // Dispose components
    if (this.lighting) this.lighting.dispose();
    if (this.clapperboard) this.clapperboard.dispose();
    if (this.floatingImages) this.floatingImages.dispose();

    // Dispose controls
    if (this.controls) this.controls.dispose();

    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }

    // Clear scene
    this.scene.clear();
  }
}
