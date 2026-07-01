import os
import sys
from pathlib import Path
from dotenv import load_dotenv

root_dir = Path(__file__).resolve().parent.parent
load_dotenv(root_dir / ".env.local")
load_dotenv(root_dir / ".env")

sys.path.append('scripts/prospectus_scraper')
from playwright.sync_api import sync_playwright
import pypdf
import io

def test_pdf():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        page = context.new_page()
        page.goto("https://e-ipo.co.id/id/home", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(2000)
        
        resp = context.request.get("https://e-ipo.co.id/id/pipeline/get-propectus-file?id=349&type=summary")
        pdf_bytes = resp.body()
        browser.close()
        
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        print(f"Total pages: {len(reader.pages)}")
        
        for idx, page in enumerate(reader.pages):
            text = page.extract_text()
            if "392" in text or "266" in text or "dana" in text.lower():
                for line in text.split('\n'):
                    if any(k in line.lower() for k in ['392', '266', 'dana', 'penawaran', 'saham', 'miliar', 'rp', 'lot', 'harga']):
                        print(f"[P.{idx+1}] {line.strip()}")

if __name__ == "__main__":
    test_pdf()
