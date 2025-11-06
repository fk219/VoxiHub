import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DocumentUploader from '@/components/DocumentUploader'
import { Document } from '@/types'

const mockDocuments: Document[] = [
  {
    id: '1',
    name: 'test.pdf',
    type: 'application/pdf',
    url: 'blob:test-url',
    size: 1024,
    uploadedAt: '2023-01-01T00:00:00Z'
  }
]

const mockOnDocumentsChange = vi.fn()

describe('DocumentUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render upload area', () => {
    render(
      <DocumentUploader 
        documents={[]} 
        onDocumentsChange={mockOnDocumentsChange} 
      />
    )
    
    expect(screen.getByText('Drag and drop files here, or')).toBeInTheDocument()
    expect(screen.getByText('browse')).toBeInTheDocument()
    expect(screen.getByText('Supported formats: .pdf, .txt, .doc, .docx, .md (max 10MB each)')).toBeInTheDocument()
  })

  it('should display uploaded documents', () => {
    render(
      <DocumentUploader 
        documents={mockDocuments} 
        onDocumentsChange={mockOnDocumentsChange} 
      />
    )
    
    expect(screen.getByText('Uploaded Documents')).toBeInTheDocument()
    expect(screen.getByText('test.pdf')).toBeInTheDocument()
    expect(screen.getByText('1 KB • Uploaded 1/1/2023')).toBeInTheDocument()
  })

  it('should handle file removal', () => {
    render(
      <DocumentUploader 
        documents={mockDocuments} 
        onDocumentsChange={mockOnDocumentsChange} 
      />
    )
    
    const removeButton = screen.getByTitle('Remove document')
    fireEvent.click(removeButton)
    
    expect(mockOnDocumentsChange).toHaveBeenCalledWith([])
  })

  it('should show drag active state', () => {
    render(
      <DocumentUploader 
        documents={[]} 
        onDocumentsChange={mockOnDocumentsChange} 
      />
    )
    
    const dropArea = screen.getByText('Drag and drop files here, or').closest('div')
    
    fireEvent.dragEnter(dropArea!)
    
    expect(dropArea).toHaveClass('border-blue-500', 'bg-blue-50')
  })

  it('should handle file drop', async () => {
    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    
    render(
      <DocumentUploader 
        documents={[]} 
        onDocumentsChange={mockOnDocumentsChange} 
      />
    )
    
    const dropArea = screen.getByText('Drag and drop files here, or').closest('div')
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    
    fireEvent.drop(dropArea!, {
      dataTransfer: {
        files: [file]
      }
    })
    
    // Should show uploading state
    expect(screen.getByText('Uploading files...')).toBeInTheDocument()
    
    // Should call onDocumentsChange after upload
    await waitFor(() => {
      expect(mockOnDocumentsChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'test.pdf',
            type: 'application/pdf',
            size: 12
          })
        ])
      )
    })
  })

  it('should validate file size', async () => {
    render(
      <DocumentUploader 
        documents={[]} 
        onDocumentsChange={mockOnDocumentsChange}
        maxFileSize={1} // 1MB limit
      />
    )
    
    const dropArea = screen.getByText('Drag and drop files here, or').closest('div')
    const largeFile = new File(['x'.repeat(2 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' })
    
    fireEvent.drop(dropArea!, {
      dataTransfer: {
        files: [largeFile]
      }
    })
    
    await waitFor(() => {
      expect(screen.getByText(/File too large/)).toBeInTheDocument()
    })
  })

  it('should validate file type', async () => {
    render(
      <DocumentUploader 
        documents={[]} 
        onDocumentsChange={mockOnDocumentsChange}
        acceptedTypes={['.pdf']}
      />
    )
    
    const dropArea = screen.getByText('Drag and drop files here, or').closest('div')
    const invalidFile = new File(['test'], 'test.exe', { type: 'application/exe' })
    
    fireEvent.drop(dropArea!, {
      dataTransfer: {
        files: [invalidFile]
      }
    })
    
    await waitFor(() => {
      expect(screen.getByText(/Unsupported file type/)).toBeInTheDocument()
    })
  })

  it('should enforce maximum file limit', async () => {
    render(
      <DocumentUploader 
        documents={mockDocuments} 
        onDocumentsChange={mockOnDocumentsChange}
        maxFiles={1}
      />
    )
    
    const dropArea = screen.getByText('Drag and drop files here, or').closest('div')
    const file = new File(['test'], 'test2.pdf', { type: 'application/pdf' })
    
    fireEvent.drop(dropArea!, {
      dataTransfer: {
        files: [file]
      }
    })
    
    await waitFor(() => {
      expect(screen.getByText(/Maximum 1 files allowed/)).toBeInTheDocument()
    })
  })

  it('should format file sizes correctly', () => {
    const documents: Document[] = [
      { ...mockDocuments[0], size: 1024, name: '1kb.pdf' },
      { ...mockDocuments[0], id: '2', size: 1024 * 1024, name: '1mb.pdf' },
      { ...mockDocuments[0], id: '3', size: 1024 * 1024 * 1024, name: '1gb.pdf' }
    ]
    
    render(
      <DocumentUploader 
        documents={documents} 
        onDocumentsChange={mockOnDocumentsChange} 
      />
    )
    
    expect(screen.getByText(/1 KB/)).toBeInTheDocument()
    expect(screen.getByText(/1 MB/)).toBeInTheDocument()
    expect(screen.getByText(/1 GB/)).toBeInTheDocument()
  })
})