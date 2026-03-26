/**
 * Asset Loaders for Three.js
 * Handles loading of GLB models and textures
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Create reusable loaders
const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

/**
 * Load a GLB/GLTF model
 * @param {string} url - Path to the model
 * @param {Function} onProgress - Progress callback
 * @returns {Promise} - Resolves with the loaded model
 */
export function loadModel(url, onProgress) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => resolve(gltf),
      (event) => {
        if (onProgress && event.lengthComputable) {
          onProgress(event.loaded / event.total);
        }
      },
      (error) => reject(error)
    );
  });
}

/**
 * Load a texture
 * @param {string} url - Path to the texture
 * @returns {Promise} - Resolves with the loaded texture
 */
export function loadTexture(url) {
  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (texture) => resolve(texture),
      undefined,
      (error) => reject(error)
    );
  });
}

/**
 * Load multiple textures
 * @param {string[]} urls - Array of texture URLs
 * @returns {Promise} - Resolves with array of loaded textures
 */
export function loadTextures(urls) {
  return Promise.all(urls.map(url => loadTexture(url)));
}

/**
 * Preload images as textures with error handling
 * @param {string[]} urls - Array of image URLs
 * @returns {Promise} - Resolves with array of textures (null for failed loads)
 */
export function preloadImages(urls) {
  return Promise.all(
    urls.map(url =>
      loadTexture(url).catch(() => {
        console.warn(`Failed to load texture: ${url}`);
        return null;
      })
    )
  );
}
