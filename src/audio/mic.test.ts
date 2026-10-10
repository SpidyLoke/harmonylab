import { describe, expect, it } from 'vitest'
import { toMicError } from './mic'

const err = (name: string, message = '') => Object.assign(new Error(message), { name })

describe('toMicError', () => {
  it('maps standard names', () => {
    expect(toMicError(err('NotAllowedError')).kind).toBe('denied')
    expect(toMicError(err('NotFoundError')).kind).toBe('notFound')
    expect(toMicError(err('NotReadableError')).kind).toBe('busy')
  })

  it('recognises a denial by its message when the name is generic', () => {
    expect(toMicError(err('Error', 'Permission denied by system')).kind).toBe('denied')
  })

  it('keeps the browser detail', () => {
    expect(toMicError(err('NotAllowedError', 'Permission denied')).detail).toBe('NotAllowedError: Permission denied')
  })

  it('falls back to unknown', () => {
    expect(toMicError(err('WeirdError', 'boom')).kind).toBe('unknown')
  })
})
