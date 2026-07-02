"""
Modul ekstraksi PDF prospektus ringkas via Google Generative AI (Gemini).
Dilengkapi penanganan JSONDecodeError, retry otomatis 1x, dan fallback response.
"""

import base64
import json
import re
import time
import google.generativeai as genai

from config import (
    GEMINI_API_KEY,
    LLM_MODEL,
    MAX_API_CALLS_PER_RUN,
    OWNERSHIP_TOTAL_MIN_SOFT,
    OWNERSHIP_TOTAL_MAX_SOFT,
    OWNERSHIP_TOTAL_MIN_HARD,
    OWNERSHIP_TOTAL_MAX_HARD,
)

genai.configure(api_key=GEMINI_API_KEY)

_call_counter = {"count": 0}


class RateLimitGuard(Exception):
    pass


def _track_call():
    _call_counter["count"] += 1
    if _call_counter["count"] > MAX_API_CALLS_PER_RUN:
        raise RateLimitGuard(
            f"Melebihi batas {MAX_API_CALLS_PER_RUN} API call per run. "
            f"Hentikan proses, sisa emiten diproses di siklus berikutnya."
        )


def reset_call_counter():
    _call_counter["count"] = 0


def get_call_count() -> int:
    return _call_counter["count"]


def _call_llm(pdf_bytes: bytes, prompt: str, max_retries: int = 1) -> dict:
    """
    Panggil Google Gemini API dengan lampiran PDF (Inline Base64 blob / Part).
    Jika terkena limit kuota/429, otomatis berpindah ke model alternatif untuk menyelesaikan ekstraksi.
    """
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
    
    for active_model_name in models_to_try:
        print(f"[LLM] Mencoba model: {active_model_name}...")
        model = genai.GenerativeModel(
            model_name=active_model_name,
            generation_config={
                "temperature": 0.1,
                "response_mime_type": "application/json",
            }
        )

        pdf_part = {
            "mime_type": "application/pdf",
            "data": pdf_bytes
        }

        for attempt in range(max_retries + 1):
            _track_call()
            try:
                response = model.generate_content([pdf_part, prompt])
                text = response.text.strip()
                cleaned = re.sub(r"^```json|```$", "", text, flags=re.MULTILINE).strip()
                return json.loads(cleaned)
            except (json.JSONDecodeError, ValueError) as e:
                print(f"[WARN] Gagal memparsing JSON dari respons Gemini (Model: {active_model_name}, Percobaan {attempt + 1}/{max_retries + 1}): {e}")
                if attempt < max_retries:
                    time.sleep(2)
                    continue
                else:
                    print(f"[ERROR] Ekstraksi {active_model_name} gagal total setelah retry. Mencoba model berikutnya...")
                    last_error = e
                    break
            except Exception as e:
                err_str = str(e).lower()
                if "quota" in err_str or "429" in err_str or "exhausted" in err_str:
                    print(f"[WARN] Model {active_model_name} terkena Rate Limit / 429 Quota Exceeded. Berpindah ke model berikutnya...")
                    last_error = e
                    break
                else:
                    print(f"[WARN] Gemini API error pada {active_model_name}: {e}. Mencoba model berikutnya...")
                    last_error = e
                    break
                    
    # Jika semua model gagal
    print("[ERROR] Semua model Gemini gagal mengekstrak data.")
    return {"error": True, "validation_status": "perlu_review", "raw_error": str(last_error)}


# ---------------------------------------------------------------------
# SECTION 1: Jadwal + Harga Penawaran + Rencana Penggunaan Dana
# ---------------------------------------------------------------------

