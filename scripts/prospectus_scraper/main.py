"""
Entry point scraper prospektus ringkas e-IPO (Python + Google GenAI).
"""

import sys
from config import ACTIVE_STATUSES
from discovery import EipoScraperSession
from pdf_downloader import fetch_if_changed
from extractor import extract_all_sections, reset_call_counter, RateLimitGuard
import db


def run():
    metadata_only = "--metadata-only" in sys.argv
    reset_call_counter()

    with EipoScraperSession() as session:
        emiten_list = session.scrape_all()

        uuid_by_ticker: dict[str, str] = {}
        for emiten in emiten_list:
            uuid_by_ticker[emiten.ticker] = db.upsert_ipo_basic(emiten)

        if metadata_only:
            print("[INFO] Metadata-only sync completed successfully.")
            return

        active_emiten = [e for e in emiten_list if e.status in ACTIVE_STATUSES]
        print(
            f"Ditemukan {len(emiten_list)} emiten, "
            f"{len(active_emiten)} aktif akan diekstraksi prospektus."
        )

        for emiten in active_emiten:
            print(f"\n--- Memproses {emiten.ticker} ({emiten.nama}) [Status: {emiten.status}] ---")

            try:
                pdf_bytes, _doc_hash = fetch_if_changed(emiten.ipo_id, page=session.page)
            except ValueError as e:
                print(f"[SKIP] {emiten.ticker}: {e}")
                continue

            ipo_uuid = uuid_by_ticker[emiten.ticker]

            if pdf_bytes is None:
                print(f"[CACHE] Dokumen {emiten.ticker} tidak berubah, skip parsing PDF.")
                continue

            try:
                extracted = extract_all_sections(pdf_bytes)
            except RateLimitGuard as e:
                print(f"[STOP] {e}")
                break

            db.update_ipo_jadwal_harga_dana(ipo_uuid, extracted["jadwal_harga_dana"], emiten.status)
            db.replace_shareholders(ipo_uuid, extracted["kepemilikan"])
            db.update_financial(ipo_uuid, extracted["financial"])

            print(
                f"[DONE] {emiten.ticker} selesai diproses. "
                f"API calls terpakai sejauh ini: {extracted['api_calls_used']}"
            )

    print("\nSelesai.")


if __name__ == "__main__":
    run()
