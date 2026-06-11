// An undo history is an array of board snapshots, oldest first. These helpers
// are pure: they return new arrays and never mutate their inputs.

// Append a snapshot, returning a new stack.
export function pushHistory(stack, snapshot) {
  return [...stack, snapshot]
}

// Remove and return the most recent snapshot. Returns { snapshot, stack }:
// `snapshot` is null and `stack` is the (empty) input when there is nothing to
// undo.
export function popHistory(stack) {
  if (stack.length === 0) return { snapshot: null, stack }
  return { snapshot: stack[stack.length - 1], stack: stack.slice(0, -1) }
}
