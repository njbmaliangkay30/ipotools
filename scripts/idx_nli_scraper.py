"""
IDX NLI (Non-Listed Instrument) Scraper
Halaman: https://idx.co.id/id/perusahaan-tercatat/aktivitas-pencatatan

Strategi:
1. Coba requests biasa dulu — kalau dapat data JSON dari API, selesai
2. Kalau halaman butuh JS rendering, pakai Playwright
3. Output: CSV dengan data NLI

Instalasi (jalankan sekali):
    pip install requests playwright pandas
    playwright install chromium
"""

import requests
import json
import csv
import time
import sys
from datetime import datetime

BASE_URL = "https://idx.co.id"
TARGET_URL = f"{BASE_URL}/id/perusahaan-tercatat/aktivitas-pencatatan"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": TARGET_URL,
}

# ─── STEP 1: Coba endpoint API yang umum dipakai IDX ─────────────────────────

# IDX biasanya expose data via endpoint seperti ini (dari observasi notebook fahmirk)
CANDIDATE_API_ENDPOINTS = [
    # Format paginasi umum IDX
    f"{BASE_URL}/id/perusahaan-tercatat/aktivitas-pencatatan/GetListingActivity",
    f"{BASE_URL}/id/data-pasar/laporan-statistik/aktivitas-pencatatan",
    f"{BASE_URL}/api/aktivitas-pencatatan",
    # Endpoint yang dipakai untuk listing board (dari referensi fahmirk)
    f"{BASE_URL}/id/perusahaan-tercatat/daftar-perusahaan-tercatat/GetStockList",
    # NLI spesifik
    f"{BASE_URL}/id/perusahaan-tercatat/aktivitas-pencatatan/GetNLIList",
    f"{BASE_URL}/id/perusahaan-tercatat/efek-tercatat/NLI",
]

def try_api_endpoints():
    """Coba hit API endpoints satu per satu, return data jika berhasil."""
    session = requests.Session()
    session.headers.update(HEADERS)

    # Params paginasi umum IDX
    params_variants = [
        {"pageNumber": 1, "pageSize": 100, "indexCode": "", "category": "NLI"},
        {"page": 1, "size": 100, "type": "NLI"},
        {"draw": 1, "start": 0, "length": 100},
        {},
    ]

    for endpoint in CANDIDATE_API_ENDPOINTS:
        for params in params_variants:
            try:
                print(f"[→] Mencoba: {endpoint}")
                resp = session.get(endpoint, params=params, timeout=15)
                print(f"    Status: {resp.status_code} | Content-Type: {resp.headers.get('Content-Type', '')}")

                if resp.status_code == 200:
                    ct = resp.headers.get("Content-Type", "")
                    if "json" in ct:
                        data = resp.json()
                        print(f"    [✓] Dapat JSON! Keys: {list(data.keys()) if isinstance(data, dict) else 'list'}")
                        return data, endpoint
                    elif "html" in ct:
                        # Cek apakah ada data JSON embed di HTML
                        if "__NEXT_DATA__" in resp.text or "window.__data" in resp.text:
                            print("    [~] HTML dengan embedded JSON — perlu parsing")
                            return {"_html": resp.text}, endpoint
                        else:
                            print("    [~] HTML biasa, skip")
            except Exception as e:
                print(f"    [✗] Error: {e}")
            time.sleep(0.5)

    return None, None


def parse_embedded_json(html_text):
    """Extract JSON dari __NEXT_DATA__ atau variabel window jika ada."""
    import re

    # Next.js pattern
    match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html_text, re.DOTALL)
    if match:
        return json.loads(match.group(1))

    # window.__data pattern
    match = re.search(r'window\.__data\s*=\s*({.*?});', html_text, re.DOTALL)
    if match:
        return json.loads(match.group(1))

    return None


# ─── STEP 2: Playwright fallback (JS rendering) ───────────────────────────────

