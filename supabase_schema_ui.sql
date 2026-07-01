-- 1. Create or Update Underwriters Table
CREATE TABLE IF NOT EXISTS underwriters (
    broker_code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255),
    win_rate DECIMAL(5,2),
    ara_d1 DECIMAL(5,2),
    avg_ara_streak DECIMAL(5,2),
    data_points INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE underwriters ADD COLUMN IF NOT EXISTS win_rate DECIMAL(5,2);
ALTER TABLE underwriters ADD COLUMN IF NOT EXISTS ara_d1 DECIMAL(5,2);
ALTER TABLE underwriters ADD COLUMN IF NOT EXISTS avg_ara_streak DECIMAL(5,2);
ALTER TABLE underwriters ADD COLUMN IF NOT EXISTS data_points INT DEFAULT 0;

-- 2. Create or Update IPO Underwriters
CREATE TABLE IF NOT EXISTS ipo_underwriters (
    id SERIAL PRIMARY KEY,
    ipo_id BIGINT REFERENCES ipos(id) ON DELETE CASCADE,
    broker_code VARCHAR(10) REFERENCES underwriters(broker_code) ON DELETE CASCADE,
    role VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ipo_id, broker_code)
);
ALTER TABLE ipo_underwriters ADD COLUMN IF NOT EXISTS role VARCHAR(50);

-- 3. Create or Update IPO Insider Risk Table
CREATE TABLE IF NOT EXISTS ipo_insider_risk (
    id SERIAL PRIMARY KEY,
    ipo_id BIGINT REFERENCES ipos(id) ON DELETE CASCADE,
    harga_perolehan_insider INT,
    ada_lockup BOOLEAN,
    lockup_months INT,
    pct_divestasi DECIMAL(5,2),
    penggunaan_dana_raw TEXT,
    penggunaan_dana_kategori VARCHAR(100),
    pct_dana_pemegang_lama DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ipo_id)
);
ALTER TABLE ipo_insider_risk ADD COLUMN IF NOT EXISTS harga_perolehan_insider INT;
ALTER TABLE ipo_insider_risk ADD COLUMN IF NOT EXISTS ada_lockup BOOLEAN;
ALTER TABLE ipo_insider_risk ADD COLUMN IF NOT EXISTS lockup_months INT;
ALTER TABLE ipo_insider_risk ADD COLUMN IF NOT EXISTS pct_divestasi DECIMAL(5,2);
ALTER TABLE ipo_insider_risk ADD COLUMN IF NOT EXISTS penggunaan_dana_raw TEXT;
ALTER TABLE ipo_insider_risk ADD COLUMN IF NOT EXISTS penggunaan_dana_kategori VARCHAR(100);
ALTER TABLE ipo_insider_risk ADD COLUMN IF NOT EXISTS pct_dana_pemegang_lama DECIMAL(5,2);

-- 4. Create or Update Decisions Table
CREATE TABLE IF NOT EXISTS decisions (
    id SERIAL PRIMARY KEY,
    ipo_id BIGINT REFERENCES ipos(id) ON DELETE CASCADE,
    decision VARCHAR(50),
    akun_count INT,
    lot_per_akun INT,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS decision VARCHAR(50);
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS akun_count INT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS lot_per_akun INT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS reason TEXT;

-- 5. Alter IPO Signals
ALTER TABLE ipo_signals ADD COLUMN IF NOT EXISTS news_count_30d INT;
ALTER TABLE ipo_signals ADD COLUMN IF NOT EXISTS sector_momentum_60d DECIMAL(5,2);
ALTER TABLE ipo_signals ADD COLUMN IF NOT EXISTS google_trends_score INT;
ALTER TABLE ipo_signals ADD COLUMN IF NOT EXISTS community_buzz INT;
ALTER TABLE ipo_signals ADD COLUMN IF NOT EXISTS os_estimate DECIMAL(10,2);
ALTER TABLE ipo_signals ADD COLUMN IF NOT EXISTS os_confidence VARCHAR(50);
