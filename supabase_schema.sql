-- Hapus tabel lama jika ada (hati-hati di production!)
DROP TABLE IF EXISTS decisions;
DROP TABLE IF EXISTS ipo_outcomes;
DROP TABLE IF EXISTS ipo_signals;
DROP TABLE IF EXISTS ipo_insider_risk;
DROP TABLE IF EXISTS ipo_underwriters;
DROP TABLE IF EXISTS underwriters;
DROP TABLE IF EXISTS ipos;

-- 1. Master Tabel IPOs
CREATE TABLE ipos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker VARCHAR(10) UNIQUE NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  sector VARCHAR(100),
  listing_board VARCHAR(50),
  listing_date DATE,
  
  -- Offering Details
  ipo_price DECIMAL,
  offered_shares BIGINT,
  total_shares BIGINT,
  public_float_pct DECIMAL,
  
  -- Warrants
  has_warrant BOOLEAN DEFAULT false,
  warrant_ratio VARCHAR(50),
  
  -- Use of Funds
  pct_working_cap DECIMAL,
  pct_capex DECIMAL,
  pct_debt_payment DECIMAL,
  pct_subsidiaries DECIMAL,
  pct_expansion DECIMAL,
  pct_acquisition DECIMAL,
  
  status VARCHAR(50) DEFAULT 'upcoming', -- upcoming, book_building, offering, listed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Master Tabel Underwriters
CREATE TABLE underwriters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  
  -- Historical Stats (Auto-updated via cron/triggers)
  avg_win_rate DECIMAL DEFAULT 0,
  avg_ara_d1 DECIMAL DEFAULT 0,
  avg_os_ratio DECIMAL DEFAULT 0,
  total_ipos INT DEFAULT 0
);

-- 3. Relasi IPO <-> Underwriters (Many-to-Many)
CREATE TABLE ipo_underwriters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ipo_id UUID REFERENCES ipos(id) ON DELETE CASCADE,
  underwriter_id UUID REFERENCES underwriters(id) ON DELETE CASCADE,
  is_lead BOOLEAN DEFAULT false,
  allocation_pct DECIMAL,
  UNIQUE(ipo_id, underwriter_id)
);

-- 4. Insider Risk Analysis (Manual Input dari Prospektus)
CREATE TABLE ipo_insider_risk (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ipo_id UUID REFERENCES ipos(id) ON DELETE CASCADE UNIQUE,
  
  -- Lock-up Details
  has_lock_up BOOLEAN DEFAULT true,
  lock_up_period_months INT,
  lock_up_exemptions TEXT,
  
  -- Pre-IPO Investors
  pre_ipo_investors_exist BOOLEAN DEFAULT false,
  pre_ipo_entry_price DECIMAL,
  
  -- Notes & Assessment
  risk_score INT, -- 1-10
  risk_level VARCHAR(20), -- Low, Moderate, High, Extreme
  analysis_notes TEXT,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Momentum Signals (Auto-Scraped & Manual)
CREATE TABLE ipo_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ipo_id UUID REFERENCES ipos(id) ON DELETE CASCADE UNIQUE,
  
  -- Scraped Data
  os_ratio DECIMAL, -- Oversubscription Ratio dari NLI
  community_sentiment VARCHAR(20), -- Positif, Netral, Negatif (dari forum/socmed)
  gray_market_premium DECIMAL,
  
  -- Derived Metrics
  ara_probability DECIMAL,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Post-Listing Outcomes (Auto-Fetch dari TradingView/API)
CREATE TABLE ipo_outcomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ipo_id UUID REFERENCES ipos(id) ON DELETE CASCADE UNIQUE,
  
  d1_close_price DECIMAL,
  d1_return_pct DECIMAL,
  d1_hit_ara BOOLEAN,
  d1_hit_arb BOOLEAN,
  
  d5_return_pct DECIMAL,
  d30_return_pct DECIMAL,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Decision Log
CREATE TABLE decisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ipo_id UUID REFERENCES ipos(id) ON DELETE CASCADE,
  
  decision_type VARCHAR(20), -- SKIP, ALLOCATE_SMALL, ALLOCATE_MED, ALLOCATE_MAX
  planned_exit VARCHAR(50), -- D+1 Open, D+1 Close, Hold until ARA break
  rationale TEXT,
  
  -- Post-trade evaluation
  actual_pnl DECIMAL,
  lessons_learned TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
