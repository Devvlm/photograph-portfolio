/**
 * Clapperboard Model Handler
 * Loads and manages the 3D clapperboard with interactions
 */

import * as THREE from 'three';
import { loadModel } from './utils/loaders.js';

export class ClapperboardModel {
  constructor(scene) {
    this.scene = scene;
    this.model = null;
    this.mixer = null;
    this.isLoaded = false;
    this.autoRotateSpeed = 0.003;
  }

  /**
   * Load the clapperboard GLB model
   * @param {string} url - Path to the GLB file
   * @param {Function} onProgress - Progress callback
   * @returns {Promise}
   */
  async load(url, onProgress) {
    try {
      const gltf = await loadModel(url, onProgress);
      this.model = gltf.scene;

      // Center and scale the model
      const box = new THREE.Box3().setFromObject(this.model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // Scale to fit nicely in view
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2.5 / maxDim;
      this.model.scale.setScalar(scale);

      // Center the model
      this.model.position.sub(center.multiplyScalar(scale));

      // Enable shadows for all meshes
      this.model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Setup animations if present
      if (gltf.animations && gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.model);
        const action = this.mixer.clipAction(gltf.animations[0]);
        action.play();
      }

      this.scene.add(this.model);
      this.isLoaded = true;

      return this.model;
    } catch (error) {
      console.error('Failed to load clapperboard model:', error);
      // Create a fallback placeholder
      this.createFallbackModel();
      throw error;
    }
  }

  /**
   * Create a simple fallback clapperboard shape
   */
  createFallbackModel() {
    const group = new THREE.Group();

    // Main board
    const boardGeometry = new THREE.BoxGeometry(2.5, 0.1, 1.8);
    const boardMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.8,
      metalness: 0.2
    });
    const board = new THREE.Mesh(boardGeometry, boardMaterial);
    group.add(board);

    // Clapper top
    const clapperGeometry = new THREE.BoxGeometry(2.5, 0.08, 0.5);
    const clapperMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.7,
      metalness: 0.3
    });
    const clapper = new THREE.Mesh(clapperGeometry, clapperMaterial);
    clapper.position.set(0, 0.1, -0.65);
    clapper.rotation.x = -0.1;
    group.add(clapper);

    // Stripes on clapper
    const stripeGeometry = new THREE.BoxGeometry(0.3, 0.09, 0.5);
    const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });

    for (let i = 0; i < 5; i++) {
      const stripe = new THREE.Mesh(
        stripeGeometry,
        i % 2 === 0 ? whiteMaterial : blackMaterial
      );
      stripe.position.set(-1 + i * 0.5, 0.11, -0.65);
      stripe.rotation.x = -0.1;
      group.add(stripe);
    }

    // Red accent
    const accentGeometry = new THREE.BoxGeometry(2.5, 0.02, 0.3);
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xe63946 });
    const accent = new THREE.Mesh(accentGeometry, accentMaterial);
    accent.position.set(0, 0.06, 0.5);
    group.add(accent);

    group.rotation.x = -0.3;
    this.model = group;
    this.scene.add(this.model);
    this.isLoaded = true;
  }

  /**
   * Update animation and rotation
   * @param {number} delta - Time delta in seconds
   * @param {number} time - Total elapsed time
   */
  update(delta, time) {
    if (!this.model) return;

    // Update animation mixer
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Gentle auto-rotation
    this.model.rotation.y += this.autoRotateSpeed;
    // Subtle floating motion
    this.model.position.y = Math.sin(time * 0.5) * 0.1;
  }

  /**
   * Handle window resize
   */
  onResize() {
    // Model is scale-independent, no resize handling needed
  }

  dispose() {
    if (this.model) {
      this.scene.remove(this.model);
      this.model.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
  }
}
