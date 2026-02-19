-- Supabase migrations: create reviews table and RLS policies
-- Run this in the Supabase SQL editor or via psql connected to your project's DB.

-- Enable pgcrypto for gen_random_uuid
create extension if not exists "pgcrypto";

-- Create reviews table
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  anime_id text not null,
  anime_title text,
  user_id uuid,
  categories jsonb not null default '{}'::jsonb,
  overall_score numeric,
  review_text text,
  created_at timestamptz not null default now()
);

-- Index for faster lookups by anime
create index if not exists idx_reviews_anime_id on public.reviews(anime_id);

-- Enable Row Level Security and policies so each user can only access their own reviews
alter table public.reviews enable row level security;

-- Allow authenticated users to insert rows where user_id equals their auth.uid()
create policy "Insert own reviews" on public.reviews
  for insert
  with check (auth.uid() = user_id);

-- Allow authenticated users to select rows that belong to them
create policy "Select own reviews" on public.reviews
  for select
  using (user_id = auth.uid());

-- Allow authenticated users to update/delete rows that belong to them
create policy "Update own reviews" on public.reviews
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Delete own reviews" on public.reviews
  for delete
  using (user_id = auth.uid());

-- Note: service_role key bypasses RLS. When running server-side migrations, you can use the service_role key.

-- Create personal_lists table to store user's saved animes
create table if not exists public.personal_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  anime_id text not null,
  anime_title text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_personal_lists_user on public.personal_lists(user_id);

alter table public.personal_lists enable row level security;

create policy "Insert own list" on public.personal_lists
  for insert
  with check (auth.uid() = user_id);

create policy "Select own list" on public.personal_lists
  for select
  using (user_id = auth.uid());

create policy "Delete own list" on public.personal_lists
  for delete
  using (user_id = auth.uid());
