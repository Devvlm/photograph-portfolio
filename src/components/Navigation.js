/**
 * Navigation Component
 * Handles navbar scrolling effects and mobile menu
 */

export function initNavigation() {
  const nav = document.getElementById('nav');
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  // Scroll effect
  let lastScrollY = window.scrollY;

  function handleScroll() {
    const currentScrollY = window.scrollY;

    // Add scrolled class after 50px
    if (currentScrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }

    lastScrollY = currentScrollY;
  }

  // Mobile menu toggle
  function toggleMenu() {
    navToggle.classList.toggle('active');
    navMenu.classList.toggle('active');
    document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
  }

  // Close menu on link click
  function closeMenu() {
    navToggle.classList.remove('active');
    navMenu.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Active link on scroll
  function updateActiveLink() {
    const sections = document.querySelectorAll('section[id]');
    const scrollY = window.scrollY + 100;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');

      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }

  // Smooth scroll for anchor links
  function handleAnchorClick(e) {
    const href = e.currentTarget.getAttribute('href');
    if (href.startsWith('#')) {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        const navHeight = nav.offsetHeight;
        const targetPosition = target.offsetTop - navHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });

        closeMenu();
      }
    }
  }

  // Event listeners
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('scroll', updateActiveLink, { passive: true });

  if (navToggle) {
    navToggle.addEventListener('click', toggleMenu);
  }

  navLinks.forEach(link => {
    link.addEventListener('click', handleAnchorClick);
  });

  // Handle CTA button in nav
  const navCta = document.querySelector('.nav-cta');
  if (navCta) {
    navCta.addEventListener('click', handleAnchorClick);
  }

  // Initial state
  handleScroll();
  updateActiveLink();
}
