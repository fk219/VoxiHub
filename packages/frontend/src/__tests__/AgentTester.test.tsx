import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AgentTester from '@/components/AgentTester'
import { Agent } from '@/types'

const mockAgent: Partial<Agent> = {
  name: 'Test Agent',
  personality: {
    tone: 'professional',
    style: 'Helpful and concise',
    instructions: 'Be professional and helpful'
  }
}

const mockOnClose = vi.fn()

describe('AgentTester', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render agent tester modal', () => {
    render(<AgentTester agent={mockAgent} onClose={mockOnClose} />)
    
    expect(screen.getByText('Testing: Test Agent')).toBeInTheDocument()
    expect(screen.getByText('Tone: professional | Style: Helpful and concise')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument()
  })

  it('should display initial greeting message', () => {
    render(<AgentTester agent={mockAgent} onClose={mockOnClose} />)
    
    expect(screen.getByText("Hello! I'm Test Agent. How can I help you today?")).toBeInTheDocument()
  })

  it('should allow sending messages', async () => {
    render(<AgentTester agent={mockAgent} onClose={mockOnClose} />)
    
    const messageInput = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByRole('button', { name: /send/i })
    
    fireEvent.change(messageInput, { target: { value: 'Hello agent' } })
    fireEvent.click(sendButton)
    
    expect(screen.getByText('Hello agent')).toBeInTheDocument()
    
    // Should show typing indicator
    await waitFor(() => {
      expect(screen.getByText('Agent is typing...')).toBeInTheDocument()
    })
    
    // Should show agent response after delay
    await waitFor(() => {
      expect(screen.getByText(/Thank you for your inquiry/)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should handle voice recording toggle', () => {
    render(<AgentTester agent={mockAgent} onClose={mockOnClose} />)
    
    const micButton = screen.getByTitle('Start voice input')
    fireEvent.click(micButton)
    
    expect(screen.getByTitle('Stop recording')).toBeInTheDocument()
  })

  it('should handle voice output toggle', () => {
    render(<AgentTester agent={mockAgent} onClose={mockOnClose} />)
    
    const speakerButton = screen.getByTitle('Enable voice output')
    fireEvent.click(speakerButton)
    
    expect(screen.getByTitle('Disable voice output')).toBeInTheDocument()
  })

  it('should close modal when close button is clicked', () => {
    render(<AgentTester agent={mockAgent} onClose={mockOnClose} />)
    
    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should send message on Enter key press', () => {
    render(<AgentTester agent={mockAgent} onClose={mockOnClose} />)
    
    const messageInput = screen.getByPlaceholderText('Type your message...')
    
    fireEvent.change(messageInput, { target: { value: 'Test message' } })
    fireEvent.keyPress(messageInput, { key: 'Enter', code: 'Enter' })
    
    expect(screen.getByText('Test message')).toBeInTheDocument()
  })

  it('should generate different responses based on agent tone', async () => {
    const friendlyAgent: Partial<Agent> = {
      ...mockAgent,
      personality: {
        tone: 'friendly',
        style: 'Warm and welcoming',
        instructions: 'Be friendly and enthusiastic'
      }
    }
    
    render(<AgentTester agent={friendlyAgent} onClose={mockOnClose} />)
    
    const messageInput = screen.getByPlaceholderText('Type your message...')
    const sendButton = screen.getByRole('button', { name: /send/i })
    
    fireEvent.change(messageInput, { target: { value: 'Hello' } })
    fireEvent.click(sendButton)
    
    // Should show friendly response after delay
    await waitFor(() => {
      expect(screen.getByText(/Great question!/)).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})