PROMPT_JADWAL_HARGA_DANA = """
Kamu membaca dokumen prospektus ringkas IPO (bahasa Indonesia). Ekstrak
informasi berikut dan kembalikan HANYA JSON valid, tanpa teks lain.

Schema:
{
  "jadwal": {
    "penawaran_awal_mulai": "YYYY-MM-DD atau null",
    "penawaran_awal_selesai": "YYYY-MM-DD atau null",
    "penawaran_umum_mulai": "YYYY-MM-DD atau null",
    "penawaran_umum_selesai": "YYYY-MM-DD atau null",
    "tanggal_penjatahan": "YYYY-MM-DD atau null",
    "tanggal_distribusi": "YYYY-MM-DD atau null",
    "tanggal_pencatatan_bursa": "YYYY-MM-DD atau null"
  },
  "penawaran_umum": {
    "jumlah_saham_lembar": integer,
    "jumlah_saham_lot": integer,
    "pct_dari_total_saham": float,
    "harga_penawaran_low": integer,
    "harga_penawaran_high": integer,
    "nilai_total_penawaran_rupiah": integer,
    "nilai_nominal": integer
  },
  "penggunaan_dana": [
    {
      "kategori": "Modal Kerja (OPEX) | Belanja Modal (CAPEX) | Pelunasan Utang | Akuisisi & Investasi | Lain-lain",
      "judul_singkat": "Judul profesional singkat (2-5 kata) untuk alokasi ini. HARUS menyebutkan nama entitas anak/bank/mesin spesifik jika tertulis di dokumen (misal: 'Penyertaan Modal PT NPS (Anak Usaha)', 'Pelunasan Utang Bank Mandiri', 'Pembelian Mesin Produksi')",
      "deskripsi_ringkas": "Kalimat deskripsi ringkas, bersih, dan profesional dari penggunaan dana tersebut",
      "pct": float,
      "nominal_rupiah": integer atau null
    }
  ],
  "penjatahan_terpusat": {
    "golongan": "string atau null",
    "catatan_alokasi_oversubs": "string atau null"
  },
  "underwriters": ["nama perusahaan sekuritas 1", "nama perusahaan sekuritas 2"]
}

Aturan penting:
1. Jika suatu field tidak ditemukan di dokumen, gunakan null.
2. Untuk harga_penawaran_low/high: jika dokumen hanya menyebut satu harga final (bukan rentang), isi keduanya dengan angka yang sama.
3. Untuk nilai_nominal: nilai nominal saham (dalam Rupiah penuh), biasanya tertulis di bagian awal prospektus (misalnya "nilai nominal Rp16 setiap saham" atau "nilai nominal Rp160").
4. **PENTING UNTUK RENCANA PENGGUNAAN DANA**:
   - Baca Bab II atau bagian penggunaan dana secara terperinci. Fokus hanya pada ALOKASI UTAMA di tingkat pertama (biasanya dengan penomoran 1, 2, 3, 4, dst., atau dengan kalimat 'Sebesar Rp...', 'Sekitar Rp...').
   - Hati-hati: Bedakan alokasi utama dengan rincian saldo pokok utang/pinjaman yang disebut di dalam penjelasan teks (seperti rincian Kredit Investasi 1, 2, 3, dst., yang nominalnya adalah sisa saldo utang masa lalu). JANGAN memasukkan sisa saldo utang penjelasan sebagai alokasi utama!
   - Persentase (pct): Jika persentase untuk alokasi utama tidak tertulis secara persentase, hitunglah manual: `(nominal_rupiah / nilai_total_penawaran_rupiah) * 100`. Atau jika ada item 'Sisanya', jadikan itu 100% dikurangi total item lainnya agar total penggunaan dana tepat 100%.
"""


def extract_jadwal_harga_dana(pdf_bytes: bytes) -> dict:
    res = _call_llm(pdf_bytes, PROMPT_JADWAL_HARGA_DANA)
    if not isinstance(res, dict) or res.get("error"):
        if isinstance(res, list) and len(res) > 0 and isinstance(res[0], dict):
            return res[0]
        return {
            "jadwal": {},
            "penawaran_umum": {},
            "penggunaan_dana": [],
            "penjatahan_terpusat": {},
            "underwriters": []
        }
    return res


# ---------------------------------------------------------------------
# SECTION 2: Struktur Kepemilikan (dengan status lockup per pihak)
# ---------------------------------------------------------------------

