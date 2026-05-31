import { describe, it, expect } from 'vitest'
import { rowOf, colOf, boxOf, peersOf } from './grid'

describe('rowOf', () => {
  it('returns 0 for the first row', () => {
    expect(rowOf(0)).toBe(0)
    expect(rowOf(8)).toBe(0)
  })

  it('returns the correct row for later indices', () => {
    expect(rowOf(9)).toBe(1)
    expect(rowOf(80)).toBe(8)
  })
})

describe('colOf', () => {
  it('returns the column within a row', () => {
    expect(colOf(0)).toBe(0)
    expect(colOf(8)).toBe(8)
    expect(colOf(9)).toBe(0)
    expect(colOf(80)).toBe(8)
  })
})

describe('boxOf', () => {
  it('returns 0 for the top-left box', () => {
    expect(boxOf(0)).toBe(0)
    expect(boxOf(20)).toBe(0) // row 2, col 2
  })

  it('returns 8 for the bottom-right box', () => {
    expect(boxOf(80)).toBe(8) // row 8, col 8
  })

  it('returns the center box index', () => {
    expect(boxOf(40)).toBe(4) // row 4, col 4
  })
})

describe('peersOf', () => {
  it('returns exactly 20 peers', () => {
    expect(peersOf(0)).toHaveLength(20)
  })

  it('does not include the cell itself', () => {
    expect(peersOf(0)).not.toContain(0)
  })

  it('includes every other cell in the same row', () => {
    const peers = peersOf(0)
    for (let i = 1; i <= 8; i++) {
      expect(peers).toContain(i)
    }
  })

  it('includes every other cell in the same column', () => {
    const peers = peersOf(0)
    for (let r = 1; r <= 8; r++) {
      expect(peers).toContain(r * 9)
    }
  })

  it('includes the rest of the same box', () => {
    // cell 0 -> box cells 0,1,2,9,10,11,18,19,20
    const peers = peersOf(0)
    for (const i of [1, 2, 9, 10, 11, 18, 19, 20]) {
      expect(peers).toContain(i)
    }
  })

  it('returns unique indices', () => {
    const peers = peersOf(40)
    expect(new Set(peers).size).toBe(peers.length)
  })
})
