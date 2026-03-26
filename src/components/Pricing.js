/* ===================================
   Pricing Section Component
   =================================== */

const pricingPackages = [
  {
    type: 'Events',
    title: 'Events',
    target: 'Voor events zoals CrossFit, Hyrox of andere sportevents',
    from: 'Vanaf',
    price: '€650',
    pitch: 'Je krijgt content die direct inzetbaar is én een sterke aftermovie om het event vast te leggen.',
    groups: [
      {
        label: '1 volledige draaidag op locatie',
        items: null,
      },
      {
        label: 'Tijdens het event',
        items: ['2 social clips (15–20 sec)'],
      },
      {
        label: 'Na het event',
        items: [
          '1 recap per dag (± 30 sec) — oplevering: volgende dag',
          '1 aftermovie (90–120 sec) — oplevering: binnen 3–4 weken',
        ],
      },
    ],
    tagline: 'Perfect om je event direct zichtbaar te maken én achteraf impact te houden.',
  },
  {
    type: 'Athlete',
    title: 'Athlete shoots tijdens events',
    target: 'Voor atleten die hun performance willen vastleggen tijdens een event',
    from: 'Vanaf',
    price: '€200',
    pitch: 'Je krijgt een persoonlijke video die jouw moment echt laat zien.',
    groups: [
      {
        label: '1 volledige draaidag',
        items: null,
      },
      {
        label: null,
        items: [
          '2 social clips (15–20 sec)',
          '1 aftermovie (90–120 sec) — oplevering: binnen 3–4 weken',
        ],
      },
    ],
    tagline: 'Ideaal voor content die je kunt delen op socials of gebruiken voor je personal brand.',
  },
  {
    type: 'Social Media',
    title: 'Social content shoot',
    target: 'Voor sportscholen, Crossfit boxen of merken die consistent zichtbaar willen zijn op social media',
    from: 'Vanaf',
    price: '€325',
    pitch: 'Je schiet in één dag meteen meerdere video\'s, zodat je vooruit kunt.',
    groups: [
      {
        label: '4 uur op locatie (naar keuze)',
        items: null,
      },
      {
        label: 'Short form content',
        items: ['5 reels (± 11 sec per video)'],
      },
      {
        label: 'Long form content',
        items: ['1 video (30–60 sec)'],
      },
    ],
    tagline: 'Handig als je in één keer een sterke contentbatch wil maken.',
  },
];

function renderGroup(group) {
  const lines = [];

  if (group.label) {
    if (group.items) {
      lines.push(`<p class="pricing-item-group">${group.label}</p>`);
    } else {
      lines.push(`<li class="pricing-item">${group.label}</li>`);
    }
  }

  if (group.items) {
    group.items.forEach(item => {
      lines.push(`<li class="pricing-item">${item}</li>`);
    });
  }

  return lines.join('\n');
}

function renderCard(pkg) {
  const groupsHTML = pkg.groups.map(renderGroup).join('\n');

  return `
    <article class="pricing-card">
      <div class="pricing-card-header">
        <p class="pricing-card-type">${pkg.type}</p>
        <h3 class="pricing-card-title">${pkg.title}</h3>
        <p class="pricing-card-target">${pkg.target}</p>
      </div>

      <div class="pricing-card-price">
        <span class="pricing-from">${pkg.from}</span>
        <span class="pricing-amount">${pkg.price}</span>
      </div>

      <p class="pricing-card-pitch">${pkg.pitch}</p>

      <div class="pricing-card-divider"></div>

      <div class="pricing-card-inclusions">
        <p class="pricing-inclusions-label">Wat je krijgt</p>
        <ul class="pricing-items">
          ${groupsHTML}
        </ul>
      </div>

      <div class="pricing-card-footer">
        <p class="pricing-card-tagline">${pkg.tagline}</p>
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
        <span class="pricing-label">Tarieven</span>
        <h2 class="pricing-title section-title">Wat kost het?</h2>
        <p class="pricing-intro-text">
          Je wil natuurlijk weten waar je ongeveer aan toe bent qua prijs.
          Elke video die ik maak is maatwerk. Het hangt af van je wensen,
          het type event en hoeveel content je nodig hebt.
        </p>
        <p class="pricing-intro-text">
          Hieronder vind je een indicatie van mijn pakketten. Zie het als een startpunt.
          We kunnen altijd samen kijken wat het beste past bij jouw idee en budget.
        </p>
      </div>

      <div class="pricing-grid">
        ${pricingPackages.map(renderCard).join('')}
      </div>

      <div class="pricing-cta">
        <p class="pricing-cta-text">Benieuwd wat ik voor jouw project kan betekenen?</p>
        <a href="#contact" class="btn btn-primary">Neem contact op</a>
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
