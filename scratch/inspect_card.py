from playwright.sync_api import sync_playwright

def inspect_detail():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        page.goto("https://e-ipo.co.id/id/ipo/349/jeli-pt-niramas-utama-tbk", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)
        
        # Get all text blocks
        lines = page.evaluate("() => document.body.innerText").split('\n')
        for i, l in enumerate(lines):
            l = l.strip()
            if any(k in l.lower() for k in ['masa penawaran', 'book building', 'harga', 'saham ditawarkan', 'pencatatan', 'penjatahan', 'distribusi', 'sektor', 'sub sektor', 'waran']):
                # print surrounding lines
                for j in range(max(0, i-1), min(len(lines), i+5)):
                    if lines[j].strip():
                        print(f"[{j}] {lines[j].strip()}")
                print("-" * 30)
            
        browser.close()

if __name__ == "__main__":
    inspect_detail()
