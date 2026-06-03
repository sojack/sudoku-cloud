// Persistence for the "hide pencil notes" display preference. Device-local
// (not synced), mirroring the theme preference. The active choice is reflected
// as document.documentElement.dataset.hideNotes ('true' hides the marks).

export const NOTES_HIDDEN_KEY = 'sudoku-cloud:hidenotes'

// Stored value is the string 'true' when notes should be hidden; anything else
// (absent, 'false', junk) means notes are shown.
export function resolveStoredHideNotes(raw) {
  return raw === 'true'
}
