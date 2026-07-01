"""
Entry point scraper prospektus ringkas e-IPO (Python + Google GenAI).
"""

from discovery import scrape_homepage
from pdf_downloader import fetch_if_changed
from extractor import extract_all_sections, reset_call_counter, RateLimitGuard
import db


def run():
    reset_call_counter()
    emiten_list = scrape_homepage()

    # Hanya proses yang belum listed -- listed/closed di-skip karena
    # struktur kepemilikan & jadwal sudah final, tidak perlu rescrape harian.
    active_emiten = [e for e in emiten_list if e.status in ("book building", "offering")]

    print(f"Ditemukan {len(emiten_list)} emiten, {len(active_emiten)} aktif diproses.")

    for emiten in active_emiten:
        print(f"\n--- Memproses {emiten.ticker} ({emiten.nama}) [Status: {emiten.status}] ---")

        try:
            pdf_bytes, doc_hash = fetch_if_changed(emiten.ipo_id)
        except ValueError as e:
            print(f"[SKIP] {emiten.ticker}: {e}")
            continue

        # Selalu upsert data dasar (nama, logo, ticker, status) meski dokumen tidak berubah
        ipo_uuid = db.upsert_ipo_basic(emiten)

        if pdf_bytes is None:
            print(f"[CACHE] Dokumen {emiten.ticker} tidak berubah, skip parsing PDF.")
            continue

        try:
            extracted = extract_all_sections(pdf_bytes)
        except RateLimitGuard as e:
            print(f"[STOP] {e}")
            break

        # [POIN 1 PERBAIKAN] Teruskan emiten.status agar kondisional harga_ipo bekerja di db.py
        db.update_ipo_jadwal_harga_dana(ipo_uuid, extracted["jadwal_harga_dana"], emiten.status)
        db.replace_shareholders(ipo_uuid, extracted["kepemilikan"])
        db.update_financial(ipo_uuid, extracted["financial"])

        print(f"[DONE] {emiten.ticker} selesai diproses. "
              f"API calls terpakai sejauh ini: {extracted['api_calls_used']}")

    print("\nSelesai.")


if __name__ == "__main__":
    run()
