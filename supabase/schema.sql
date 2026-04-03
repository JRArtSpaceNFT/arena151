-- Arena 151 Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run

-- Create the profiles table linked to Supabase Auth users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  favorite_pokemon_id INTEGER DEFAULT 25,
  favorite_pokemon_name TEXT DEFAULT 'Pikachu',
  favorite_pokemon_types TEXT[] DEFAULT ARRAY['electric'],
  internal_wallet_id TEXT UNIQUE NOT NULL,
  balance NUMERIC DEFAULT 0,
  earnings NUMERIC DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  badges TEXT[] DEFAULT ARRAY[]::TEXT[],
  joined_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  sol_address TEXT UNIQUE,
  encrypted_private_key TEXT
);

-- Transactions table for deposit/withdrawal/win/loss tracking
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'win', 'loss', 'fee'
  amount_sol NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
  tx_signature TEXT,
  from_address TEXT,
  to_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
  ON public.transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (needed during signup)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow service role full access (used by server-side admin client)
-- Service role bypasses RLS by default, so no explicit policy needed.

-- Allow leaderboard: anyone authenticated can read all profiles (public leaderboard)
CREATE POLICY "Authenticated users can read all profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');
