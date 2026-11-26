-- Optional production persistence. Enable PostGIS in your Supabase project first.
create extension if not exists postgis;

create table if not exists public.cafes (
  id text primary key,
  name text not null,
  address text,
  location geography(point, 4326) not null,
  category text,
  subtype text,
  phone text,
  website text,
  opening_hours text,
  source text not null,
  source_id text,
  source_url text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source, source_id)
);
create index if not exists cafes_location_gix on public.cafes using gist(location);
create index if not exists cafes_name_idx on public.cafes using gin(to_tsvector('simple', name));

create table if not exists public.favourites (
  user_id uuid not null references auth.users(id) on delete cascade,
  cafe_id text not null references public.cafes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, cafe_id)
);

create or replace function public.cafes_in_bounds(
  min_lon double precision, min_lat double precision,
  max_lon double precision, max_lat double precision
) returns setof public.cafes language sql stable as $$
  select * from public.cafes
  where location && ST_MakeEnvelope(min_lon,min_lat,max_lon,max_lat,4326)::geography;
$$;
