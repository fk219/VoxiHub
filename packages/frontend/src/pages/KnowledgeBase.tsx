import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdAdd,
  MdSearch,
  MdUpload,
  MdLanguage,
  MdDelete,
  MdLink,
  MdDescription,
  MdMoreVert,
  MdRefresh,
  MdCheckCircle,
  MdError,
  MdHourglassEmpty,
  MdTextFields
} from 'react-icons/md';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  type: 'document' | 'website' | 'manual';
  status: 'processing' | 'ready' | 'error';
  document_count?: number;
  created_at: string;
  updated_at: string;
}

const KnowledgeBase: React.FC = () => {
  const navigate = useNavigate();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<'method' | 'details'>('method');
  const [selectedMethod, setSelectedMethod] = useState<'upload' | 'scrape' | 'text' | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showScrapeModal, setShowScrapeModal] = useState(false);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({
    name: '',
    description: ''
  });

  // Upload form
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  // Scrape form
  const [scrapeForm, setScrapeForm] = useState({
    url: '',
    maxPages: 10
  });

  // Text form
  const [textContent, setTextContent] = useState('');

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  const loadKnowledgeBases = async () => {
    try {
      const response = await apiClient.get('/api/knowledge-bases');
      setKnowledgeBases((response as KnowledgeBase[]) || []);
    } catch (error) {
      console.log('Knowledge bases: Feature coming soon');
      setKnowledgeBases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWithContent = async () => {
    if (!createForm.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      const kbType = selectedMethod === 'upload' ? 'document' : selectedMethod === 'scrape' ? 'website' : 'manual';
      const response = await apiClient.post('/api/knowledge-bases', {
        ...createForm,
        type: kbType
      }) as KnowledgeBase;

      if (selectedMethod === 'upload' && uploadFiles.length > 0) {
        const formData = new FormData();
        uploadFiles.forEach(file => formData.append('files', file));
        await apiClient.post(`/api/knowledge-bases/${response.id}/upload`, formData);
        toast.success(`Knowledge base created with ${uploadFiles.length} document(s)`);
      } else if (selectedMethod === 'scrape' && scrapeForm.url) {
        await apiClient.post(`/api/knowledge-bases/${response.id}/scrape`, scrapeForm);
        toast.success('Knowledge base created, scraping started');
      } else if (selectedMethod === 'text' && textContent.trim()) {
        const blob = new Blob([textContent], { type: 'text/plain' });
        const file = new File([blob], 'manual-content.txt', { type: 'text/plain' });
        const formData = new FormData();
        formData.append('files', file);
        await apiClient.post(`/api/knowledge-bases/${response.id}/upload`, formData);
        toast.success('Knowledge base created with text content');
      } else {
        toast.success('Knowledge base created');
      }

      setKnowledgeBases([response, ...knowledgeBases]);
      resetCreateModal();
      loadKnowledgeBases();
    } catch (error) {
      console.error('Failed to create knowledge base:', error);
      toast.error('Failed to create knowledge base');
    }
  };

  const resetCreateModal = () => {
    setShowCreateModal(false);
    setCreateStep('method');
    setSelectedMethod(null);
    setCreateForm({ name: '', description: '' });
    setUploadFiles([]);
    setScrapeForm({ url: '', maxPages: 10 });
    setTextContent('');
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0 || !selectedKB) {
      toast.error('Please select at least one file');
      return;
    }

    const formData = new FormData();
    uploadFiles.forEach(file => formData.append('files', file));

    try {
      const response = await apiClient.post(`/api/knowledge-bases/${selectedKB.id}/upload`, formData) as { uploaded: number };
      setShowUploadModal(false);
      setUploadFiles([]);
      toast.success(`${response.uploaded || uploadFiles.length} document(s) uploaded successfully`);
      loadKnowledgeBases();
    } catch (error) {
      console.error('Failed to upload documents:', error);
      toast.error('Failed to upload documents');
    }
  };

  const handleScrape = async () => {
    if (!scrapeForm.url.trim() || !selectedKB) {
      toast.error('URL is required');
      return;
    }

    try {
      await apiClient.post(`/api/knowledge-bases/${selectedKB.id}/scrape`, scrapeForm);
      setShowScrapeModal(false);
      setScrapeForm({ url: '', maxPages: 10 });
      toast.success('Website scraping started');
      loadKnowledgeBases();
    } catch (error) {
      console.error('Failed to start scraping:', error);
      toast.error('Failed to start scraping');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;

    try {
      await apiClient.delete(`/api/knowledge-bases/${id}`);
      setKnowledgeBases(knowledgeBases.filter(kb => kb.id !== id));
      toast.success('Knowledge base deleted');
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete knowledge base');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <MdCheckCircle style={{ color: '#84cc16' }} />;
      case 'processing': return <MdHourglassEmpty style={{ color: '#f59e0b' }} />;
      case 'error': return <MdError style={{ color: '#ef4444' }} />;
      default: return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document': return <MdDescription />;
      case 'website': return <MdLanguage />;
      default: return <MdDescription />;
    }
  };

  const filteredKBs = knowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kb.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">Knowledge Base</h2>
            <p className="card-subtitle">Manage documents and data sources for your agents</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={loadKnowledgeBases} className="btn btn-secondary">
              <MdRefresh size={20} />
              <span>Refresh</span>
            </button>
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
              <MdAdd size={20} />
              <span>Create Knowledge Base</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <MdSearch
              size={20}
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b'
              }}
            />
            <input
              type="text"
              placeholder="Search knowledge bases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px 12px 48px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 300
              }}
            />
          </div>
        </div>
      </div>

      {/* Knowledge Bases Grid */}
      {filteredKBs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
          <MdDescription size={64} style={{ margin: '0 auto 24px', color: '#cbd5e1' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
            {searchQuery ? 'No knowledge bases found' : 'No knowledge bases yet'}
          </h3>
          <p style={{ fontSize: '14px', fontWeight: 300, color: '#64748b', marginBottom: '24px' }}>
            {searchQuery ? 'Try adjusting your search' : 'Create your first knowledge base to get started'}
          </p>
          {!searchQuery && (
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
              <MdAdd size={20} />
              <span>Create Knowledge Base</span>
            </button>
          )}
        </div>
      ) : (
        <div className="stats-grid">
          {filteredKBs.map(kb => (
            <div key={kb.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <div style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)',
                    color: 'white'
                  }}>
                    {getTypeIcon(kb.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 400, color: '#0f172a', marginBottom: '4px' }}>
                      {kb.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {getStatusIcon(kb.status)}
                      <span style={{ fontSize: '12px', fontWeight: 300, color: '#64748b', textTransform: 'capitalize' }}>
                        {kb.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Menu */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowMenu(showMenu === kb.id ? null : kb.id)}
                    style={{
                      padding: '6px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      background: 'white',
                      cursor: 'pointer',
                      color: '#64748b'
                    }}
                  >
                    <MdMoreVert size={20} />
                  </button>

                  {showMenu === kb.id && (
                    <>
                      <div
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 999
                        }}
                        onClick={() => setShowMenu(null)}
                      />
                      <div style={{
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        marginTop: '4px',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        minWidth: '180px',
                        zIndex: 1000
                      }}>
                        <button
                          onClick={() => {
                            setSelectedKB(kb);
                            setShowUploadModal(true);
                            setShowMenu(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 300,
                            color: '#0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <MdUpload size={16} />
                          Upload Document
                        </button>

                        <button
                          onClick={() => {
                            setSelectedKB(kb);
                            setShowScrapeModal(true);
                            setShowMenu(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 300,
                            color: '#0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <MdLanguage size={16} />
                          Scrape Website
                        </button>

                        <button
                          onClick={() => {
                            navigate(`/knowledge-base/${kb.id}`);
                            setShowMenu(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 300,
                            color: '#0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <MdLink size={16} />
                          View Details
                        </button>

                        <button
                          onClick={() => {
                            handleDelete(kb.id, kb.name);
                            setShowMenu(null);
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 300,
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            borderTop: '1px solid #f1f5f9'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <MdDelete size={16} />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {kb.description && (
                <p style={{ fontSize: '13px', fontWeight: 300, color: '#64748b', marginBottom: '16px' }}>
                  {kb.description}
                </p>
              )}

              <div style={{ paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '12px', fontWeight: 300, color: '#64748b' }}>
                  {kb.document_count || 0} documents • {new Date(kb.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal - Improved with Method Selection */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={resetCreateModal}>
          <div className="card" style={{ maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">Create Knowledge Base</h3>
              <p className="card-subtitle">
                {createStep === 'method' ? 'Choose how to add content' : 'Enter details and content'}
              </p>
            </div>

            {/* Step 1: Method Selection */}
            {createStep === 'method' && (
              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={() => {
                    setSelectedMethod('upload');
                    setCreateStep('details');
                  }}
                  style={{
                    padding: '20px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    background: 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#a3e635';
                    e.currentTarget.style.background = '#f7fee7';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = 'white';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)',
                      color: 'white'
                    }}>
                      <MdUpload size={24} />
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 400, color: '#0f172a', marginBottom: '4px' }}>
                        Upload Documents
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 300, color: '#64748b' }}>
                        Upload PDF, TXT, MD, DOC, or DOCX files
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setSelectedMethod('scrape');
                    setCreateStep('details');
                  }}
                  style={{
                    padding: '20px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    background: 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#a3e635';
                    e.currentTarget.style.background = '#f7fee7';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = 'white';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                      color: 'white'
                    }}>
                      <MdLanguage size={24} />
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 400, color: '#0f172a', marginBottom: '4px' }}>
                        Scrape Website
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 300, color: '#64748b' }}>
                        Extract content from a website URL
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setSelectedMethod('text');
                    setCreateStep('details');
                  }}
                  style={{
                    padding: '20px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    background: 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#a3e635';
                    e.currentTarget.style.background = '#f7fee7';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = 'white';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: 'white'
                    }}>
                      <MdTextFields size={24} />
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 400, color: '#0f172a', marginBottom: '4px' }}>
                        Add Text Manually
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 300, color: '#64748b' }}>
                        Type or paste text content directly
                      </div>
                    </div>
                  </div>
                </button>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button onClick={resetCreateModal} className="btn btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Details and Content */}
            {createStep === 'details' && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                    Name *
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="e.g., Product Documentation"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 300
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                    Description
                  </label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="Describe this knowledge base..."
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 300,
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* Upload Files */}
                {selectedMethod === 'upload' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                      Upload Files
                    </label>
                    <div style={{
                      border: '2px dashed #e2e8f0',
                      borderRadius: '8px',
                      padding: '24px',
                      textAlign: 'center',
                      background: '#f8fafc'
                    }}>
                      <MdUpload size={40} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
                      <p style={{ fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '4px' }}>
                        Drop files here or click to browse
                      </p>
                      <p style={{ fontSize: '12px', fontWeight: 300, color: '#64748b', marginBottom: '12px' }}>
                        PDF, TXT, MD, DOC, DOCX (Max 10MB)
                      </p>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt,.md"
                        multiple
                        onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                        style={{ display: 'none' }}
                        id="create-file-upload"
                      />
                      <label htmlFor="create-file-upload" className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                        Select Files
                      </label>
                    </div>
                    {uploadFiles.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                          Selected: {uploadFiles.length} file(s)
                        </p>
                        {uploadFiles.map((file, i) => (
                          <div key={i} style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                            • {file.name} ({(file.size / 1024).toFixed(1)} KB)
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Scrape Website */}
                {selectedMethod === 'scrape' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                        Website URL *
                      </label>
                      <input
                        type="url"
                        value={scrapeForm.url}
                        onChange={(e) => setScrapeForm({ ...scrapeForm, url: e.target.value })}
                        placeholder="https://example.com"
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 300
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                        Max Pages
                      </label>
                      <input
                        type="number"
                        value={scrapeForm.maxPages}
                        onChange={(e) => setScrapeForm({ ...scrapeForm, maxPages: parseInt(e.target.value) })}
                        min="1"
                        max="100"
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 300
                        }}
                      />
                    </div>
                  </>
                )}

                {/* Add Text */}
                {selectedMethod === 'text' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                      Text Content *
                    </label>
                    <textarea
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="Paste or type your content here..."
                      rows={10}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 300,
                        resize: 'vertical',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button onClick={() => setCreateStep('method')} className="btn btn-secondary">
                    Back
                  </button>
                  <button onClick={handleCreateWithContent} className="btn btn-primary">
                    Create Knowledge Base
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && selectedKB && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowUploadModal(false)}>
          <div className="card" style={{ maxWidth: '500px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">Upload Documents</h3>
              <p className="card-subtitle">{selectedKB.name}</p>
            </div>

            <div style={{ marginTop: '16px' }}>
              <div style={{
                border: '2px dashed #e2e8f0',
                borderRadius: '8px',
                padding: '24px',
                textAlign: 'center',
                background: '#f8fafc'
              }}>
                <MdUpload size={48} style={{ color: '#cbd5e1', marginBottom: '12px' }} />
                <p style={{ fontSize: '14px', fontWeight: 400, color: '#0f172a', marginBottom: '4px' }}>
                  Drop PDF files here or click to browse
                </p>
                <p style={{ fontSize: '12px', fontWeight: 300, color: '#64748b', marginBottom: '16px' }}>
                  Supports: PDF, TXT, MD, DOC, DOCX (Max 10MB per file)
                </p>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.md"
                  multiple
                  onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                  style={{ display: 'none' }}
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                  Select Files
                </label>
              </div>

              {uploadFiles.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                    Selected Files ({uploadFiles.length}):
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {uploadFiles.map((file, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 300,
                        color: '#0f172a'
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MdDescription size={16} style={{ color: '#64748b' }} />
                          {file.name}
                        </span>
                        <span style={{ color: '#64748b' }}>
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button onClick={() => {
                  setShowUploadModal(false);
                  setUploadFiles([]);
                }} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleUpload} disabled={uploadFiles.length === 0} className="btn btn-primary">
                  Upload {uploadFiles.length > 0 && `(${uploadFiles.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scrape Modal */}
      {showScrapeModal && selectedKB && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowScrapeModal(false)}>
          <div className="card" style={{ maxWidth: '500px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">Scrape Website</h3>
              <p className="card-subtitle">{selectedKB.name}</p>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                  Website URL *
                </label>
                <input
                  type="url"
                  value={scrapeForm.url}
                  onChange={(e) => setScrapeForm({ ...scrapeForm, url: e.target.value })}
                  placeholder="https://example.com"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 300
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                  Max Pages
                </label>
                <input
                  type="number"
                  value={scrapeForm.maxPages}
                  onChange={(e) => setScrapeForm({ ...scrapeForm, maxPages: parseInt(e.target.value) })}
                  min="1"
                  max="100"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 300
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowScrapeModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleScrape} className="btn btn-primary">
                  Start Scraping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
