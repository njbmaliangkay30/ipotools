import os
import sys
from pathlib import Path
from dotenv import load_dotenv

root_dir = Path(__file__).resolve().parent.parent
load_dotenv(root_dir / ".env.local")
load_dotenv(root_dir / ".env")

sys.path.append('scripts/prospectus_scraper')
from playwright.sync_api import sync_playwright
import extractor
import json

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        page = context.new_page()
        page.goto("https://e-ipo.co.id/id/home", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(2000)
        
        resp = context.request.get("https://e-ipo.co.id/id/pipeline/get-propectus-file?id=349&type=summary")
        pdf_bytes = resp.body()
        browser.close()
        
        print(f"PDF downloaded, size: {len(pdf_bytes)} bytes")
        print("Calling Gemini to extract jadwal_harga_dana...")
        res = extractor.extract_jadwal_harga_dana(pdf_bytes)
        print("--- HASIL GEMINI ---")
        print(json.dumps(res, indent=2))
except Exception as e:
    print(f"Error: {e}")
