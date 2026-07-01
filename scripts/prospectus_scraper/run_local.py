import os
import time
import json
from supabase import create_client, Client
from dotenv import dotenv_values

from extractor import extract_all_sections, reset_call_counter, RateLimitGuard
import db

def run_local():
    env = dotenv_values('.env.local')
    supabase_url = env.get('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("[ERROR] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing in .env.local")
        return
        
    s: Client = create_client(supabase_url, supabase_key)
    tickers = ['PRDL', 'EMMI', 'BACH', 'RANS', 'JECX']
    
    print(f"Starting local PDF extraction for tickers: {tickers}")
    
    for ticker in tickers:
        print(f"\n=================== MEMPROSES TICKER: {ticker} ===================")
        
        # 1. Ambil info IPO dari database
        res = s.table('ipos').select('*').eq('ticker', ticker).execute().data
        if not res:
            print(f"[SKIP] Ticker {ticker} tidak ditemukan di database ipos.")
            continue
        ipo_record = res[0]
        ipo_uuid = ipo_record['id']
        status = ipo_record['status'] or 'listed'
        
        # 2. Cek file PDF lokal
        pdf_path = f"scratch/pdf/{ticker}.pdf"
        if not os.path.exists(pdf_path):
            print(f"[SKIP] File PDF tidak ditemukan di path: {pdf_path}")
            continue
            
        print(f"[INFO] Membaca file PDF lokal: {pdf_path}...")
        with open(pdf_path, 'rb') as f:
            pdf_bytes = f.read()
            
        print(f"[INFO] Memulai ekstraksi dengan Gemini untuk {ticker}...")
        try:
            reset_call_counter()
            extracted = extract_all_sections(pdf_bytes)
            
            # Save data to database
            print(f"[DB] Upsert jadwal, harga, dan dana untuk {ticker}...")
            db.update_ipo_jadwal_harga_dana(ipo_uuid, extracted["jadwal_harga_dana"], status)
            
            print(f"[DB] Replace shareholders untuk {ticker}...")
            db.replace_shareholders(ipo_uuid, extracted["kepemilikan"])
            
            print(f"[DB] Update financial highlights untuk {ticker}...")
            db.update_financial(ipo_uuid, extracted["financial"])
            
            print(f"[SUCCESS] Ticker {ticker} berhasil diekstrak dan disimpan ke Supabase!")
            print(f"API calls terpakai: {extracted['api_calls_used']}")
            
        except RateLimitGuard as e:
            print(f"[STOP] Terhenti karena rate limit: {e}")
            break
        except Exception as e:
            print(f"[ERROR] Gagal memproses ticker {ticker}: {str(e)}")
            
        # Jeda antar emiten untuk meredam rate limit
        print("[INFO] Menunggu 30 detik sebelum berpindah ke emiten berikutnya...")
        time.sleep(30)
        
    print("\nProses ekstraksi lokal selesai.")

if __name__ == "__main__":
    run_local()
