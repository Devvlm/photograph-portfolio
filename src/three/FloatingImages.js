/**
 * Floating Images Component
 * Creates orbiting portfolio thumbnails around the central model
 */

import * as THREE from 'three';
import { preloadImages } from './utils/loaders.js';
import { getOptimalImageCount, isMobile } from './utils/responsive.js';

export class FloatingImages {
  constructor(scene) {
    this.scene = scene;
    this.images = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Configuration
    this.radius = isMobile() ? 4 : 5;
    this.imageSize = isMobile() ? 0.6 : 0.8;
    this.orbitSpeed = 0.0003;
    this.floatAmplitude = 0.2;
    this.floatSpeed = 0.5;
  }

  /**
   * Load and create floating image planes
   * @param {string[]} imageUrls - Array of image URLs
   * @returns {Promise}
   */
  async load(imageUrls) {
    const count = Math.min(imageUrls.length, getOptimalImageCount());
    const urls = imageUrls.slice(0, count);

    try {
      const textures = await preloadImages(urls);

      textures.forEach((texture, index) => {
        if (!texture) return;

        // Create image plane
        const geometry = new THREE.PlaneGeometry(
          this.imageSize * 1.33,  // 4:3 aspect ratio
          this.imageSize
        );

        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geometry, material);

        // Distribute in a sphere around the center
        const phi = Math.acos(-1 + (2 * index) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;

        const x = this.radius * Math.sin(phi) * Math.cos(theta);
        const y = this.radius * Math.sin(phi) * Math.sin(theta) * 0.6; // Flatten vertically
        const z = this.radius * Math.cos(phi);

        mesh.position.set(x, y, z);
        mesh.lookAt(0, 0, 0);

        // Store animation data
        mesh.userData = {
          originalPosition: mesh.position.clone(),
          orbitAngle: theta,
          orbitSpeed: this.orbitSpeed * (0.8 + Math.random() * 0.4),
          floatOffset: Math.random() * Math.PI * 2,
          floatSpeed: this.floatSpeed * (0.8 + Math.random() * 0.4),
          parallaxDepth: 0.5 + Math.random() * 0.5,
        };

        this.group.add(mesh);
        this.images.push(mesh);
      });

      return this.images;
    } catch (error) {
      console.error('Failed to load floating images:', error);
      throw error;
    }
  }

  /**
   * Update animations
   * @param {number} delta - Time delta
   * @param {number} time - Total elapsed time
   */
  update(delta, time) {
    this.images.forEach((mesh) => {
      const data = mesh.userData;

      // Orbital rotation
      data.orbitAngle += data.orbitSpeed;

      // Calculate new position based on orbit
      const orbitX = Math.cos(data.orbitAngle) * data.originalPosition.x -
                     Math.sin(data.orbitAngle) * data.originalPosition.z;
      const orbitZ = Math.sin(data.orbitAngle) * data.originalPosition.x +
                     Math.cos(data.orbitAngle) * data.originalPosition.z;

      // Floating motion
      const floatY = Math.sin(time * data.floatSpeed + data.floatOffset) * this.floatAmplitude;

      // Apply all transformations
      mesh.position.x = orbitX;
      mesh.position.y = data.originalPosition.y + floatY;
      mesh.position.z = orbitZ;

      // Always face the camera (billboarding)
      mesh.lookAt(0, 0, 0);

      // Subtle opacity based on depth
      const distanceFromCamera = mesh.position.z;
      mesh.material.opacity = THREE.MathUtils.mapLinear(
        distanceFromCamera,
        -this.radius,
        this.radius,
        0.5,
        1
      );
    });

    // Slow global rotation of the entire group
    this.group.rotation.y += 0.0002;
  }

  /**
   * Set visibility (for scroll-based hiding)
   * @param {number} opacity - 0 to 1
   */
  setOpacity(opacity) {
    this.images.forEach(mesh => {
      mesh.material.opacity = opacity * mesh.userData.baseOpacity || opacity * 0.9;
    });
  }

  /**
   * Handle window resize
   */
  onResize() {
    const mobile = isMobile();
    this.radius = mobile ? 4 : 5;
    this.imageSize = mobile ? 0.6 : 0.8;

    // Update positions based on new radius
    this.images.forEach((mesh, index) => {
      const count = this.images.length;
      const phi = Math.acos(-1 + (2 * index) / count);
      const theta = mesh.userData.orbitAngle;

      const x = this.radius * Math.sin(phi) * Math.cos(theta);
      const y = this.radius * Math.sin(phi) * Math.sin(theta) * 0.6;
      const z = this.radius * Math.cos(phi);

      mesh.userData.originalPosition.set(x, y, z);
    });
  }

  dispose() {
    this.images.forEach(mesh => {
      this.group.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      if (mesh.material.map) mesh.material.map.dispose();
    });
    this.scene.remove(this.group);
    this.images = [];
  }
}
