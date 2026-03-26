/**
 * Responsive Utilities for Three.js
 * Handles mobile detection and performance optimization
 */

export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth < 768;
}

export function isTablet() {
  return window.innerWidth >= 768 && window.innerWidth < 1024;
}

export function getDevicePixelRatio() {
  // Limit pixel ratio for performance
  const maxRatio = isMobile() ? 2 : 2.5;
  return Math.min(window.devicePixelRatio, maxRatio);
}

export function getOptimalImageCount() {
  if (isMobile()) return 6;
  if (isTablet()) return 8;
  return 12;
}

export function shouldEnableAntialias() {
  return !isMobile();
}

export function getOptimalShadowMapSize() {
  if (isMobile()) return 512;
  if (isTablet()) return 1024;
  return 2048;
}
