-- One row per user. savegame/stats mirror the localStorage payloads.
create table if not exists game_state (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  savegame            jsonb,
  stats               jsonb,
  savegame_updated_at timestamptz,
  updated_at          timestamptz default now()
);

alter table game_state enable row level security;

-- A user may only ever touch their own row. This is the security boundary.
create policy "own row select" on game_state
  for select using (user_id = auth.uid());
create policy "own row insert" on game_state
  for insert with check (user_id = auth.uid());
create policy "own row update" on game_state
  for update using (user_id = auth.uid());
