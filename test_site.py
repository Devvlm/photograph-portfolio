"""
Portfolio Website Test Script
Tests the photographer portfolio site and captures screenshots
"""

from playwright.sync_api import sync_playwright
import os

# Output directory for screenshots
OUTPUT_DIR = "test_screenshots"
os.makedirs(OUTPUT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})

    print("Navigating to http://localhost:3000...")
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')

    # Wait a bit for Three.js to initialize
    page.wait_for_timeout(2000)

    # Take full page screenshot
    print("Taking hero section screenshot...")
    page.screenshot(path=f'{OUTPUT_DIR}/01_hero.png')

    # Check for console errors
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

    # Check key elements exist
    print("\nChecking page elements...")

    # Navigation
    nav = page.locator('.nav')
    print(f"  Navigation: {'OK' if nav.count() > 0 else 'MISSING'}")

    # Hero section
    hero = page.locator('.hero')
    print(f"  Hero section: {'OK' if hero.count() > 0 else 'MISSING'}")

    # Hero canvas (Three.js container)
    canvas = page.locator('#heroCanvas')
    print(f"  Hero canvas: {'OK' if canvas.count() > 0 else 'MISSING'}")

    # Hero content
    hero_title = page.locator('.hero-title')
    print(f"  Hero title: {'OK' if hero_title.count() > 0 else 'MISSING'}")

    # Scroll to About section
    print("\nScrolling to About section...")
    page.locator('#about').scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    page.screenshot(path=f'{OUTPUT_DIR}/02_about.png')

    about = page.locator('.about')
    print(f"  About section: {'OK' if about.count() > 0 else 'MISSING'}")

    # Scroll to Portfolio section
    print("\nScrolling to Portfolio section...")
    page.locator('#portfolio').scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    page.screenshot(path=f'{OUTPUT_DIR}/03_portfolio.png')

    portfolio_items = page.locator('.portfolio-item')
    print(f"  Portfolio items: {portfolio_items.count()} found")

    # Test filter buttons
    print("\nTesting portfolio filters...")
    filter_buttons = page.locator('.filter-btn')
    print(f"  Filter buttons: {filter_buttons.count()} found")

    # Click on Photo filter
    photo_filter = page.locator('.filter-btn[data-filter="photo"]')
    if photo_filter.count() > 0:
        photo_filter.click()
        page.wait_for_timeout(500)
        page.screenshot(path=f'{OUTPUT_DIR}/04_portfolio_filtered.png')
        print("  Photo filter clicked OK")

    # Test lightbox - click first portfolio item
    print("\nTesting lightbox...")
    page.locator('.filter-btn[data-filter="all"]').click()
    page.wait_for_timeout(300)
    first_item = page.locator('.portfolio-item').first
    if first_item.count() > 0:
        first_item.click()
        page.wait_for_timeout(500)
        page.screenshot(path=f'{OUTPUT_DIR}/05_lightbox.png')

        lightbox = page.locator('.lightbox.active')
        print(f"  Lightbox opened: {'OK' if lightbox.count() > 0 else 'MISSING'}")

        # Close lightbox
        page.locator('.lightbox-close').click()
        page.wait_for_timeout(300)

    # Scroll to Contact section
    print("\nScrolling to Contact section...")
    page.locator('#contact').scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    page.screenshot(path=f'{OUTPUT_DIR}/06_contact.png')

    contact_form = page.locator('#contactForm')
    print(f"  Contact form: {'OK' if contact_form.count() > 0 else 'MISSING'}")

    # Test form validation
    print("\nTesting form validation...")
    submit_btn = page.locator('.form-submit')
    submit_btn.click()
    page.wait_for_timeout(500)

    # Fill form
    page.fill('#name', 'Test User')
    page.fill('#email', 'test@example.com')
    page.fill('#subject', 'Test Project')
    page.fill('#message', 'This is a test message for the portfolio website.')
    page.screenshot(path=f'{OUTPUT_DIR}/07_contact_filled.png')
    print("  Form filled OK")

    # Check footer
    print("\nChecking footer...")
    footer = page.locator('.footer')
    print(f"  Footer: {'OK' if footer.count() > 0 else 'MISSING'}")

    # Test mobile viewport
    print("\nTesting mobile viewport...")
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1500)
    page.screenshot(path=f'{OUTPUT_DIR}/08_mobile_hero.png')

    # Test mobile menu
    nav_toggle = page.locator('.nav-toggle')
    if nav_toggle.is_visible():
        nav_toggle.click()
        page.wait_for_timeout(300)
        page.screenshot(path=f'{OUTPUT_DIR}/09_mobile_menu.png')
        print("  Mobile menu: OK")

    # Scroll through mobile
    page.locator('#portfolio').scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    page.screenshot(path=f'{OUTPUT_DIR}/10_mobile_portfolio.png')

    print("\n" + "="*50)
    print("TEST COMPLETE")
    print("="*50)
    print(f"\nScreenshots saved to: {OUTPUT_DIR}/")

    # Report any console errors
    if console_errors:
        print("\n[WARNING] Console errors detected:")
        for err in console_errors[:5]:
            print(f"  - {err}")
    else:
        print("\n[OK] No console errors detected")

    browser.close()
