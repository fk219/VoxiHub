import { describe, it, expect } from 'vitest'
import { validateAgent, validateUrl, validateFileType, validateFileSize } from '@/utils/validation'
import { Agent } from '@/types'

describe('Validation Utils', () => {
  describe('validateAgent', () => {
    it('should return error for missing agent name', () => {
      const agent: Partial<Agent> = {}
      const errors = validateAgent(agent)
      
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('name')
      expect(errors[0].message).toBe('Agent name is required')
    })

    it('should return error for empty agent name', () => {
      const agent: Partial<Agent> = { name: '   ' }
      const errors = validateAgent(agent)
      
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('name')
      expect(errors[0].message).toBe('Agent name is required')
    })

    it('should return error for agent name too long', () => {
      const agent: Partial<Agent> = { name: 'a'.repeat(101) }
      const errors = validateAgent(agent)
      
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('name')
      expect(errors[0].message).toBe('Agent name must be less than 100 characters')
    })

    it('should return error for description too long', () => {
      const agent: Partial<Agent> = { 
        name: 'Test Agent',
        description: 'a'.repeat(501) 
      }
      const errors = validateAgent(agent)
      
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('description')
      expect(errors[0].message).toBe('Description must be less than 500 characters')
    })

    it('should return error for invalid response time', () => {
      const agent: Partial<Agent> = { 
        name: 'Test Agent',
        settings: { responseTime: 100, maxConversationLength: 50, escalationTriggers: [] }
      }
      const errors = validateAgent(agent)
      
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('settings.responseTime')
      expect(errors[0].message).toBe('Response time must be between 500ms and 10000ms')
    })

    it('should return error for invalid conversation length', () => {
      const agent: Partial<Agent> = { 
        name: 'Test Agent',
        settings: { responseTime: 2000, maxConversationLength: 5, escalationTriggers: [] }
      }
      const errors = validateAgent(agent)
      
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('settings.maxConversationLength')
      expect(errors[0].message).toBe('Max conversation length must be between 10 and 200')
    })

    it('should return error for invalid URLs', () => {
      const agent: Partial<Agent> = { 
        name: 'Test Agent',
        knowledgeBase: {
          documents: [],
          urls: ['invalid-url', 'https://valid.com'],
          faqs: []
        }
      }
      const errors = validateAgent(agent)
      
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('knowledgeBase.urls.0')
      expect(errors[0].message).toBe('Invalid URL: invalid-url')
    })

    it('should return error for empty FAQ questions or answers', () => {
      const agent: Partial<Agent> = { 
        name: 'Test Agent',
        knowledgeBase: {
          documents: [],
          urls: [],
          faqs: [
            { id: '1', question: '', answer: 'Answer' },
            { id: '2', question: 'Question', answer: '' }
          ]
        }
      }
      const errors = validateAgent(agent)
      
      expect(errors).toHaveLength(2)
      expect(errors[0].field).toBe('knowledgeBase.faqs.0.question')
      expect(errors[1].field).toBe('knowledgeBase.faqs.1.answer')
    })

    it('should return no errors for valid agent', () => {
      const agent: Partial<Agent> = { 
        name: 'Test Agent',
        description: 'A test agent',
        personality: {
          tone: 'professional',
          style: 'Helpful',
          instructions: 'Be helpful and professional'
        },
        settings: {
          responseTime: 2000,
          maxConversationLength: 50,
          escalationTriggers: ['help', 'human']
        },
        knowledgeBase: {
          documents: [],
          urls: ['https://example.com'],
          faqs: [
            { id: '1', question: 'What is this?', answer: 'This is a test' }
          ]
        }
      }
      const errors = validateAgent(agent)
      
      expect(errors).toHaveLength(0)
    })
  })

  describe('validateUrl', () => {
    it('should return true for valid URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true)
      expect(validateUrl('http://test.org')).toBe(true)
      expect(validateUrl('https://subdomain.example.com/path')).toBe(true)
    })

    it('should return false for invalid URLs', () => {
      expect(validateUrl('invalid-url')).toBe(false)
      expect(validateUrl('not a url')).toBe(false)
      expect(validateUrl('')).toBe(false)
    })
  })

  describe('validateFileType', () => {
    it('should return true for accepted file types', () => {
      expect(validateFileType('document.pdf', ['.pdf', '.txt'])).toBe(true)
      expect(validateFileType('text.txt', ['.pdf', '.txt'])).toBe(true)
    })

    it('should return false for non-accepted file types', () => {
      expect(validateFileType('image.jpg', ['.pdf', '.txt'])).toBe(false)
      expect(validateFileType('script.exe', ['.pdf', '.txt'])).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(validateFileType('document.PDF', ['.pdf', '.txt'])).toBe(true)
      expect(validateFileType('text.TXT', ['.pdf', '.txt'])).toBe(true)
    })
  })

  describe('validateFileSize', () => {
    it('should return true for files within size limit', () => {
      expect(validateFileSize(1024, 1)).toBe(true) // 1KB file, 1MB limit
      expect(validateFileSize(1024 * 1024, 1)).toBe(true) // 1MB file, 1MB limit
    })

    it('should return false for files exceeding size limit', () => {
      expect(validateFileSize(2 * 1024 * 1024, 1)).toBe(false) // 2MB file, 1MB limit
      expect(validateFileSize(1024 * 1024 + 1, 1)).toBe(false) // 1MB + 1 byte file, 1MB limit
    })
  })
})