PROMPT_KEPEMILIKAN = """
Kamu membaca dokumen prospektus ringkas IPO (bahasa Indonesia). Fokus pada
bagian struktur permodalan / kepemilikan saham PASCA-IPO (setelah
penawaran umum selesai), dan bagian pernyataan lock-up saham.

Kembalikan HANYA JSON valid, tanpa teks lain.

Schema:
{
  "pemegang_saham": [
    {
      "nama": "string",
      "pct_kepemilikan": float,
      "jumlah_saham": integer atau null,
      "is_esa": boolean,
      "is_masyarakat": boolean,
      "status_lockup": "terkena" | "tidak_terkena" | "tidak_disebutkan"
    }
  ],
  "ringkasan_lockup_umum": "kutipan singkat/parafrase pernyataan lockup umum jika ada, atau null",
  "lockup_bulan": integer atau null
}

Aturan penting:
- Baris "Masyarakat" atau "Publik" masuk sebagai satu baris dengan is_masyarakat=true, is_esa=false.
- Jika ada alokasi ESA, masukkan sebagai baris terpisah dengan is_esa=true.
- status_lockup: jika naratif menyebut pihak terkena lockup, set "terkena". Jika tidak terkena, set "tidak_terkena". Jika tidak disebut sama sekali, set "tidak_disebutkan".
"""


def extract_kepemilikan(pdf_bytes: bytes) -> dict:
    return _call_llm(pdf_bytes, PROMPT_KEPEMILIKAN)


def _total_pct(kepemilikan_result: dict) -> float:
    return sum(row.get("pct_kepemilikan", 0.0) for row in kepemilikan_result.get("pemegang_saham", []))


def extract_kepemilikan_with_validation(pdf_bytes: bytes) -> dict:
    result_1 = extract_kepemilikan(pdf_bytes)
    if isinstance(result_1, list) and len(result_1) > 0 and isinstance(result_1[0], dict):
        result_1 = result_1[0]
    if not isinstance(result_1, dict) or result_1.get("error"):
        return result_1 if isinstance(result_1, dict) else {"error": True}

    total_1 = _total_pct(result_1)

    if OWNERSHIP_TOTAL_MIN_SOFT <= total_1 <= OWNERSHIP_TOTAL_MAX_SOFT:
        result_1["validation_status"] = "ok"
        result_1["total_pct_run1"] = total_1
        return result_1

    result_2 = extract_kepemilikan(pdf_bytes)
    if isinstance(result_2, list) and len(result_2) > 0 and isinstance(result_2[0], dict):
        result_2 = result_2[0]
    if not isinstance(result_2, dict) or result_2.get("error"):
        result_1["validation_status"] = "perlu_review"
        result_1["total_pct_run1"] = total_1
        return result_1

    total_2 = _total_pct(result_2)
    names_1 = {row["nama"].strip().lower() for row in result_1.get("pemegang_saham", []) if "nama" in row}
    names_2 = {row["nama"].strip().lower() for row in result_2.get("pemegang_saham", []) if "nama" in row}

    both_in_soft_range = (OWNERSHIP_TOTAL_MIN_SOFT <= total_2 <= OWNERSHIP_TOTAL_MAX_SOFT)
    names_match = names_1 == names_2

    if both_in_soft_range and names_match:
        result_2["validation_status"] = "ok"
        result_2["total_pct_run1"] = total_1
        result_2["total_pct_run2"] = total_2
        return result_2

    if (OWNERSHIP_TOTAL_MIN_HARD <= total_1 <= OWNERSHIP_TOTAL_MAX_HARD or OWNERSHIP_TOTAL_MIN_HARD <= total_2 <= OWNERSHIP_TOTAL_MAX_HARD):
        result_1["validation_status"] = "perlu_review"
        result_1["total_pct_run1"] = total_1
        result_1["total_pct_run2"] = total_2
        result_1["run2_pemegang_saham"] = result_2.get("pemegang_saham")
        return result_1

    return {
        "validation_status": "reject",
        "total_pct_run1": total_1,
        "total_pct_run2": total_2,
        "pemegang_saham": [],
    }


