import sys
sys.path.append('scripts/prospectus_scraper')
import httpx
import extractor
import json

try:
    print("Downloading PDF for JELI with User-Agent header...")
    url = "https://e-ipo.co.id/id/pipeline/get-propectus-file?id=349&type=summary"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Referer": "https://e-ipo.co.id/id/ipo/index"
    }
    resp = httpx.get(url, headers=headers, timeout=30, follow_redirects=True)
    resp.raise_for_status()
    pdf_bytes = resp.content
    print(f"PDF downloaded, size: {len(pdf_bytes)} bytes")
    
    print("Calling Gemini to extract jadwal_harga_dana...")
    res = extractor.extract_jadwal_harga_dana(pdf_bytes)
    print(json.dumps(res, indent=2))
except Exception as e:
    print(f"Error: {e}")
