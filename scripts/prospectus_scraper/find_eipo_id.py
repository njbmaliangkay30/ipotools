import re
from playwright.sync_api import sync_playwright

def find_ids():
    print("Membuka e-IPO homepage untuk mencari link emiten aktif...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        )
        page = context.new_page()
        try:
            page.goto("https://e-ipo.co.id/id/home", wait_until="domcontentloaded")
            page.wait_for_timeout(3000)
            
            links = []
            for a in page.locator("a").all():
                href = a.get_attribute("href") or ""
                if "/id/ipo/" in href and "index" not in href:
                    links.append(href)
            
            unique_links = sorted(list(set(links)))
            print("\nLink emiten aktif yang ditemukan di beranda e-IPO:")
            for link in unique_links:
                print(link)
                
        except Exception as e:
            print("Error:", e)
        finally:
            browser.close()

if __name__ == "__main__":
    find_ids()
