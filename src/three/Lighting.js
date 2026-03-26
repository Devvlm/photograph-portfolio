/**
 * Lighting Setup for Three.js Scene
 * Provides cinematic lighting for PBR materials
 */

import * as THREE from 'three';

export class Lighting {
  constructor(scene) {
    this.scene = scene;
    this.lights = [];
    this.setupLights();
  }

  setupLights() {
    // Ambient light for base illumination
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);
    this.lights.push(ambient);

    // Main key light (warm)
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 50;
    this.scene.add(keyLight);
    this.lights.push(keyLight);

    // Fill light (cool, from opposite side)
    const fillLight = new THREE.DirectionalLight(0xe6f0ff, 0.5);
    fillLight.position.set(-5, 3, -5);
    this.scene.add(fillLight);
    this.lights.push(fillLight);

    // Rim/back light for edge definition
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(0, 5, -10);
    this.scene.add(rimLight);
    this.lights.push(rimLight);

    // Accent light (colored, for drama)
    const accentLight = new THREE.PointLight(0xe63946, 0.5, 20);
    accentLight.position.set(-3, 2, 3);
    this.scene.add(accentLight);
    this.lights.push(accentLight);
  }

  /**
   * Update light intensities based on scroll or time
   * @param {number} factor - 0 to 1 intensity multiplier
   */
  setIntensity(factor) {
    this.lights.forEach(light => {
      if (light.userData.baseIntensity === undefined) {
        light.userData.baseIntensity = light.intensity;
      }
      light.intensity = light.userData.baseIntensity * factor;
    });
  }

  dispose() {
    this.lights.forEach(light => {
      this.scene.remove(light);
      if (light.dispose) light.dispose();
    });
    this.lights = [];
  }
}
