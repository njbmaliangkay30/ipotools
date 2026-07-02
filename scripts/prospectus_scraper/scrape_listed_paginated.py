"""
Scraper Prospektus Ringkas Emiten Listed Berbasis Pagination e-IPO (Python + Playwright + Gemini).
"""

import sys
import argparse
import time
from discovery import EipoScraperSession, _parse_ipo_url, BASE_URL
from pdf_downloader import fetch_if_changed
from extractor import extract_all_sections, reset_call_counter, RateLimitGuard
import db

def main():
    parser = argparse.ArgumentParser(description="Scrape prospectus for listed IPOs using pagination.")
    parser.add_argument("--pages", type=int, default=15, help="Number of pages of index to scan.")
    parser.add_argument("--force", action="store_true", help="Force scrape all listed emiten, bypassing filters and cache.")
    args = parser.parse_args()

    # 1. Ambil emiten listed dari DB
    print("[INFO] Mengambil daftar emiten listed dari database...")
    
    # Ambil semua emiten berstatus 'listed'
    ipos_res = db.supabase.table("ipos").select("id, ticker, company_name, eipo_id").eq("status", "listed").execute()
    listed_ipos = ipos_res.data or []
    
    # Ambil emiten yang sudah punya financial highlights
    fin_res = db.supabase.table("ipo_financial_highlights").select("ipo_id, laba_bersih").execute()
    fin_set = {f["ipo_id"] for f in fin_res.data if f.get("laba_bersih") is not None}
    
    # Filter emiten listed
    targets = []
    target_tickers = set()
    ticker_to_uuid = {}
    for ipo in listed_ipos:
        if args.force or ipo["id"] not in fin_set:
            targets.append(ipo)
            target_tickers.add(ipo["ticker"])
            ticker_to_uuid[ipo["ticker"]] = ipo["id"]
            
    if args.force:
        print(f"[INFO] Mode [FORCE]: Menargetkan seluruh {len(targets)} emiten listed di database.")
    else:
        print(f"[INFO] Ditemukan {len(targets)} emiten listed dengan data keuangan kosong di DB:")
    for t in targets:
        print(f"  - {t['ticker']} ({t['company_name']})")
        
    if not targets:
        print("[INFO] Tidak ada emiten listed yang perlu diproses. Selesai.")
        return

    # 2. Mulai sesi Playwright (headless=False agar lolos Cloudflare)
    reset_call_counter()
    print("\n[INFO] Memulai browser Playwright dalam mode headful...")
    
    with EipoScraperSession(headless=False) as session:
        # Tentukan halaman yang akan discan (maju dari halaman terbaru)
        print(f"[INFO] Akan memindai {args.pages} halaman index e-IPO dari halaman 1 (terbaru)...")

        all_detail_links = []
        for page in range(1, args.pages + 1):
            url = f"https://e-ipo.co.id/id/ipo/index?page={page}&per-page=12"
            print(f"[INDEX] Membuka halaman {page}: {url}")
            
            if not session._load_page(url):
                print(f"[WARNING] Gagal memuat halaman index {page}, lewati.")
                continue
                
            # Ambil semua tautan detail dari kartu
            page_links = []
            for anchor in session.page.locator("a").all():
                href = anchor.get_attribute("href") or ""
                if "/id/ipo/" in href and "index" not in href:
                    if href.startswith("/"):
                        href = f"{BASE_URL}{href}"
                    page_links.append(href)
                    
            # Gunakan dict.fromkeys untuk menjaga urutan kemunculan terbaru
            unique_page_links = list(dict.fromkeys(page_links))
            print(f"[INDEX] Halaman {page}: Ditemukan {len(unique_page_links)} link detail.")
            all_detail_links.extend(page_links)
            time.sleep(2)
            
        # Hapus duplikat total dengan tetap mempertahankan urutan terbaru (newest first)
        unique_links = list(dict.fromkeys(all_detail_links))
        print(f"\n[DISCOVERY] Total ditemukan {len(unique_links)} link detail unik di seluruh halaman index.")
        
        # 3. Proses setiap link detail
        matched_count = 0
        for i, link in enumerate(unique_links, start=1):
            parsed = _parse_ipo_url(link)
            if not parsed:
                continue
            ipo_id, slug = parsed
            
            print(f"[PROCESS] ({i}/{len(unique_links)}) Memeriksa detail: {link} ...")
            summary = session.scrape_detail(link)
            if not summary:
                print(f"[WARNING] Gagal mengambil detail dari {link}")
                continue
                
            ticker = summary.ticker
            if ticker in target_tickers:
                print(f"[MATCH] Ticker {ticker} cocok dengan target di database!")
                matched_count += 1
                ipo_uuid = ticker_to_uuid[ticker]
                
                # Update basic metadata di database agar data detail lengkap dan tidak ada null
                metadata_payload = {
                    "eipo_id": ipo_id,
                }
                if summary.logo_url:
                    metadata_payload["logo_url"] = summary.logo_url
                if summary.sector:
                    metadata_payload["sector"] = summary.sector
                if summary.website:
                    metadata_payload["website"] = summary.website
                if summary.underwriters:
                    metadata_payload["underwriters"] = summary.underwriters
                if summary.price:
                    metadata_payload["ipo_price"] = summary.price
                if summary.offered_shares:
                    metadata_payload["offered_shares"] = summary.offered_shares
                if summary.public_float_pct:
                    metadata_payload["public_float_pct"] = summary.public_float_pct
                if summary.bb_price_low:
                    metadata_payload["bb_price_low"] = summary.bb_price_low
                if summary.bb_price_high:
                    metadata_payload["bb_price_high"] = summary.bb_price_high
                if summary.bb_open:
                    metadata_payload["bb_open"] = summary.bb_open
                if summary.bb_close:
                    metadata_payload["bb_close"] = summary.bb_close
                if summary.offering_open:
                    metadata_payload["offering_open"] = summary.offering_open
                if summary.offering_close:
                    metadata_payload["offering_close"] = summary.offering_close
                if summary.distribution_date:
                    metadata_payload["distribution_date"] = summary.distribution_date
                if summary.listing_date:
                    metadata_payload["listing_date"] = summary.listing_date
                
                db.supabase.table("ipos").update(metadata_payload).eq("id", ipo_uuid).execute()
                print(f"[DB] Updated basic metadata & eipo_id={ipo_id} untuk {ticker}")
                
                # Download PDF prospektus ringkas
                try:
                    if args.force:
                        print(f"[PDF] [FORCE] Mengunduh ulang prospektus untuk {ticker}...")
                        from pdf_downloader import download_prospectus
                        pdf_bytes = download_prospectus(ipo_id, page=session.page)
                    else:
                        print(f"[PDF] Mengunduh prospektus untuk {ticker}...")
                        pdf_bytes, _doc_hash = fetch_if_changed(ipo_id, page=session.page)
                except Exception as e:
                    print(f"[ERROR] Gagal mengunduh PDF untuk {ticker}: {e}")
                    continue
                    
                if pdf_bytes is None:
                    print(f"[SKIP] PDF {ticker} kosong atau tidak berubah.")
                    continue
                    
                # Ekstraksi data PDF dengan Gemini
                print(f"[GEMINI] Mengekstrak data prospektus untuk {ticker}...")
                try:
                    extracted = extract_all_sections(pdf_bytes)
                except RateLimitGuard as e:
                    print(f"[STOP] {e}")
                    break
                except Exception as e:
                    print(f"[ERROR] Gagal mengekstrak data PDF untuk {ticker}: {e}")
                    continue
                    
                # Update database
                db.update_ipo_jadwal_harga_dana(ipo_uuid, extracted["jadwal_harga_dana"], "listed")
                db.replace_shareholders(ipo_uuid, extracted["kepemilikan"])
                db.update_financial(ipo_uuid, extracted["financial"])
                
                print(f"[SUCCESS] Berhasil melengkapi data {ticker}!")
                time.sleep(2)
                
        print(f"\n[FINISHED] Selesai. Total emiten tercocokkan & diproses: {matched_count}")

if __name__ == "__main__":
    main()
