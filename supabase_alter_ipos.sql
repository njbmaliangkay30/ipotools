-- Menambahkan kolom-kolom baru ke tabel ipos untuk data pre-listing dari e-ipo.co.id
ALTER TABLE ipos
ADD COLUMN IF NOT EXISTS bb_price_low INT,
ADD COLUMN IF NOT EXISTS bb_price_high INT,
ADD COLUMN IF NOT EXISTS bb_open DATE,
ADD COLUMN IF NOT EXISTS bb_close DATE,
ADD COLUMN IF NOT EXISTS offering_open DATE,
ADD COLUMN IF NOT EXISTS offering_close DATE,
ADD COLUMN IF NOT EXISTS underwriters TEXT,
ADD COLUMN IF NOT EXISTS website VARCHAR(255);
