-- Segment 1: Database Schema for RFQ Platform

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    trader_initials TEXT CHECK (char_length(trader_initials) BETWEEN 2 AND 3),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and update their own profile" 
ON public.profiles 
FOR ALL 
USING (auth.uid() = user_id);

-- 2. Live Sheet Rows Table
CREATE TABLE IF NOT EXISTS public.live_sheet_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    row_num INTEGER NOT NULL,
    col_a TEXT,
    col_b TEXT,
    col_c TEXT,
    col_d TEXT,
    col_e TEXT,
    col_f TEXT,
    col_g TEXT,
    col_h TEXT,
    col_i TEXT,
    col_j TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on live_sheet_rows
ALTER TABLE public.live_sheet_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own live rows" 
ON public.live_sheet_rows 
FOR ALL 
USING (auth.uid() = user_id);

-- 3. Sequences Table for Transaction Numbers
CREATE TABLE IF NOT EXISTS public.sequences (
    month_key TEXT PRIMARY KEY, -- Format: YYYYMM
    last_val INTEGER DEFAULT 99 -- Starts at 100 on first increment
);

-- Enable RLS on sequences (Admin/Service only or specific function access)
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;

-- 4. Atomic Transaction Number Reservation Function
CREATE OR REPLACE FUNCTION public.reserve_transaction_block(row_count INTEGER)
RETURNS INTEGER AS $$
DECLARE
    current_month TEXT;
    start_num INTEGER;
BEGIN
    current_month := to_char(CURRENT_DATE, 'YYYYMM');
    
    -- Lock and increment the sequence row for the current month
    INSERT INTO public.sequences (month_key, last_val)
    VALUES (current_month, 99)
    ON CONFLICT (month_key) DO UPDATE
    SET last_val = sequences.last_val + row_count
    RETURNING (last_val - row_count + 1) INTO start_num;
    
    -- Note: This uses the month_key as a partition to ensure numbers reset monthly.
    -- The SELECT FOR UPDATE is implicit in the UPSERT/UPDATE statement on a single row.
    
    RETURN start_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
