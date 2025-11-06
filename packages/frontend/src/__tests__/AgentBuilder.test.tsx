import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import AgentBuilder from '@/pages/AgentBuilder'
import { AppProvider } from '@/contexts/AppContext'
import { apiClient } from '@/lib/api'

// Mock the API client
vi.mock('@/lib/api', () => ({
  apiClient: {
    getAgent: vi.fn(),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
  }
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  }
}))

// Mock useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: vi.fn(() => ({})),
    useNavigate: vi.fn(() => vi.fn()),
  }
})

const renderAgentBuilder = () => {
  return render(
    <BrowserRouter>
      <AppProvider>
        <AgentBuilder />
      </AppProvider>
    </BrowserRouter>
  )
}

describe('AgentBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render agent creation form', () => {
    renderAgentBuilder()
    
    expect(screen.getByText('Create New Agent')).toBeInTheDocument()
    expect(screen.getByLabelText(/Agent Name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
    expect(screen.getByText('Save Agent')).toBeInTheDocument()
  })

  it('should render personality configuration section', () => {
    renderAgentBuilder()
    
    expect(screen.getByText('Personality & Tone')).toBeInTheDocument()
    expect(screen.getByLabelText(/Tone/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Communication Style/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Special Instructions/)).toBeInTheDocument()
  })

  it('should render knowledge base section', () => {
    renderAgentBuilder()
    
    expect(screen.getByText('Knowledge Base')).toBeInTheDocument()
    expect(screen.getByText('Documents')).toBeInTheDocument()
    expect(screen.getByText('Website URLs')).toBeInTheDocument()
    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument()
  })

  it('should render settings section', () => {
    renderAgentBuilder()
    
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByLabelText(/Response Time/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Max Conversation Length/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Escalation Triggers/)).toBeInTheDocument()
  })

  it('should allow adding URLs to knowledge base', async () => {
    renderAgentBuilder()
    
    const urlInput = screen.getByPlaceholderText('https://example.com/help')
    const addButton = urlInput.nextElementSibling
    
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } })
    fireEvent.click(addButton!)
    
    await waitFor(() => {
      expect(screen.getByText('https://example.com')).toBeInTheDocument()
    })
  })

  it('should allow adding FAQs to knowledge base', async () => {
    renderAgentBuilder()
    
    const questionInput = screen.getByPlaceholderText('Question')
    const answerInput = screen.getByPlaceholderText('Answer')
    const addFaqButton = screen.getByText('Add FAQ')
    
    fireEvent.change(questionInput, { target: { value: 'What is this?' } })
    fireEvent.change(answerInput, { target: { value: 'This is a test.' } })
    fireEvent.click(addFaqButton)
    
    await waitFor(() => {
      expect(screen.getByText('What is this?')).toBeInTheDocument()
      expect(screen.getByText('This is a test.')).toBeInTheDocument()
    })
  })

  it('should show preview panel when preview button is clicked', async () => {
    renderAgentBuilder()
    
    const previewButton = screen.getByText('Preview')
    fireEvent.click(previewButton)
    
    await waitFor(() => {
      expect(screen.getByText('Agent Preview')).toBeInTheDocument()
      expect(screen.getByText('Test Agent')).toBeInTheDocument()
    })
  })

  it('should validate required fields before saving', async () => {
    renderAgentBuilder()
    
    const saveButton = screen.getByText('Save Agent')
    fireEvent.click(saveButton)
    
    // Should show error for missing agent name
    await waitFor(() => {
      expect(vi.mocked(require('react-hot-toast').default.error)).toHaveBeenCalledWith('Agent name is required')
    })
  })

  it('should call createAgent API when saving new agent', async () => {
    const mockAgent = {
      id: '1',
      name: 'Test Agent',
      description: 'Test Description',
      personality: { tone: 'professional', style: '', instructions: '' },
      knowledgeBase: { documents: [], urls: [], faqs: [] },
      settings: { responseTime: 2000, maxConversationLength: 50, escalationTriggers: [] },
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01'
    }
    
    vi.mocked(apiClient.createAgent).mockResolvedValue(mockAgent)
    
    renderAgentBuilder()
    
    const nameInput = screen.getByLabelText(/Agent Name/)
    const saveButton = screen.getByText('Save Agent')
    
    fireEvent.change(nameInput, { target: { value: 'Test Agent' } })
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(apiClient.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Agent'
        })
      )
    })
  })
})