import { mergeStats } from './mergeStats'
import { mergeSavegame } from './mergeSavegame'

const TABLE = 'game_state'

// Read the caller's row. Returns null when no row exists yet.
export async function pullRemote(client, userId) {
  const { data, error } = await client
    .from(TABLE)
    .select('savegame, stats')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

// Upsert the caller's row. savegame_updated_at mirrors the savegame's savedAt
// for observability; the merge itself reads the embedded savedAt.
export async function pushRemote(client, userId, { savegame, stats }) {
  const { error } = await client.from(TABLE).upsert({
    user_id: userId,
    savegame,
    stats,
    savegame_updated_at: savegame?.savedAt ? new Date(savegame.savedAt).toISOString() : null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

// Pull remote, merge with local, push the merged result, and return it so the
// caller can update the local cache and UI. Used on sign-in and app load.
export async function syncState(client, userId, local) {
  const remote = await pullRemote(client, userId)
  const merged = {
    savegame: mergeSavegame(local.savegame ?? null, remote?.savegame ?? null),
    stats: mergeStats(local.stats ?? null, remote?.stats ?? null),
  }
  await pushRemote(client, userId, merged)
  return merged
}