# ---------------------------------------------------------------------
# SECTION 3: Financial Highlights
# ---------------------------------------------------------------------

PROMPT_FINANCIAL = """
Kamu membaca dokumen prospektus ringkas IPO (bahasa Indonesia). Ekstrak
ikhtisar data keuangan (financial highlights) untuk SEMUA tahun/periode yang tersedia
di laporan keuangan audit komparatif (biasanya 3 tahun terakhir, misal 2025, 2024, 2023).

Kembalikan HANYA JSON valid.

Schema:
{
  "periode_laporan": "string, misal '31 Desember 2025'",
  "historical": [
    {
      "tahun": "string, misal '2025' atau '2025 (Audited)'",
      "pendapatan": integer atau null,
      "laba_bersih": integer atau null,
      "total_liabilitas": integer atau null,
      "total_ekuitas": integer atau null,
      "total_aset": integer atau null
    }
  ]
}

Aturan penting:
1. Semua nilai dalam Rupiah penuh. Jika dokumen menulis dalam satuan juta Rupiah, kalikan dengan 1.000.000 (contoh: Rp926.763 juta ditulis sebagai 926763000000). Jika dalam ribuan Rupiah, kalikan dengan 1.000.
2. **SANGAT PENTING: HINDARI PERGESERAN KOLOM TAHUN**:
   - Baca dengan sangat teliti orientasi tabel keuangan komparatif (apakah kolomnya diurutkan dari kiri ke kanan: 2025 | 2024 | 2023, atau sebaliknya).
   - Pastikan Anda memetakan nilai (Pendapatan, Laba Bersih, Aset, Liabilitas, Ekuitas) ke tahun yang tepat secara horizontal.
   - Contoh untuk JECX: Pendapatan tahun 2025 adalah Rp926.763 juta (ditulis 926763000000), tahun 2024 adalah Rp887.715 juta, dan tahun 2023 adalah Rp825.085 juta. Laba bersih (Laba tahun berjalan) tahun 2025 adalah Rp72.495 juta (ditulis 72495000000), tahun 2024 adalah Rp62.472 juta, dan tahun 2023 adalah Rp127.284 juta. Ekuitas tahun 2025 adalah Rp810.995 juta, tahun 2024 adalah Rp811.734 juta, dan tahun 2023 adalah Rp830.634 juta. JANGAN sampai tertukar atau tergeser antar tahun!
"""


def extract_financial(pdf_bytes: bytes) -> dict:
    res = _call_llm(pdf_bytes, PROMPT_FINANCIAL)
    if not isinstance(res, dict) or res.get("error"):
        if isinstance(res, list) and len(res) > 0 and isinstance(res[0], dict):
            return res[0]
        return {}
    return res


# ---------------------------------------------------------------------
# Orkestrasi satu emiten
# ---------------------------------------------------------------------

def extract_all_sections(pdf_bytes: bytes) -> dict:
    print("[INFO] Mengekstrak Jadwal & Penggunaan Dana...")
    jadwal_harga_dana = extract_jadwal_harga_dana(pdf_bytes)
    
    print("[INFO] Menunggu 25 detik untuk menghindari rate limit...")
    time.sleep(25)
    
    print("[INFO] Mengekstrak Struktur Kepemilikan...")
    kepemilikan = extract_kepemilikan_with_validation(pdf_bytes)
    
    print("[INFO] Menunggu 25 detik untuk menghindari rate limit...")
    time.sleep(25)
    
    print("[INFO] Mengekstrak Financial Highlights...")
    financial = extract_financial(pdf_bytes)

    return {
        "jadwal_harga_dana": jadwal_harga_dana,
        "kepemilikan": kepemilikan,
        "financial": financial,
        "api_calls_used": get_call_count(),
    }
