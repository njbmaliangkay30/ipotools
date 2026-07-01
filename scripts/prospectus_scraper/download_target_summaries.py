import os
import time
from playwright.sync_api import sync_playwright

MAPPING = {
    'PRDL': '350',
    'EMMI': '351',
    'BACH': '353',
    'RANS': '354'
}

os.makedirs('scratch/pdf', exist_ok=True)

def download_summaries():
    print("Memulai unduhan ringkasan prospektus (type=summary) untuk PRDL, EMMI, BACH, RANS...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        )
        page = context.new_page()
        
        for ticker, ipo_id in MAPPING.items():
            out_path = f"scratch/pdf/{ticker}.pdf"
            url_summary = f"https://e-ipo.co.id/id/pipeline/get-propectus-file?id={ipo_id}&type=summary"
            detail_url = f"https://e-ipo.co.id/id/ipo/{ipo_id}/"
            
            print(f"\n--- Mengunduh {ticker} (IPO ID: {ipo_id}) ---")
            
            # Kunjungi detail page untuk establish session/cookies
            try:
                page.goto(detail_url, wait_until="domcontentloaded", timeout=20000)
                page.wait_for_timeout(1500)
                
                # Fetch PDF bytes inside browser context
                body_arr = page.evaluate(f"""
                    async () => {{
                        const r = await fetch('{url_summary}', {{credentials: 'include'}});
                        if (r.status !== 200) {{
                            throw new Error('HTTP Status ' + r.status);
                        }}
                        const buf = await r.arrayBuffer();
                        return Array.from(new Uint8Array(buf));
                    }}
                """)
                
                pdf_bytes = bytes(body_arr)
                
                if len(pdf_bytes) > 5000:
                    with open(out_path, 'wb') as f:
                        f.write(pdf_bytes)
                    print(f"[OK] Sukses menyimpan ringkasan prospektus {ticker} ({len(pdf_bytes)} bytes)")
                else:
                    print(f"[ERROR] Ukuran file terlalu kecil ({len(pdf_bytes)} bytes)")
            except Exception as e:
                print(f"[ERROR] Gagal mengunduh {ticker}: {e}")
                
            time.sleep(2)
            
        browser.close()
    print("\nProses selesai.")

if __name__ == "__main__":
    download_summaries()
