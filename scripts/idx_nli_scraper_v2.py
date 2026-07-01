"""
IDX New Listing Information PDF Scraper
Source: https://www.idx.co.id/en/market-data/statistical-reports/new-listing-information/

Alur:
1. Hit API IDX untuk dapat daftar PDF per tahun
2. Download semua PDF
3. Parse field yang relevan untuk IPO Decision Tool
4. Output: CSV

Instalasi:
    pip install requests pdfplumber pandas playwright
    playwright install chromium  # hanya jika API langsung gagal
"""

import requests
import pdfplumber
import pandas as pd
import re
import os
import time
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────

YEARS = [2022, 2023, 2024, 2025]   # Tahun yang mau di-scrape
DOWNLOAD_DIR = Path("nli_pdfs")
OUTPUT_CSV = "idx_nli_data.csv"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html, */*",
    "Referer": "https://www.idx.co.id/en/market-data/statistical-reports/new-listing-information/",
}

# API endpoint IDX untuk New Listing Information
# IDX pakai pola ini untuk statistical reports
API_CANDIDATES = [
    "https://www.idx.co.id/primary/TradingSummary/GetNewListingInfo",
    "https://www.idx.co.id/primary/StatisticalReport/GetNewListingInformation",
    "https://www.idx.co.id/id/data-pasar/laporan-statistik/informasi-pencatatan-baru",
    "https://idx.co.id/primary/TradingSummary/GetNewListingInfo",
]

# ── Step 1: Fetch daftar PDF dari API IDX ─────────────────────────────────────

def fetch_pdf_list(year):
    """Coba dapat daftar PDF dari API IDX untuk tahun tertentu."""
    session = requests.Session()
    session.headers.update(HEADERS)

    param_variants = [
        {"year": year, "pageSize": 100, "pageNumber": 1},
        {"Year": year, "PageSize": 100, "PageNumber": 1},
        {"tahun": year, "pageSize": 100, "pageNumber": 1},
        {"year": year},
    ]

    for url in API_CANDIDATES:
        for params in param_variants:
            try:
                print(f"  [→] {url} | params: {params}")
                resp = session.get(url, params=params, timeout=15)
                print(f"      Status: {resp.status_code} | CT: {resp.headers.get('Content-Type','')[:40]}")

                if resp.status_code == 200 and "json" in resp.headers.get("Content-Type", ""):
                    data = resp.json()
                    print(f"      [✓] JSON! Keys: {list(data.keys()) if isinstance(data, dict) else type(data)}")
                    return data, url
            except Exception as e:
                print(f"      [✗] {e}")
            time.sleep(0.3)

    return None, None


def extract_pdf_urls_from_response(data):
    """Parse JSON response IDX untuk dapat URL PDF."""
    urls = []

    if not data:
        return urls

    # Pola umum IDX: {"data": {"rows": [{"FileDownload": "...", "Title": "..."}]}}
    rows = None
    if isinstance(data, dict):
        rows = (data.get("data") or {}).get("rows") or \
               data.get("rows") or \
               data.get("Data") or \
               data.get("results") or []
    elif isinstance(data, list):
        rows = data

    for row in (rows or []):
        if not isinstance(row, dict):
            continue
        # Cari field yang kemungkinan berisi URL file
        for key in ["FileDownload", "file_download", "FileName", "url", "Url", "URL", "Path", "FilePath"]:
            val = row.get(key, "")
            if val and (".pdf" in val.lower() or val.startswith("/")):
                full_url = val if val.startswith("http") else f"https://www.idx.co.id{val}"
                title = row.get("Title") or row.get("title") or row.get("Description") or ""
                urls.append({"url": full_url, "title": title})
                break

    return urls


# ── Step 2: Playwright fallback untuk dapat URL PDF ───────────────────────────

def fetch_pdf_list_playwright(year):
    """Fallback: render halaman dengan Playwright dan intercept PDF download links."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("\n[!] Playwright tidak tersedia. Install: pip install playwright && playwright install chromium")
        return []

    pdf_urls = []
    target = "https://www.idx.co.id/en/market-data/statistical-reports/new-listing-information/"

    print(f"\n[→] Playwright: membuka {target} untuk tahun {year}...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_extra_http_headers(HEADERS)

        intercepted = []

        def on_response(resp):
            url = resp.url
            ct = resp.headers.get("content-type", "")
            if resp.status == 200 and "json" in ct and ("listing" in url.lower() or "nli" in url.lower() or "statistical" in url.lower()):
                try:
                    body = resp.json()
                    intercepted.append({"url": url, "data": body})
                    print(f"  [intercept] {url[:80]}")
                except:
                    pass

        page.on("response", on_response)
        page.goto(target, wait_until="networkidle", timeout=30000)
        time.sleep(2)

        # Coba pilih tahun jika ada dropdown
        try:
            page.select_option("select", str(year))
            time.sleep(2)
        except:
            pass

        # Ambil semua link PDF dari halaman
        links = page.eval_on_selector_all("a[href*='.pdf'], a[href*='download'], a[href*='NLI']",
                                           "els => els.map(e => ({href: e.href, text: e.textContent.trim()}))")
        for link in links:
            if link["href"]:
                pdf_urls.append({"url": link["href"], "title": link["text"]})
                print(f"  [PDF link] {link['href'][:80]}")

        # Coba extract dari intercepted API responses
        for item in intercepted:
            urls = extract_pdf_urls_from_response(item["data"])
            pdf_urls.extend(urls)

        browser.close()

    return pdf_urls


# ── Step 3: Download PDF ──────────────────────────────────────────────────────

def download_pdf(url, filepath):
    """Download satu PDF ke disk."""
    if filepath.exists():
        print(f"  [skip] {filepath.name} sudah ada")
        return True
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30, stream=True)
        if resp.status_code == 200 and "pdf" in resp.headers.get("Content-Type", "").lower():
            with open(filepath, "wb") as f:
                for chunk in resp.iter_content(8192):
                    f.write(chunk)
            print(f"  [✓] {filepath.name}")
            return True
        else:
            print(f"  [✗] {resp.status_code} | {url[:60]}")
            return False
    except Exception as e:
        print(f"  [✗] {e}")
        return False


# ── Step 4: Parse PDF ─────────────────────────────────────────────────────────

FIELD_PATTERNS = {
    # Company
    "ticker":           r"A1\s+Stock Code\s+(\S+)",
    "company_name":     r"A2\s+Company Name\s+(.+?)(?:\n|A3)",

    # IPO
    "ipo_price":        r"B1\s+IPO Price\s+([\d,]+)\s+IDR",
    "offered_shares":   r"B3\s+Offered Shares\s+([\d,]+)\s+Shares",
    "founders_shares":  r"B4\s+Founders Shares\s+([\d,]+)\s+Shares",
    "total_listed":     r"B6\s+Total Listed Shares\s+([\d,]+)\s+Shares",
    "fund_raised":      r"B8\s+Fund Raised\s+([\d,]+)\s+IDR",
    "market_cap":       r"B9\s+Market Capitalization\s+([\d,]+)\s+IDR",
    "subscribed_shares":r"B10\s+Subscribed Shares\s+([\d,]+)\s+Shares",
    "os_ratio":         r"B12\s+Oversubscription Ratio\s+([\d.]+)\s+X",
    "listing_date":     r"B23\s+Stock Listing Date\s+(\S+)",

    # Classification
    "listing_board":    r"D1\s+Listing Board\s+(\S+)",
    "sector":           r"D6\s+Sector\s+(.+?)(?:\n|D7)",
    "sub_sector":       r"D7\s+Sub Sector\s+(.+?)(?:\n|D8)",
    "industry":         r"D8\s+Industry\s+(.+?)(?:\n|D9)",

    # Warrant
    "has_warrant":      r"E6\s+Offered Warrants\s+(\d+)\s+Warrants",

    # Use of funds (persen)
    "pct_working_cap":  r"FO1\s+IPO_Working Capital\s+([\d.]+)%",
    "pct_capex":        r"FO2\s+IPO_Capital Expenditure\s+([\d.]+)%",
    "pct_subsidiaries": r"FO3\s+IPO_Participation in Subsidiaries\s+([\d.]+)%",
    "pct_debt_payment": r"FO4\s+IPO_Debt Payment\s+([\d.]+)%",
    "pct_expansion":    r"FO5\s+IPO_Expansion\s+([\d.]+)%",
    "pct_acquisition":  r"FO6\s+IPO_Acquisition\s+([\d.]+)%",

    # Underwriters (up to 3)
    "uw1_pct":          r"GU1\s+Underwriter1\s+([\d.]+)%\s+\|",
    "uw1_name":         r"GU1\s+Underwriter1\s+[\d.]+%\s+\|(.+?)(?:\n|GU2)",
    "uw2_pct":          r"GU2\s+Underwriter2\s+([\d.]+)%\s+\|",
    "uw2_name":         r"GU2\s+Underwriter2\s+[\d.]+%\s+\|(.+?)(?:\n|GU3)",
    "uw3_pct":          r"GU3\s+Underwriter3\s+([\d.]+)%\s+\|",
    "uw3_name":         r"GU3\s+Underwriter3\s+[\d.]+%\s+\|(.+?)(?:\n|GU4)",

    # Free float
    "public_pct":       r"SHIP\s+Public Shares\s+([\d.]+)%",
}


def clean_num(val):
    """Bersihkan string angka jadi float."""
    if not val:
        return None
    cleaned = val.replace(",", "").strip()
    try:
        return float(cleaned)
    except:
        return None


def parse_pdf(filepath):
    """Extract semua field yang relevan dari satu PDF."""
    record = {"source_file": filepath.name}

    try:
        with pdfplumber.open(filepath) as pdf:
            full_text = ""
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    full_text += t + "\n"
    except Exception as e:
        print(f"  [✗] Error membuka PDF {filepath.name}: {e}")
        return None

    for field, pattern in FIELD_PATTERNS.items():
        match = re.search(pattern, full_text, re.IGNORECASE | re.DOTALL)
        if match:
            val = match.group(1).strip()
            record[field] = val
        else:
            record[field] = None

    # Derived fields
    record["has_warrant"] = (clean_num(record.get("has_warrant")) or 0) > 0

    # Free float sebagai persen (cross-check: offered/total)
    offered = clean_num(record.get("offered_shares"))
    total = clean_num(record.get("total_listed"))
    if offered and total and total > 0:
        record["free_float_pct_calc"] = round(offered / total * 100, 2)
    else:
        record["free_float_pct_calc"] = None

    # Pct debt payment: flag insider dump risk proxy
    pct_debt = clean_num(record.get("pct_debt_payment"))
    record["high_debt_repayment"] = (pct_debt or 0) >= 50

    return record


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    DOWNLOAD_DIR.mkdir(exist_ok=True)
    all_records = []

    print("=" * 60)
    print("IDX NEW LISTING INFORMATION SCRAPER")
    print("=" * 60)

    all_pdf_urls = []

    for year in YEARS:
        print(f"\n[YEAR {year}] Fetching PDF list...")
        data, endpoint = fetch_pdf_list(year)
        urls = extract_pdf_urls_from_response(data)

        if not urls:
            print(f"  Direct API kosong, fallback ke Playwright...")
            urls = fetch_pdf_list_playwright(year)

        print(f"  → {len(urls)} PDF ditemukan untuk {year}")
        all_pdf_urls.extend(urls)

    if not all_pdf_urls:
        print("\n[!] Tidak ada PDF URL yang berhasil didapat.")
        print("    Kemungkinan IDX butuh session/cookie dari browser.")
        print("    Coba buka halaman di browser, copy Network request ke script ini.")
        return

    # Download semua PDF
    print(f"\n[DOWNLOAD] Total {len(all_pdf_urls)} PDF...")
    for item in all_pdf_urls:
        url = item["url"]
        filename = url.split("/")[-1].split("?")[0]
        if not filename.endswith(".pdf"):
            filename = filename + ".pdf"
        filepath = DOWNLOAD_DIR / filename
        download_pdf(url, filepath)
        time.sleep(0.5)

    # Parse semua PDF yang sudah didownload
    print(f"\n[PARSE] Membaca PDF dari {DOWNLOAD_DIR}...")
    pdf_files = list(DOWNLOAD_DIR.glob("*.pdf"))
    print(f"  → {len(pdf_files)} file ditemukan")

    for pdf_file in sorted(pdf_files):
        print(f"  Parsing {pdf_file.name}...")
        record = parse_pdf(pdf_file)
        if record:
            all_records.append(record)

    if not all_records:
        print("\n[!] Tidak ada data yang berhasil diparsing.")
        return

    # Simpan ke CSV
    df = pd.DataFrame(all_records)

    # Urutkan kolom
    col_order = [
        "ticker", "company_name", "listing_date", "listing_board",
        "sector", "sub_sector", "industry",
        "ipo_price", "offered_shares", "total_listed", "subscribed_shares",
        "os_ratio", "market_cap", "fund_raised",
        "public_pct", "free_float_pct_calc",
        "has_warrant",
        "pct_working_cap", "pct_capex", "pct_subsidiaries",
        "pct_debt_payment", "pct_expansion", "pct_acquisition",
        "high_debt_repayment",
        "uw1_name", "uw1_pct", "uw2_name", "uw2_pct", "uw3_name", "uw3_pct",
        "source_file"
    ]
    existing_cols = [c for c in col_order if c in df.columns]
    df = df[existing_cols]

    df.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
    print(f"\n[✓] Selesai! {len(df)} IPO disimpan ke {OUTPUT_CSV}")
    print(f"    Kolom: {', '.join(df.columns.tolist())}")
    print(f"\nSample data:")
    print(df[["ticker", "listing_date", "sector", "os_ratio", "uw1_name"]].head(10).to_string())


# ── Parse lokal (untuk test dengan PDF yang sudah ada) ────────────────────────

def parse_local_pdfs(folder="."):
    """Parse semua PDF di folder lokal tanpa perlu download."""
    folder = Path(folder)
    pdf_files = list(folder.glob("*.pdf"))
    print(f"[LOCAL] Menemukan {len(pdf_files)} PDF di {folder}")

    records = []
    for f in pdf_files:
        print(f"  Parsing {f.name}...")
        r = parse_pdf(f)
        if r:
            records.append(r)

    if records:
        df = pd.DataFrame(records)
        df.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
        print(f"\n[✓] {len(df)} records disimpan ke {OUTPUT_CSV}")
        print(df[["ticker", "listing_date", "sector", "os_ratio", "uw1_name"]].to_string())


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "local":
        # Mode lokal: parse PDF yang sudah ada di folder saat ini atau folder yang diberikan
        folder = sys.argv[2] if len(sys.argv) > 2 else "."
        parse_local_pdfs(folder)
    else:
        main()
