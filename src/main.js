/**
 * Main Entry Point
 * Initializes all components and sets up the application
 */

// Import styles
import './styles/main.css';
import './styles/hero.css';
import './styles/about.css';
import './styles/portfolio.css';
import './styles/contact.css';
import './styles/navigation.css';
import './styles/pricing.css';

// Import components
import { initNavigation } from './components/Navigation.js';
import { initHero } from './components/Hero.js';
import { initPortfolio } from './components/Portfolio.js';
import { initContact } from './components/Contact.js';
import { initPricing } from './components/Pricing.js';

// Import i18n
import { I18n } from './lib/i18n.js';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Portfolio site initializing...');

  // Initialize i18n first
  window.i18n = new I18n();
  await window.i18n.init();

  // Initialize language navigation
  const langNL = document.getElementById('langNL');
  const langEN = document.getElementById('langEN');
  
  if (langNL) {
    langNL.addEventListener('click', (e) => {
      e.preventDefault();
      window.i18n.setSpecificLanguage('nl');
    });
  }
  
  if (langEN) {
    langEN.addEventListener('click', (e) => {
      e.preventDefault();
      window.i18n.setSpecificLanguage('en');
    });
  }

  // Initialize navigation first (lightweight)
  initNavigation();

  // Initialize portfolio grid
  initPortfolio();

  // Initialize contact form
  initContact();

  // Initialize pricing section
  initPricing();

  // Initialize 3D hero section (async, may take time)
  await initHero();

  // Add intersection observer for section animations
  initScrollAnimations();

  console.log('Portfolio site ready!');
});

/**
 * Initialize scroll-triggered animations
 */
function initScrollAnimations() {
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe sections (skip pricing — it manages its own card animations)
  const sections = document.querySelectorAll('.section:not(.pricing)');
  sections.forEach(section => {
    section.style.opacity = '0';
    observer.observe(section);
  });

  // Observe individual elements that should animate
  const animateElements = document.querySelectorAll('.about-content, .about-image, .contact-info, .contact-form-wrapper');
  animateElements.forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
}
