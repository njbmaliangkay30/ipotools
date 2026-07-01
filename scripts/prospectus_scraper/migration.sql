-- Migration untuk mendukung scraper prospektus ringkas e-IPO
-- Jalankan di Supabase SQL editor.

-- 1. Kolom tambahan di tabel ipos (jika belum ada)
ALTER TABLE ipos ADD COLUMN IF NOT EXISTS eipo_id text;
ALTER TABLE ipos ADD COLUMN IF NOT EXISTS logo_url text;

-- [POIN 3 PERBAIKAN] Pastikan kolom ticker memiliki constraint UNIQUE untuk mendukung on_conflict="ticker"
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ipos_ticker_key'
    ) THEN
        ALTER TABLE ipos ADD CONSTRAINT ipos_ticker_key UNIQUE (ticker);
    END IF;
END $$;

-- 2. Tabel struktur kepemilikan
CREATE TABLE IF NOT EXISTS ipo_shareholders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ipo_id uuid NOT NULL REFERENCES ipos(id) ON DELETE CASCADE,
    nama_pemegang_saham text NOT NULL,
    pct_kepemilikan numeric(6,3) NOT NULL,
    jumlah_saham bigint,
    is_esa boolean DEFAULT false,
    is_masyarakat boolean DEFAULT false,
    status_lockup text CHECK (status_lockup IN ('terkena', 'tidak_terkena', 'tidak_disebutkan')),
    validation_status text CHECK (validation_status IN ('ok', 'perlu_review', 'reject')),
    created_at timestamptz DEFAULT now()
);

-- 3. Kolom tambahan di ipo_insider_risk untuk penjatahan terpusat
ALTER TABLE ipo_insider_risk ADD COLUMN IF NOT EXISTS penjatahan_golongan text;
ALTER TABLE ipo_insider_risk ADD COLUMN IF NOT EXISTS catatan_alokasi_oversubs text;
ALTER TABLE ipo_insider_risk ADD COLUMN IF NOT EXISTS penggunaan_dana_raw text;

-- ipo_id sebagai unique constraint supaya upsert on_conflict berfungsi
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ipo_insider_risk_ipo_id_key'
    ) THEN
        ALTER TABLE ipo_insider_risk ADD CONSTRAINT ipo_insider_risk_ipo_id_key UNIQUE (ipo_id);
    END IF;
END $$;

-- 4. Tabel financial highlights
CREATE TABLE IF NOT EXISTS ipo_financial_highlights (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ipo_id uuid NOT NULL UNIQUE REFERENCES ipos(id) ON DELETE CASCADE,
    periode_laporan text,
    pendapatan bigint,
    laba_bersih bigint,
    total_liabilitas bigint,
    total_ekuitas bigint,
    total_aset bigint,
    updated_at timestamptz DEFAULT now()
);
