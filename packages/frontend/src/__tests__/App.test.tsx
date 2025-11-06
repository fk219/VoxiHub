import { describe, it, expect } from 'vitest'
import { testSetup } from '@/utils/test-setup'

describe('React Application Setup', () => {
  it('should have React app configured', () => {
    expect(testSetup.isReactAppConfigured).toBe(true)
  })

  it('should have TypeScript configured', () => {
    expect(testSetup.hasTypeScript).toBe(true)
  })

  it('should have routing configured', () => {
    expect(testSetup.hasRouting).toBe(true)
  })

  it('should have state management configured', () => {
    expect(testSetup.hasStateManagement).toBe(true)
  })

  it('should have ESLint configured', () => {
    expect(testSetup.hasESLint).toBe(true)
  })

  it('should have Prettier configured', () => {
    expect(testSetup.hasPrettier).toBe(true)
  })
})