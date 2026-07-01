import re
from playwright.sync_api import sync_playwright

def test_scrape():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        for url in ["https://e-ipo.co.id/id/home", "https://e-ipo.co.id/id/ipo/index"]:
            print(f"\n--- MENGUNJUNGI: {url} ---")
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)
            
            # Print title
            print("Title:", page.title())
            
            # Find all links with /ipo/
            links = page.query_selector_all("a[href*='/ipo/']")
            print(f"Total tautan /ipo/ ditemukan: {len(links)}")
            
            for i, link in enumerate(links[:15]):
                href = link.get_attribute("href")
                text = link.inner_text().replace("\n", " | ")
                print(f"[{i}] href={href} | text={text[:100]}")
                
        browser.close()

if __name__ == "__main__":
    test_scrape()
