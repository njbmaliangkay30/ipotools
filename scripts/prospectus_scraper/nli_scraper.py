"""
Scraper NLI (New Listing Information) menggunakan Python Playwright, PyPDF, dan Google Gemini API.
"""

import os
import sys
import re
import time
import json
import argparse
from pathlib import Path
import requests
import pypdf
import google.generativeai as genai
import typing_extensions as typing
from playwright.sync_api import sync_playwright

# Setup import path untuk modul lokal
sys.path.append(str(Path(__file__).resolve().parent))
from config import GEMINI_API_KEY, LLM_MODEL, BROWSER_USER_AGENT
from db import supabase

# Konfigurasi Gemini API
genai.configure(api_key=GEMINI_API_KEY)

class NliData(typing.TypedDict):
    ticker: str
    company_name: str
    ipo_price: typing.Optional[float]
    offered_shares: typing.Optional[int]
    subscribed_shares: typing.Optional[int]
    os_ratio: typing.Optional[float]
    listing_date: typing.Optional[str]  # Format: YYYY-MM-DD
    listing_board: typing.Optional[str]
    sector: typing.Optional[str]
    has_warrant: typing.Optional[bool]
    shareholders_count: typing.Optional[int]
    sector_per: typing.Optional[float]
    sector_pbv: typing.Optional[float]
    subsector_per: typing.Optional[float]
    subsector_pbv: typing.Optional[float]
    par_value: typing.Optional[float]  # Nominal saham / Harga perolehan insider

def clean_num(val) -> typing.Optional[float]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    
    cleaned = str(val).strip()
    if not cleaned:
        return None
        
    # Deteksi format Indonesia (titik sebagai ribuan, koma sebagai desimal)
    if '.' in cleaned and ',' in cleaned:
        if cleaned.index(',') > cleaned.index('.'):
            cleaned = cleaned.replace('.', '').replace(',', '.')
        else:
            cleaned = cleaned.replace(',', '')
    elif ',' in cleaned:
        # Jika koma di akhir pola ribuan seperti 1,000
        if re.search(r'(,\d{3})+$', cleaned):
            cleaned = cleaned.replace(',', '')
        else:
            cleaned = cleaned.replace(',', '.')
    elif '.' in cleaned:
        if re.search(r'(\.\d{3})+$', cleaned):
            cleaned = cleaned.replace('.', '')
            
    try:
        return float(cleaned)
    except ValueError:
        return None

def parse_pdf_with_gemini(pdf_path: str) -> typing.Optional[dict]:
    """Membaca 3 halaman pertama PDF NLI dan mengekstrak datanya menggunakan Gemini."""
    try:
        reader = pypdf.PdfReader(pdf_path)
        pages_to_read = min(3, len(reader.pages))
        text = ""
        for i in range(pages_to_read):
            text += f"\n--- PAGE {i+1} ---\n"
            text += reader.pages[i].extract_text()
            
        models_to_try = [
            "models/gemini-3.1-flash-lite",
            "models/gemini-2.5-flash-lite",
            "models/gemini-2.0-flash-lite",
            "models/gemini-3.5-flash",
            "models/gemini-3.0-flash",
            "models/gemini-2.5-flash",
            "models/gemini-2.0-flash",
            "models/gemini-2.5-pro",
            "models/gemini-3.1-pro",
            "models/gemini-3-flash-preview",
            "models/gemini-3.0-flash-preview",
            "models/gemini-1.5-flash"
        ]
        if LLM_MODEL not in models_to_try:
            models_to_try.insert(0, LLM_MODEL)
        last_error = None
        
        for model_name in models_to_try:
            try:
                print(f"[GEMINI] Mencoba analisis dengan model: {model_name}...")
                model = genai.GenerativeModel(
                    model_name=model_name,
                    system_instruction=(
                        "You are an expert financial analyst. Extract new listing information (NLI) details "
                        "from the provided Indonesian Stock Exchange (IDX) publication text. Be accurate with "
                        "numbers, ratios, and percentages. Ensure tickers are uppercase and dates are parsed to YYYY-MM-DD. "
                        "par_value refers to the nominal stock value (Par Value) or the insider acquisition cost."
                    )
                )
                
                response = model.generate_content(
                    f"Extract NLI data from this text:\n\n{text}",
                    generation_config={"response_mime_type": "application/json", "response_schema": NliData}
                )
                
                data = json.loads(response.text)
                return data
            except Exception as inner_e:
                print(f"[GEMINI] Gagal dengan model {model_name}: {inner_e}")
                last_error = inner_e
                time.sleep(2)
                continue
                
        raise last_error
    except Exception as e:
        print(f"[ERROR] Gagal memproses NLI PDF {pdf_path} dengan Gemini: {e}")
        return None