def scrape_with_playwright():
    """Render halaman dengan Playwright, intercept API calls, dan ambil data."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("\n[!] Playwright belum diinstall. Jalankan:")
        print("    pip install playwright")
        print("    playwright install chromium")
        sys.exit(1)

    collected_responses = []

    print("\n[→] Membuka browser dengan Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=HEADERS["User-Agent"],
            locale="id-ID"
        )
        page = context.new_page()

        # Intercept semua request API (JSON responses)
        def handle_response(response):
            url = response.url
            if response.status == 200:
                ct = response.headers.get("content-type", "")
                if "json" in ct:
                    try:
                        body = response.json()
                        print(f"    [API intercepted] {url[:80]}")
                        collected_responses.append({
                            "url": url,
                            "data": body
                        })
                    except:
                        pass

        page.on("response", handle_response)

        print(f"[→] Navigasi ke {TARGET_URL}")
        page.goto(TARGET_URL, wait_until="networkidle", timeout=30000)

        # Tunggu konten load
        time.sleep(3)

        # Coba cari tabel atau elemen NLI
        print("[→] Mencari elemen data di halaman...")

        # Screenshot untuk debug
        page.screenshot(path="idx_aktivitas_pencatatan.png")
        print("    [✓] Screenshot disimpan: idx_aktivitas_pencatatan.png")

        # Ambil HTML untuk analisis
        html = page.content()
        with open("idx_page_source.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("    [✓] Page source disimpan: idx_page_source.html")

        # Cari semua text yang mengandung "NLI"
        nli_elements = page.locator("text=NLI").all()
        print(f"    Elemen dengan teks 'NLI': {len(nli_elements)}")

        # Coba ambil tabel jika ada
        tables = page.locator("table").all()
        print(f"    Tabel ditemukan: {len(tables)}")

        table_data = []
        for i, table in enumerate(tables):
            rows = table.locator("tr").all()
            for row in rows:
                cells = row.locator("td, th").all()
                row_data = [cell.inner_text().strip() for cell in cells]
                if row_data:
                    table_data.append(row_data)

        browser.close()

    return collected_responses, table_data, html


# ─── STEP 3: Parse dan simpan data ───────────────────────────────────────────

def extract_nli_data(api_responses):
    """
    Parse response dari API IDX untuk ekstrak data NLI.
    Struktur IDX biasanya: {"data": {"rows": [...], "total": N}}
    Atau: {"Errors": null, "Data": [...]}
    """
    nli_records = []

    for resp in api_responses:
        url = resp.get("url", "")
        data = resp.get("data", {})

        # Pola 1: {"data": {"rows": [...]}}
        if isinstance(data, dict):
            rows = (data.get("data") or {}).get("rows") or \
                   data.get("rows") or \
                   data.get("Data") or \
                   data.get("results") or []

            if isinstance(rows, list) and rows:
                print(f"\n[✓] Data ditemukan di: {url}")
                print(f"    Jumlah records: {len(rows)}")
                print(f"    Sample keys: {list(rows[0].keys()) if rows else '—'}")
                nli_records.extend(rows)

        # Pola 2: langsung list
        elif isinstance(data, list) and data:
            print(f"\n[✓] Data list ditemukan di: {url}")
            nli_records.extend(data)

    return nli_records


def save_to_csv(records, filename="idx_nli_data.csv"):
    if not records:
        print("\n[!] Tidak ada data untuk disimpan.")
        return

    # Normalize keys
    all_keys = set()
    for r in records:
        if isinstance(r, dict):
            all_keys.update(r.keys())

    fieldnames = sorted(all_keys)

    with open(filename, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in records:
            if isinstance(r, dict):
                writer.writerow({k: r.get(k, "") for k in fieldnames})

    print(f"\n[✓] Data disimpan ke: {filename}")
    print(f"    Total records: {len(records)}")
    print(f"    Kolom: {', '.join(fieldnames)}")


def print_api_map(api_responses):
    """Print semua API yang berhasil diintercept untuk referensi."""
    if not api_responses:
        return
    print("\n" + "="*60)
    print("API ENDPOINTS YANG AKTIF DI HALAMAN:")
    print("="*60)
    for r in api_responses:
        data = r["data"]
        size = len(str(data))
        print(f"  {r['url'][:80]}")
        print(f"  └─ Size: {size} chars | Type: {type(data).__name__}")
    print("="*60)


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    print("="*60)
    print("IDX NLI SCRAPER")
    print(f"Target: {TARGET_URL}")
    print(f"Waktu: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)

    # Step 1: Coba API langsung
    print("\n[STEP 1] Mencoba direct API endpoints...")
    data, endpoint = try_api_endpoints()

    if data and "_html" not in data:
        print(f"\n[✓] Berhasil via direct API: {endpoint}")
        # Wrap dalam format yang konsisten
        records = extract_nli_data([{"url": endpoint, "data": data}])
        if records:
            save_to_csv(records)
            return

    # Step 2: Playwright
    print("\n[STEP 2] Fallback ke Playwright (JS rendering)...")
    api_responses, table_data, html_source = scrape_with_playwright()

    print_api_map(api_responses)

    # Filter untuk NLI-related responses
    nli_responses = [r for r in api_responses
                     if "nli" in r["url"].lower()
                     or "listing" in r["url"].lower()
                     or "aktivitas" in r["url"].lower()
                     or len(str(r["data"])) > 500]  # responses besar kemungkinan data

    records = extract_nli_data(nli_responses if nli_responses else api_responses)

    if records:
        save_to_csv(records)
    elif table_data:
        print(f"\n[~] Data dari tabel HTML: {len(table_data)} baris")
        with open("idx_table_data.csv", "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerows(table_data)
        print("[✓] Disimpan ke: idx_table_data.csv")
    else:
        print("\n[!] Tidak ada data yang berhasil diekstrak.")
        print("    Cek file berikut untuk investigasi manual:")
        print("    - idx_aktivitas_pencatatan.png (screenshot halaman)")
        print("    - idx_page_source.html (source HTML)")
        print("\n[HINT] Buka idx_page_source.html dan cari:")
        print("    - URL endpoint di Network tab browser DevTools")
        print("    - Atau inspect elemen tabel NLI secara manual")
        print("    - Lalu tambahkan endpoint tersebut ke CANDIDATE_API_ENDPOINTS di atas")


if __name__ == "__main__":
    main()
