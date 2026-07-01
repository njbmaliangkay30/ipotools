from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('https://e-ipo.co.id/id/home', wait_until='domcontentloaded', timeout=30000)
    print('PAGE_TITLE:', page.title())
    browser.close()