def download_pdf(context, url: str, dest_path: str) -> bool:
    """Mengunduh PDF dengan membuka tab baru di Playwright dan mendeteksi download/navigation."""
    pdf_page = None
    try:
        pdf_page = context.new_page()
        download = None
        
        # Tambahkan listener download secara eksplisit
        def on_download(d):
            nonlocal download
            download = d
            
        pdf_page.on("download", on_download)
        
        try:
            response = pdf_page.goto(url, wait_until="domcontentloaded", timeout=45000)
            # Tunggu sebentar jika download keburu kepicu
            pdf_page.wait_for_timeout(2000)
        except Exception as e:
            if "net::ERR_ABORTED" in str(e):
                # Navigasi dibatalkan karena berubah menjadi unduhan file
                pdf_page.wait_for_timeout(2000)
            else:
                raise e
                
        if download:
            download.save_as(dest_path)
            print(f"[DOWNLOAD] Berhasil mengunduh via file download event: {dest_path}")
            pdf_page.close()
            return True
        elif response and response.status == 200:
            with open(dest_path, "wb") as f:
                f.write(response.body())
            print(f"[DOWNLOAD] Berhasil menyimpan via body response: {dest_path}")
            pdf_page.close()
            return True
        else:
            status = response.status if response else "NO_RESPONSE"
            print(f"[WARNING] Gagal unduh PDF {url}: HTTP {status}")
            pdf_page.close()
            return False
            
    except Exception as e:
        print(f"[ERROR] Gagal unduh PDF {url} via tab baru: {e}")
        if pdf_page:
            try:
                pdf_page.close()
            except:
                pass
        return False

def upsert_to_supabase(record: dict) -> bool:
    """Menyimpan data NLI hasil ekstraksi Gemini ke Supabase."""
    ticker = record.get("ticker")
    if not ticker:
        return False
        
    ticker = ticker.strip().upper()
    print(f"[DB] Menyimpan data NLI untuk ticker {ticker}...")
    
    try:
        # 1. Upsert ke tabel ipos
        ipo_payload = {
            "ticker": ticker,
            "company_name": record.get("company_name", "Unknown"),
            "status": "listed"
        }
        if record.get("sector"):
            ipo_payload["sector"] = record.get("sector")
        if record.get("listing_board"):
            ipo_payload["listing_board"] = record.get("listing_board")
        if record.get("ipo_price") is not None:
            ipo_payload["ipo_price"] = clean_num(record.get("ipo_price"))
        if record.get("offered_shares") is not None:
            ipo_payload["offered_shares"] = int(clean_num(record.get("offered_shares")) or 0)
        if record.get("listing_date"):
            # Normalisasi tanggal
            date_str = record.get("listing_date")
            ipo_payload["listing_date"] = date_str
            
        ipo_res = supabase.table("ipos").upsert(ipo_payload, on_conflict="ticker").execute()
        if not ipo_res.data:
            print(f"[ERROR] Gagal upsert ipos untuk {ticker}")
            return False
            
        ipo_id = ipo_res.data[0]["id"]
        
        # 2. Upsert ke tabel ipo_signals
        sig_payload = {
            "ipo_id": ipo_id,
            "os_ratio": clean_num(record.get("os_ratio")),
            "sector_per": clean_num(record.get("sector_per")),
            "sector_pbv": clean_num(record.get("sector_pbv")),
            "subsector_per": clean_num(record.get("subsector_per")),
            "subsector_pbv": clean_num(record.get("subsector_pbv")),
            "shareholders_count": int(clean_num(record.get("shareholders_count")) or 0) if record.get("shareholders_count") is not None else None
        }
        supabase.table("ipo_signals").upsert(sig_payload, on_conflict="ipo_id").execute()
        
        # 3. Upsert ke tabel ipo_insider_risk (harga perolehan insider)
        par_value = clean_num(record.get("par_value"))
        if par_value is not None:
            supabase.table("ipo_insider_risk").upsert({
                "ipo_id": ipo_id,
                "harga_perolehan_insider": int(par_value)
            }, on_conflict="ipo_id").execute()
            
        return True
    except Exception as e:
        print(f"[ERROR] Gagal menyimpan data Supabase untuk {ticker}: {e}")
        return False

