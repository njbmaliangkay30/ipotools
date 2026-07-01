-- Master IPO table
create table if not exists ipos (
  id uuid primary key,
  ticker text unique not null,
  nama text,
  status text,  -- Pre-Effective | Book Building | Offering | Allotment | Closed | Canceled
  sektor text,
  subsektor text,
  lini_bisnis text,
  
  -- Pricing
  harga_ipo integer,
  bb_price_low integer,
  bb_price_high integer,
  
  -- Shares
  jumlah_saham_ditawarkan bigint,
  pct_total_shares numeric,  -- % of total shares = free float proxy
  
  -- Dates
  bb_open date,
  bb_close date,
  offering_open date,
  offering_close date,
  closing_date date,
  distribution_date date,
  listing_date date,
  
  -- Warrant
  warrant_ratio numeric,
  warrant_exercise_price integer,
  
  -- NLI PDF fields (populated after listing)
  listing_board text,         -- Main | Development | Acceleration
  offered_shares_nli bigint,
  subscribed_shares bigint,
  os_ratio_aktual numeric,    -- B12 dari NLI PDF — angka resmi
  public_pct numeric,         -- % saham publik setelah listing
  has_warrant_nli boolean,
  pct_working_cap numeric,
  pct_capex numeric,
  pct_subsidiaries numeric,
  pct_debt_payment numeric,
  pct_expansion numeric,
  pct_acquisition numeric,
  nli_parsed_at timestamptz,  -- kapan NLI PDF berhasil diparsing
  
  -- Metadata
  scraped_at timestamptz,
  created_at timestamptz default now()
);

-- Underwriters master
create table if not exists underwriters (
  id uuid primary key,
  broker_code text unique not null,
  nama text,
  
  -- Computed stats (di-update setiap ada outcome baru)
  total_ipo_lead integer default 0,
  total_ipo_colead integer default 0,
  win_rate numeric,
  ara_d1_rate numeric,
  avg_ara_streak numeric,
  avg_return_d1 numeric,
  avg_return_d5 numeric,
  avg_os_ratio numeric,
  data_points integer default 0,
  updated_at timestamptz
);

-- Relasi IPO <-> UW (diperkaya dari NLI PDF)
create table if not exists ipo_underwriters (
  ipo_id uuid references ipos(id),
  underwriter_id uuid references underwriters(id),
  role text,        -- lead | colead
  pct_penjaminan numeric,  -- % dari NLI PDF (GU1-GU3)
  primary key (ipo_id, underwriter_id)
);

-- Insider risk data (manual input dari prospektus)
create table if not exists ipo_insider_risk (
  ipo_id uuid primary key references ipos(id),
  harga_perolehan_insider integer,
  price_gap_ratio numeric,
  price_gap_low numeric,
  price_gap_high numeric,
  ada_lockup boolean,
  lockup_months integer,
  pct_divestasi numeric,
  penggunaan_dana_kategori text,  -- derived otomatis dari NLI PDF jika tersedia
  penggunaan_dana_raw text,
  insider_risk_level text,        -- computed
  updated_at timestamptz
);

-- Momentum signals
create table if not exists ipo_signals (
  ipo_id uuid primary key references ipos(id),
  google_trends_score numeric,
  news_count_30d integer,
  sektor_momentum_60d numeric,
  community_buzz integer,
  os_estimate numeric,
  os_confidence text,
  queue_estimate_manual integer,
  fetched_at timestamptz
);

-- Post-listing outcomes
create table if not exists ipo_outcomes (
  ipo_id uuid primary key references ipos(id),
  harga_d1 integer,
  harga_d5 integer,
  harga_d7 integer,
  return_d1 numeric,
  return_d5 numeric,
  ara_d1 boolean,
  ara_streak integer,
  lot_aktual integer,
  catatan text,
  fetched_at timestamptz
);

-- Decision log
create table if not exists decisions (
  id uuid primary key,
  ipo_id uuid references ipos(id),
  keputusan text,
  jumlah_akun integer,
  reasoning_notes text,
  created_at timestamptz default now()
);
