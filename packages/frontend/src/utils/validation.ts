import { Agent } from '@/types'

export interface ValidationError {
  field: string
  message: string
}

export const validateAgent = (agent: Partial<Agent>): ValidationError[] => {
  const errors: ValidationError[] = []

  // Required fields
  if (!agent.name?.trim()) {
    errors.push({ field: 'name', message: 'Agent name is required' })
  }

  if (agent.name && agent.name.length > 100) {
    errors.push({ field: 'name', message: 'Agent name must be less than 100 characters' })
  }

  if (agent.description && agent.description.length > 500) {
    errors.push({ field: 'description', message: 'Description must be less than 500 characters' })
  }

  // Personality validation
  if (agent.personality?.instructions && agent.personality.instructions.length > 1000) {
    errors.push({ field: 'personality.instructions', message: 'Instructions must be less than 1000 characters' })
  }

  // Settings validation
  if (agent.settings?.responseTime && (agent.settings.responseTime < 500 || agent.settings.responseTime > 10000)) {
    errors.push({ field: 'settings.responseTime', message: 'Response time must be between 500ms and 10000ms' })
  }

  if (agent.settings?.maxConversationLength && (agent.settings.maxConversationLength < 10 || agent.settings.maxConversationLength > 200)) {
    errors.push({ field: 'settings.maxConversationLength', message: 'Max conversation length must be between 10 and 200' })
  }

  // Knowledge base validation
  if (agent.knowledgeBase?.urls) {
    agent.knowledgeBase.urls.forEach((url, index) => {
      try {
        new URL(url)
      } catch {
        errors.push({ field: `knowledgeBase.urls.${index}`, message: `Invalid URL: ${url}` })
      }
    })
  }

  if (agent.knowledgeBase?.faqs) {
    agent.knowledgeBase.faqs.forEach((faq, index) => {
      if (!faq.question.trim()) {
        errors.push({ field: `knowledgeBase.faqs.${index}.question`, message: 'FAQ question is required' })
      }
      if (!faq.answer.trim()) {
        errors.push({ field: `knowledgeBase.faqs.${index}.answer`, message: 'FAQ answer is required' })
      }
    })
  }

  return errors
}

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export const validateFileType = (fileName: string, acceptedTypes: string[]): boolean => {
  const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase()
  return acceptedTypes.includes(fileExtension)
}

export const validateFileSize = (fileSize: number, maxSizeMB: number): boolean => {
  return fileSize <= maxSizeMB * 1024 * 1024
}