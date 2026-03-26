"""
Test Admin Panel
"""

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})

    print("Testing admin panel...")

    # Navigate to admin page
    page.goto('http://localhost:3000/admin/')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # Take screenshot of login page
    page.screenshot(path='test_screenshots/admin_login.png')
    print("  Login page screenshot taken")

    # Check elements
    login_card = page.locator('.login-card')
    print(f"  Login card: {'OK' if login_card.count() > 0 else 'MISSING'}")

    email_input = page.locator('#email')
    print(f"  Email input: {'OK' if email_input.count() > 0 else 'MISSING'}")

    password_input = page.locator('#password')
    print(f"  Password input: {'OK' if password_input.count() > 0 else 'MISSING'}")

    submit_btn = page.locator('button[type="submit"]')
    print(f"  Submit button: {'OK' if submit_btn.count() > 0 else 'MISSING'}")

    print("\nAdmin panel test complete!")

    browser.close()
