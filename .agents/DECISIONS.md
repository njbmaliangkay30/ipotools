# Decisions Log

## [2026-07-01] Migrasi Scraper dari Node.js ke Python + Google GenAI

### Konteks & Masalah
Sistem scraper prospektus sebelumnya berbasis Node.js dengan penguraian Regex yang kaku dan rentan patah ketika format prospektus emiten berbeda. Selama percobaan transisi ke LLM, ditemukan 3 kelemahan kritis pada draf awal skrip Python:
1. Harga IPO diisi tanpa syarat dari batas atas harga penawaran awal (*book building*), merusak akurasi data.
2. Kurangnya proteksi *unique constraint* pada kolom `ticker` yang menyebabkan potensi error saat *upsert* Supabase.
3. Kerentanan `JSONDecodeError` saat memproses keluaran LLM tanpa mekanisme *retry*.

### Keputusan
1. **Pilihan Teknologi:** Mengadopsi **Python 3.10+** dan **Google Generative AI (`gemini-1.5-flash`)** sebagai mesin utama penguraian dokumen prospektus PDF. Model `gemini-1.5-flash` dipilih karena kapasitas *context window* hingga 1 juta token, efisiensi biaya, dan kecepatan eksekusi tinggi untuk dokumen panjang.
2. **Logika Kondisional Harga (`harga_ipo`):** Kolom `harga_ipo` pada tabel `ipos` wajib bernilai `NULL` untuk emiten berstatus *"book building"*. Harga hanya diisi jika emiten telah memasuki status *"offering"*, *"listed"*, atau *"closed"*.
3. **Penyelarasan Skema (`migration.sql`):** Menambahkan pemeriksaan dan pembentukan *constraint* `UNIQUE` pada kolom `ticker` di tabel `ipos` secara aman (`IF NOT EXISTS`).
4. **Resiliensi Parser (`extractor.py`):** Mengonfigurasi Gemini API dengan `response_mime_type="application/json"`, menambahkan *try/except* dengan otomatis *retry* 1x, dan menyediakan respons *fallback* agar kegagalan 1 dokumen tidak menghentikan seluruh siklus *scraping*.
5. **Isolasi Direktori:** Seluruh skrip Python ditempatkan di direktori khusus `scripts/prospectus_scraper/` terpisah dari skrip Node.js lama.
