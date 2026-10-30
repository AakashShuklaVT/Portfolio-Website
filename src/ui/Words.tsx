import type { CSSProperties } from 'react'

/** Splits text into words that slide up out of a mask, one after another. */
export function Words({ text, delay = 0, start = 0 }: { text: string; delay?: number; start?: number }) {
  const words = text.split(' ')
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className="reveal">
            <span style={{ '--i': start + i, '--d': `${delay}ms` } as CSSProperties}>{w}</span>
          </span>
          {i < words.length - 1 && ' '}
        </span>
      ))}
    </>
  )
}

/** Inline style for a staggered fade-up. */
export const stagger = (i: number, delay = 0) => ({ '--i': i, '--d': `${delay}ms` }) as CSSProperties

export const pad2 = (n: number) => String(n).padStart(2, '0')
