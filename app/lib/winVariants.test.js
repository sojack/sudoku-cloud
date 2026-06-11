import { describe, it, expect } from 'vitest'
import { winVariant } from './winVariants'

describe('winVariant', () => {
  it('maps each category to its own tier and title', () => {
    expect(winVariant({ category: 'easy', mistakeCount: 1 }).title).toBe('Solved.')
    expect(winVariant({ category: 'medium', mistakeCount: 1 }).title).toBe('Brilliant.')
    expect(winVariant({ category: 'hard', mistakeCount: 1 }).title).toBe('Masterful.')
    expect(winVariant({ category: 'custom', mistakeCount: 1 }).title).toBe('One of a kind.')
  })

  it('falls back to the medium tier for unknown categories', () => {
    const v = winVariant({ category: 'nonsense', mistakeCount: 0 })
    expect(v.tier).toBe('medium')
    expect(v.title).toBe('Brilliant.')
  })

  it('flags a flawless solve and words the summary accordingly', () => {
    const v = winVariant({ category: 'hard', mistakeCount: 0 })
    expect(v.flawless).toBe(true)
    expect(v.summary).toBe('Hard puzzle solved without a single mistake.')
  })

  it('pluralises mistakes in the summary', () => {
    expect(winVariant({ category: 'easy', mistakeCount: 1 }).summary).toBe(
      'Easy puzzle solved with 1 mistake.'
    )
    expect(winVariant({ category: 'easy', mistakeCount: 2 }).summary).toBe(
      'Easy puzzle solved with 2 mistakes.'
    )
  })

  it('omits the streak line below 2 days', () => {
    expect(winVariant({ category: 'easy', mistakeCount: 0 }).streakLine).toBeNull()
    expect(
      winVariant({ category: 'easy', mistakeCount: 0, streak: { current: 1, best: 5 } }).streakLine
    ).toBeNull()
  })

  it('reports a 2+ day streak', () => {
    expect(
      winVariant({ category: 'easy', mistakeCount: 0, streak: { current: 3, best: 7 } }).streakLine
    ).toBe('3-day streak')
  })

  it('scales the confetti with difficulty', () => {
    const easy = winVariant({ category: 'easy', mistakeCount: 0 })
    const hard = winVariant({ category: 'hard', mistakeCount: 0 })
    expect(hard.pieces).toBeGreaterThan(easy.pieces)
  })
})
