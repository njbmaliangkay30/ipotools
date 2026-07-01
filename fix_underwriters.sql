-- 1. Drop existing tables safely to recreate them with the correct schema
DROP TABLE IF EXISTS ipo_underwriters CASCADE;
DROP TABLE IF EXISTS underwriters CASCADE;

-- 2. Recreate Underwriters Table with broker_code as PRIMARY KEY
CREATE TABLE underwriters (
    broker_code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255),
    win_rate DECIMAL(5,2),
    ara_d1 DECIMAL(5,2),
    avg_ara_streak DECIMAL(5,2),
    data_points INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Recreate IPO Underwriters Table
CREATE TABLE ipo_underwriters (
    id SERIAL PRIMARY KEY,
    ipo_id UUID REFERENCES ipos(id) ON DELETE CASCADE,
    broker_code VARCHAR(10) REFERENCES underwriters(broker_code) ON DELETE CASCADE,
    role VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ipo_id, broker_code)
);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
