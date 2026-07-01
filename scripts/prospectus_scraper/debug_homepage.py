from playwright.sync_api import sync_playwright

def debug_home():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        )
        page = context.new_page()
        try:
            print("Visiting e-IPO...")
            page.goto("https://e-ipo.co.id/id/home", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)
            
            title = page.title()
            print("Page Title:", title)
            
            text = page.locator("body").inner_text()
            print("Page text snippet (first 500 chars):")
            print(text[:500])
            
            # Find all links containing ipo
            links = []
            for a in page.locator("a").all():
                href = a.get_attribute("href") or ""
                if "ipo" in href.lower():
                    links.append(href)
            print("All links containing 'ipo':", list(set(links))[:10])
            
        except Exception as e:
            print("Error:", e)
        finally:
            browser.close()

if __name__ == "__main__":
    debug_home()
