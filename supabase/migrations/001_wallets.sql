-- Arena 151 — Wallet Migration
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- This adds Solana custodial wallet columns and creates the transactions table.

-- Add wallet columns to the profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sol_address TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT;

-- Create transactions table for deposit/withdrawal/win/loss tracking
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'win', 'loss', 'fee'
  amount_sol NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
  tx_signature TEXT, -- Solana transaction signature
  from_address TEXT,
  to_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own transactions
CREATE POLICY "Users can read own transactions"
  ON public.transactions
  FOR SELECT
  USING (auth.uid() = user_id);
