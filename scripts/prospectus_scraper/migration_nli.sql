-- Migration untuk mendukung parameter NLI (Valuasi Sektor & Animo Investor)
-- Jalankan di Supabase SQL editor.

ALTER TABLE ipo_signals ADD COLUMN IF NOT EXISTS sector_per DECIMAL;
ALTER TABLE ipo_signals ADD COLUMN IF NOT EXISTS sector_pbv DECIMAL;
ALTER TABLE ipo_signals ADD COLUMN IF NOT EXISTS subsector_per DECIMAL;
ALTER TABLE ipo_signals ADD COLUMN IF NOT EXISTS subsector_pbv DECIMAL;
ALTER TABLE ipo_signals ADD COLUMN IF NOT EXISTS shareholders_count INTEGER;
