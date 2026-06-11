import { describe, it, expect } from 'vitest'
import { pushHistory, popHistory } from './history'

describe('pushHistory', () => {
  it('appends a snapshot, returning a new array without mutating the input', () => {
    const a = []
    const b = pushHistory(a, 'x')
    expect(b).toEqual(['x'])
    expect(a).toEqual([])
    expect(b).not.toBe(a)
  })
  it('appends to the end, preserving order', () => {
    expect(pushHistory(['x'], 'y')).toEqual(['x', 'y'])
  })
})

describe('popHistory', () => {
  it('returns the most recent snapshot and the shortened stack', () => {
    const { snapshot, stack } = popHistory(['x', 'y'])
    expect(snapshot).toBe('y')
    expect(stack).toEqual(['x'])
  })
  it('does not mutate the input stack', () => {
    const a = ['x', 'y']
    popHistory(a)
    expect(a).toEqual(['x', 'y'])
  })
  it('returns a null snapshot and an empty stack when there is nothing to undo', () => {
    const { snapshot, stack } = popHistory([])
    expect(snapshot).toBe(null)
    expect(stack).toEqual([])
  })
})
