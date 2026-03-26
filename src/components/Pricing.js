/* ===================================
   Pricing Section Component
   =================================== */

const PACKAGES = ['events', 'athlete', 'social'];

function t(key) {
  return window.i18n ? window.i18n.t(key) : key;
}

function getPkgData(pkgKey) {
  if (!window.i18n) return null;
  return window.i18n.getNestedValue(window.i18n.translations, `pricing.packages.${pkgKey}`);
}

function renderBullets(pkgKey) {
  const pkg = getPkgData(pkgKey);
  const bullets = pkg?.bullets;

  if (!bullets || !Array.isArray(bullets) || bullets.length === 0) return '';

  return bullets.map(b => {
    if (b.type === 'group') {
      return `<p class="pricing-item-group">${b.text || ''}</p>`;
    }
    return `<li class="pricing-item">${b.text || ''}</li>`;
  }).join('\n');
}

function renderCard(pkgKey) {
  const pk = `pricing.packages.${pkgKey}`;
  return `
    <article class="pricing-card">
      <div class="pricing-card-header">
        <h3 class="pricing-card-title" data-i18n-key="${pk}.title">${t(`${pk}.title`)}</h3>
        <p class="pricing-card-target" data-i18n-key="${pk}.target">${t(`${pk}.target`)}</p>
      </div>

      <div class="pricing-card-price">
        <span class="pricing-from" data-i18n-key="${pk}.from">${t(`${pk}.from`)}</span>
        <span class="pricing-amount" data-i18n-key="${pk}.price">${t(`${pk}.price`)}</span>
      </div>

      <p class="pricing-card-pitch" data-i18n-key="${pk}.pitch">${t(`${pk}.pitch`)}</p>

      <div class="pricing-card-divider"></div>

      <div class="pricing-card-inclusions">
        <p class="pricing-inclusions-label" data-i18n-key="pricing.includesLabel">${t('pricing.includesLabel')}</p>
        <ul class="pricing-items">
          ${renderBullets(pkgKey)}
        </ul>
      </div>

      <div class="pricing-card-footer">
        <p class="pricing-card-tagline" data-i18n-key="${pk}.tagline">${t(`${pk}.tagline`)}</p>
      </div>
    </article>
  `;
}

export function initPricing() {
  const section = document.getElementById('pricing');
  if (!section) return;

  section.innerHTML = `
    <div class="container">
      <div class="pricing-intro">
        <span class="pricing-label" data-i18n-key="pricing.label">${t('pricing.label')}</span>
        <h2 class="pricing-title section-title" data-i18n-key="pricing.title">${t('pricing.title')}</h2>
        <p class="pricing-intro-text" data-i18n-key="pricing.intro1">${t('pricing.intro1')}</p>
        <p class="pricing-intro-text" data-i18n-key="pricing.intro2">${t('pricing.intro2')}</p>
      </div>

      <div class="pricing-grid">
        ${PACKAGES.map(renderCard).join('')}
      </div>

      <div class="pricing-cta">
        <p class="pricing-cta-text" data-i18n-key="pricing.ctaText">${t('pricing.ctaText')}</p>
        <a href="#contact" class="btn btn-primary" data-i18n-key="pricing.ctaButton">${t('pricing.ctaButton')}</a>
      </div>
    </div>
  `;

  // Staggered scroll reveal
  const cards = section.querySelectorAll('.pricing-card');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  cards.forEach(card => observer.observe(card));
}
