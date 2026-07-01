import json
from supabase import create_client, Client

from config import SUPABASE_URL, SUPABASE_KEY
from discovery import EmitenSummary

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def upsert_ipo_basic(emiten: EmitenSummary) -> str:
    """
    Insert-or-update row emiten di tabel `ipos` berdasarkan ticker.
    Menulis semua field yang tersedia dari EmitenSummary ke kolom Supabase yang benar.
    Return id (UUID) dari row yang di-upsert.
    """
    payload: dict = {
        "ticker": emiten.ticker,
        "company_name": emiten.nama,
        "status": emiten.status,
        "logo_url": emiten.logo_url,
        "eipo_id": emiten.ipo_id,
    }

    # Field opsional - hanya tulis jika ada nilainya
    if emiten.sector is not None:
        payload["sector"] = emiten.sector
    if emiten.website is not None:
        payload["website"] = emiten.website
    if emiten.underwriters is not None:
        payload["underwriters"] = emiten.underwriters
    if emiten.price is not None:
        payload["ipo_price"] = emiten.price
    if emiten.offered_shares is not None:
        payload["offered_shares"] = emiten.offered_shares
    if emiten.public_float_pct is not None:
        payload["public_float_pct"] = emiten.public_float_pct
    if emiten.bb_price_low is not None:
        payload["bb_price_low"] = emiten.bb_price_low
    if emiten.bb_price_high is not None:
        payload["bb_price_high"] = emiten.bb_price_high
    if emiten.bb_open is not None:
        payload["bb_open"] = emiten.bb_open
    if emiten.bb_close is not None:
        payload["bb_close"] = emiten.bb_close
    if emiten.offering_open is not None:
        payload["offering_open"] = emiten.offering_open
    if emiten.offering_close is not None:
        payload["offering_close"] = emiten.offering_close
    if emiten.distribution_date is not None:
        payload["distribution_date"] = emiten.distribution_date
    if emiten.listing_date is not None:
        payload["listing_date"] = emiten.listing_date

    result = (
        supabase.table("ipos")
        .upsert(payload, on_conflict="ticker")
        .execute()
    )
    return result.data[0]["id"]


def update_ipo_jadwal_harga_dana(ipo_uuid: str, data: dict, status_emiten: str = "") -> None:
    """
    Update jadwal dan data keuangan dari hasil ekstraksi PDF Gemini (opsional).
    Hanya digunakan jika scraping halaman detail tidak cukup atau sebagai enrichment.
    Menerapkan prioritas: data E-IPO webpage (live) > PDF prospectus (static).
    """
    jadwal = data.get("jadwal", {})
    penawaran = data.get("penawaran_umum", {})
    penjatahan = data.get("penjatahan_terpusat", {})

    # Ambil data yang saat ini tersimpan di DB
    current_ipo = supabase.table("ipos").select(
        "ipo_price, offered_shares, public_float_pct, underwriters, bb_open, bb_close, offering_open, offering_close, listing_date"
    ).eq("id", ipo_uuid).single().execute().data or {}

    payload = {}

    # Jadwal (hanya isi jika belum ada di DB)
    for col, key in [
        ("bb_open", "penawaran_awal_mulai"),
        ("bb_close", "penawaran_awal_selesai"),
        ("offering_open", "penawaran_umum_mulai"),
        ("offering_close", "penawaran_umum_selesai"),
        ("listing_date", "tanggal_pencatatan_bursa"),
    ]:
        if current_ipo.get(col) is None and jadwal.get(key):
            payload[col] = jadwal[key]

    # Harga Penawaran / IPO Price (prioritaskan harga live dari E-IPO, overwrite jika None atau default 100)
    current_price = current_ipo.get("ipo_price")
    if (current_price is None or current_price == 100) and status_emiten.lower() in ("offering", "listed", "closed"):
        harga_final = penawaran.get("harga_penawaran_high") or penawaran.get("harga_penawaran_low")
        if harga_final is not None:
            payload["ipo_price"] = harga_final

    # Jumlah Saham Ditawarkan (prioritaskan data live E-IPO)
    if current_ipo.get("offered_shares") is None and penawaran.get("jumlah_saham_lembar"):
        payload["offered_shares"] = penawaran["jumlah_saham_lembar"]

    # Public Float % (prioritaskan data live E-IPO)
    if current_ipo.get("public_float_pct") is None and penawaran.get("pct_dari_total_saham"):
        payload["public_float_pct"] = penawaran["pct_dari_total_saham"]

    # Underwriters (prioritaskan data live E-IPO)
    if current_ipo.get("underwriters") is None and data.get("underwriters"):
        payload["underwriters"] = ", ".join(data["underwriters"])

    # Batas Harga Book Building (selalu update/overwrite dari PDF prospektus resmi)
    if penawaran.get("harga_penawaran_low"):
        payload["bb_price_low"] = penawaran["harga_penawaran_low"]
    if penawaran.get("harga_penawaran_high"):
        payload["bb_price_high"] = penawaran["harga_penawaran_high"]

    if payload:
        supabase.table("ipos").update(payload).eq("id", ipo_uuid).execute()

    # Rencana penggunaan dana + risiko insider
    penggunaan_dana = data.get("penggunaan_dana", [])
    insider_payload = {
        "ipo_id": ipo_uuid,
    }
    
    if penggunaan_dana:
        dana_map = {row["kategori"].lower(): row["pct"] for row in penggunaan_dana}
        insider_payload["penggunaan_dana_raw"] = json.dumps(penggunaan_dana, ensure_ascii=False)
        insider_payload["pct_dana_pemegang_lama"] = dana_map.get("divestasi") or dana_map.get("pemegang saham lama")

    # Tambahkan nominal saham sebagai harga perolehan insider
    penawaran_umum = data.get("penawaran_umum", {})
    nilai_nominal = penawaran_umum.get("nilai_nominal")
    if nilai_nominal:
        insider_payload["harga_perolehan_insider"] = nilai_nominal

    if len(insider_payload) > 1:
        supabase.table("ipo_insider_risk").upsert(
            insider_payload, on_conflict="ipo_id"
        ).execute()

    if penjatahan.get("golongan"):
        supabase.table("ipo_insider_risk").update(
            {"penjatahan_golongan": penjatahan.get("golongan"),
             "catatan_alokasi_oversubs": penjatahan.get("catatan_alokasi_oversubs")}
        ).eq("ipo_id", ipo_uuid).execute()


