/**
 * Internationalization (i18n) Manager
 * Handles language detection, translation loading, and DOM updates
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source || {})) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else if (source[key] !== undefined && source[key] !== '') {
      result[key] = source[key];
    }
  }
  return result;
}

export class I18n {
  constructor() {
    this.currentLanguage = 'nl'; // default language
    this.translations = {};
    this.fallbackLanguage = 'nl';
  }

  /**
   * Initialize i18n system
   */
  async init() {
    // Detect preferred language
    const savedLanguage = localStorage.getItem('preferredLanguage');
    this.currentLanguage = savedLanguage || this.detectLanguage() || this.fallbackLanguage;
    
    // Load initial translations
    await this.setLanguage(this.currentLanguage);
    
    console.log(`i18n initialized with language: ${this.currentLanguage}`);
  }

  /**
   * Auto-detect browser language
   */
  detectLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    
    // Check for Dutch first (primary)
    if (browserLang.startsWith('nl') || browserLang.startsWith('NL')) {
      return 'nl';
    }
    
    // Check for English (secondary)
    if (browserLang.startsWith('en')) {
      return 'en';
    }
    
    // Default to Dutch
    return this.fallbackLanguage;
  }

  /**
   * Load translations from JSON file
   */
  async loadTranslations(lang) {
    try {
      const response = await fetch(`/translations/${lang}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load translations for ${lang}`);
      }
      const staticTranslations = await response.json();

      // Try to load pricing overrides from the worker KV
      if (API_BASE) {
        try {
          const overridesRes = await fetch(`${API_BASE}/api/pricing-text/${lang}`);
          if (overridesRes.ok) {
            const overrides = await overridesRes.json();
            if (overrides && Object.keys(overrides).length > 0) {
              staticTranslations.pricing = deepMerge(
                staticTranslations.pricing || {},
                overrides
              );
            }
          }
        } catch (_) {
          // Silently fall back to static translations
        }
      }

      return staticTranslations;
    } catch (error) {
      console.error(`Error loading translations for ${lang}:`, error);

      // Fallback to default language
      if (lang !== this.fallbackLanguage) {
        console.log(`Falling back to ${this.fallbackLanguage}`);
        return await this.loadTranslations(this.fallbackLanguage);
      }
      return {};
    }
  }

  /**
   * Set language and update DOM
   */
  async setLanguage(lang) {
    try {
      this.currentLanguage = lang;
      this.translations = await this.loadTranslations(lang);
      
      // Save preference
      localStorage.setItem('preferredLanguage', lang);
      
      // Update DOM
      this.updateDOM();
      this.updateHTMLLang();
      this.updateLanguageToggle();
      
      console.log(`Language switched to: ${lang}`);
    } catch (error) {
      console.error(`Failed to set language ${lang}:`, error);
    }
  }

  /**
   * Get translation by key with nesting support
   */
  t(key, params = {}) {
    const value = this.getNestedValue(this.translations, key);
    
    if (!value) {
      console.warn(`Translation key not found: ${key}`);
      return key; // Return key as fallback
    }
    
    return this.interpolate(value, params);
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  /**
   * Interpolate variables in translation string
   */
  interpolate(str, params) {
    if (typeof str !== 'string') return str;
    
    return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  /**
   * Update all elements with data-i18n-key attributes
   */
  updateDOM() {
    // Find all elements with translation keys
    const elements = document.querySelectorAll('[data-i18n-key]');
    
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n-key');
      const translation = this.t(key);
      
      if (translation) {
        // Handle different element types
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          element.placeholder = translation;
        } else if (element.tagName === 'TITLE') {
          element.textContent = translation;
        } else if (element.tagName === 'META' && element.name === 'description') {
          element.content = translation;
        } else {
          element.textContent = translation;
        }
      }
    });
  }

  /**
   * Update HTML lang attribute
   */
  updateHTMLLang() {
    const htmlElement = document.documentElement;
    if (htmlElement) {
      htmlElement.lang = this.currentLanguage;
    }
  }

  /**
   * Update language navigation active states
   */
  updateLanguageToggle() {
    const nlLink = document.getElementById('langNL');
    const enLink = document.getElementById('langEN');
    
    if (nlLink && enLink) {
      // Remove active class from both
      nlLink.classList.remove('active');
      enLink.classList.remove('active');
      
      // Add active class to current language
      if (this.currentLanguage === 'nl') {
        nlLink.classList.add('active');
      } else {
        enLink.classList.add('active');
      }
    }
  }

  /**
   * Set specific language
   */
  async setSpecificLanguage(lang) {
    if (lang !== this.currentLanguage && (lang === 'nl' || lang === 'en')) {
      await this.setLanguage(lang);
    }
  }

  /**
   * Toggle between languages
   */
  async toggleLanguage() {
    const newLang = this.currentLanguage === 'nl' ? 'en' : 'nl';
    await this.setLanguage(newLang);
  }

  /**
   * Get current language
   */
  getCurrentLanguage() {
    return this.currentLanguage;
  }

  /**
   * Get available languages
   */
  getAvailableLanguages() {
    return ['nl', 'en'];
  }
}