def scrape_nli_years(years: list[str]) -> list[dict]:
    results = []
    
    # Buat direktori cache jika belum ada
    cache_dir = Path("nli_pdf_cache")
    cache_dir.mkdir(exist_ok=True)
    
    print("[SCRAPE] Memulai sesi Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=BROWSER_USER_AGENT,
            locale="en-US",
            ignore_https_errors=True
        )
        page = context.new_page()
        
        for target_year in years:
            print(f"\n=== Memproses Tahun NLI {target_year} ===")
            try:
                page.goto(
                    "https://www.idx.co.id/en/market-data/statistical-reports/new-listing-information/",
                    wait_until="domcontentloaded",
                    timeout=60000
                )
                page.wait_for_timeout(5000)
                
                # Cari tombol selektor tahun
                found_click = False
                current_year_els = page.locator('text="2026"').all()
                for el in current_year_els:
                    try:
                        if el.is_visible():
                            el.click(force=True)
                            page.wait_for_timeout(1500)
                            
                            # Klik target tahun
                            target_year_els = page.locator(f'text="{target_year}"').all()
                            for target in target_year_els:
                                if target.is_visible():
                                    target.click(force=True)
                                    found_click = True
                                    page.wait_for_timeout(4000)
                                    break
                            if found_click:
                                break
                    except Exception as click_err:
                        print(f"[DEBUG] Gagal klik: {click_err}")
                
                # Ekstrak semua tautan PDF NLI
                anchors = page.query_selector_all("a")
                pdf_urls = []
                for a in anchors:
                    try:
                        href = a.get_attribute("href") or ""
                        text = a.text_content().strip()
                        # Pastikan tautan mengarah ke PDF NLI asli
                        if href and href.lower().endswith(".pdf") and ("/media/" in href.lower() or "/portals/" in href.lower()):
                            full_url = href if href.startswith("http") else f"https://www.idx.co.id{href}"
                            pdf_urls.append({"url": full_url, "title": text or "NLI PDF"})
                    except:
                        pass
                
                # Dedup URLs
                unique_pdfs = []
                seen_urls = set()
                for item in pdf_urls:
                    if item["url"] not in seen_urls:
                        seen_urls.add(item["url"])
                        unique_pdfs.append(item)
                
                print(f"[SCRAPE] Ditemukan {len(unique_pdfs)} PDF unik untuk tahun {target_year}.")
                
                # Proses unduhan & ekstraksi dengan Gemini
                for item in unique_pdfs:
                    pdf_url = item["url"]
                    pdf_name = pdf_url.split("/")[-1] or "temp.pdf"
                    if not pdf_name.lower().endswith(".pdf"):
                        pdf_name += ".pdf"
                    
                    local_path = cache_dir / f"{target_year}_{pdf_name}"
                    
                    print(f"\n[DOWNLOAD] Unduh NLI PDF: {item['title']} ({pdf_url})")
                    if not local_path.exists():
                        if not download_pdf(context, pdf_url, str(local_path)):
                            continue
                        # Jeda antar unduhan agar sopan
                        time.sleep(2)
                    else:
                        print(f"[CACHE] Menggunakan berkas cache lokal: {local_path}")
                        
                    # Ekstrak data menggunakan Gemini
                    print(f"[GEMINI] Parsing data menggunakan Gemini: {local_path.name}")
                    extracted_record = parse_pdf_with_gemini(str(local_path))
                    
                    if extracted_record and extracted_record.get("ticker"):
                        print("[DEBUG] Extracted Record:", extracted_record)
                        success = upsert_to_supabase(extracted_record)
                        results.append({
                            "year": target_year,
                            "ticker": extracted_record["ticker"],
                            "company": extracted_record.get("company_name", "Unknown"),
                            "os_ratio": clean_num(extracted_record.get("os_ratio")),
                            "status": "Success" if success else "DB_Failed"
                        })
                        # Jeda rate-limit untuk Gemini
                        time.sleep(10)
                    else:
                        results.append({
                            "year": target_year,
                            "ticker": "Unknown",
                            "company": item["title"],
                            "os_ratio": None,
                            "status": "Gemini_Failed"
                        })
                        
            except Exception as e:
                print(f"[ERROR] Gagal memproses tahun {target_year}: {e}")
                
        browser.close()
        
    return results

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IDX NLI Scraper with Playwright and Gemini")
    parser.add_argument("--years", type=str, default="2026", help="Target years separated by comma (e.g. 2024,2025,2026)")
    args = parser.parse_args()
    
    target_years = [y.strip() for y in args.years.split(",") if y.strip()]
    
    print(f"=== IDX NLI SCRAPER (Python + Gemini 2.5 Flash Lite) ===")
    print(f"Target Tahun: {target_years}")
    
    scraped_data = scrape_nli_years(target_years)
    
    # Keluarkan output dalam format __RESULT__= untuk dibaca oleh API JS
    print(f"\n__RESULT__={json.dumps({'success': True, 'count': len([r for r in scraped_data if r['status'] == 'Success']), 'data': scraped_data})}\n")