def replace_shareholders(ipo_uuid: str, kepemilikan_data: dict) -> None:
    """
    Struktur kepemilikan bersifat snapshot final (tidak berubah tiap hari),
    jadi ini full replace, bukan incremental update.
    """
    status = kepemilikan_data.get("validation_status")

    if status == "reject":
        print(f"[REJECT] Kepemilikan ipo_id={ipo_uuid} ditolak, total pct di luar rentang wajar. "
              f"run1={kepemilikan_data.get('total_pct_run1')} run2={kepemilikan_data.get('total_pct_run2')}")
        return

    # Hapus dan tulis ulang struktur pemegang saham
    supabase.table("ipo_shareholders").delete().eq("ipo_id", ipo_uuid).execute()

    rows = []
    for sh in kepemilikan_data.get("pemegang_saham", []):
        rows.append({
            "ipo_id": ipo_uuid,
            "nama_pemegang_saham": sh["nama"],
            "pct_kepemilikan": sh["pct_kepemilikan"],
            "jumlah_saham": sh.get("jumlah_saham"),
            "is_esa": sh.get("is_esa", False),
            "is_masyarakat": sh.get("is_masyarakat", False),
            "status_lockup": sh.get("status_lockup", "tidak_disebutkan"),
            "validation_status": status,
        })

    if rows:
        supabase.table("ipo_shareholders").insert(rows).execute()

    # Update data lockup ke ipo_insider_risk
    lockup_bulan = kepemilikan_data.get("lockup_bulan")
    ringkasan_lockup = kepemilikan_data.get("ringkasan_lockup_umum")
    ada_lockup_bool = bool(lockup_bulan or ringkasan_lockup)
    
    insider_payload = {
        "ipo_id": ipo_uuid,
        "ada_lockup": ada_lockup_bool,
        "has_lock_up": ada_lockup_bool,
        "lockup_months": lockup_bulan,
        "lock_up_period_months": lockup_bulan,
        "lock_up_exemptions": ringkasan_lockup
    }
    
    supabase.table("ipo_insider_risk").upsert(insider_payload, on_conflict="ipo_id").execute()

    if status == "perlu_review":
        print(f"[REVIEW] Kepemilikan ipo_id={ipo_uuid} perlu ditinjau manual. "
              f"run1={kepemilikan_data.get('total_pct_run1')} run2={kepemilikan_data.get('total_pct_run2')}")


def update_financial(ipo_uuid: str, financial_data: dict) -> None:
    historical = financial_data.get("historical", [])
    
    # Ambil data terbaru (indeks pertama) untuk kolom utama fallback
    latest = historical[0] if historical else {}
    
    # Jika ada data historis, serialize ke kolom periode_laporan dengan prefix HISTORICAL:
    periode_val = financial_data.get("periode_laporan")
    if historical:
        periode_val = "HISTORICAL:" + json.dumps(historical, ensure_ascii=False)

    payload = {
        "ipo_id": ipo_uuid,
        "periode_laporan": periode_val,
        "pendapatan": latest.get("pendapatan") or financial_data.get("pendapatan"),
        "laba_bersih": latest.get("laba_bersih") or financial_data.get("laba_bersih"),
        "total_liabilitas": latest.get("total_liabilitas") or financial_data.get("total_liabilitas"),
        "total_ekuitas": latest.get("total_ekuitas") or financial_data.get("total_ekuitas"),
        "total_aset": latest.get("total_aset") or financial_data.get("total_aset"),
    }
    supabase.table("ipo_financial_highlights").upsert(
        payload, on_conflict="ipo_id"
    ).execute()
