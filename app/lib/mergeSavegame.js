// The savegame is a single in-progress snapshot, so the most recently saved
// side wins. A missing savedAt sorts oldest; a null savegame loses to any save.
export function mergeSavegame(a, b) {
  if (!a) return b
  if (!b) return a
  return (b.savedAt ?? 0) > (a.savedAt ?? 0) ? b : a
}
