-- Smart Playlist Builder schema (run once in Supabase: SQL Editor → paste → Run)
-- Safe to re-run: drops policies first, uses IF NOT EXISTS for tables.

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Playlists
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My Playlist',
  updated_at timestamptz not null default now()
);

create index if not exists playlists_user_id_idx on public.playlists (user_id);

alter table public.playlists enable row level security;

drop policy if exists "playlists_select_own" on public.playlists;
create policy "playlists_select_own"
  on public.playlists for select
  using (auth.uid() = user_id);

drop policy if exists "playlists_insert_own" on public.playlists;
create policy "playlists_insert_own"
  on public.playlists for insert
  with check (auth.uid() = user_id);

drop policy if exists "playlists_update_own" on public.playlists;
create policy "playlists_update_own"
  on public.playlists for update
  using (auth.uid() = user_id);

drop policy if exists "playlists_delete_own" on public.playlists;
create policy "playlists_delete_own"
  on public.playlists for delete
  using (auth.uid() = user_id);

-- Tracks in a playlist
create table if not exists public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  position int not null,
  spotify_track_id text not null,
  title text not null,
  artists jsonb not null default '[]'::jsonb,
  album text,
  image_url text,
  duration_ms int,
  release_date text,
  preview_url text,
  genius_song_id text,
  genius_description text,
  genius_url text,
  genius_annotations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (playlist_id, spotify_track_id)
);

create index if not exists playlist_tracks_playlist_position_idx
  on public.playlist_tracks (playlist_id, position);

alter table public.playlist_tracks enable row level security;

drop policy if exists "playlist_tracks_select_via_playlist" on public.playlist_tracks;
create policy "playlist_tracks_select_via_playlist"
  on public.playlist_tracks for select
  using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "playlist_tracks_insert_via_playlist" on public.playlist_tracks;
create policy "playlist_tracks_insert_via_playlist"
  on public.playlist_tracks for insert
  with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "playlist_tracks_update_via_playlist" on public.playlist_tracks;
create policy "playlist_tracks_update_via_playlist"
  on public.playlist_tracks for update
  using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "playlist_tracks_delete_via_playlist" on public.playlist_tracks;
create policy "playlist_tracks_delete_via_playlist"
  on public.playlist_tracks for delete
  using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.user_id = auth.uid()
    )
  );

-- New user → profile row (runs as definer; bypasses RLS on insert)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'username'), ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
