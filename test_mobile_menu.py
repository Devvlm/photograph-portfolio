"""
Quick test for mobile menu fix
"""

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 375, "height": 812})

    print("Testing mobile menu fix...")

    # Navigate to the site
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # Scroll down to about section first (to test menu over content)
    page.locator('#about').scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    page.screenshot(path='test_screenshots/mobile_about_before_menu.png')
    print("  Scrolled to About section")

    # Open mobile menu
    nav_toggle = page.locator('.nav-toggle')
    nav_toggle.click()
    page.wait_for_timeout(500)
    page.screenshot(path='test_screenshots/mobile_menu_over_about.png')
    print("  Mobile menu opened over About section")

    # Check if menu is visible and covering content
    nav_menu = page.locator('.nav-menu.active')
    if nav_menu.count() > 0:
        print("  Menu is active: OK")

        # Check menu background covers screen
        menu_box = nav_menu.bounding_box()
        if menu_box:
            print(f"  Menu dimensions: {menu_box['width']}x{menu_box['height']}")
            if menu_box['height'] >= 700:
                print("  Menu covers full height: OK")
            else:
                print("  Menu height issue: NEEDS FIX")

    # Close menu
    nav_toggle.click()
    page.wait_for_timeout(300)

    # Scroll to portfolio and test again
    page.locator('#portfolio').scroll_into_view_if_needed()
    page.wait_for_timeout(500)

    nav_toggle.click()
    page.wait_for_timeout(500)
    page.screenshot(path='test_screenshots/mobile_menu_over_portfolio.png')
    print("  Mobile menu opened over Portfolio section")

    print("\nTest complete! Check test_screenshots/ for results")

    browser.close()
