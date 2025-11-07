import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdAdd,
  MdSearch,
  MdUpload,
  MdLanguage,
  MdDelete,
  MdEdit,
  MdLink,
  MdDescription,
  MdMoreVert,
  MdRefresh,
  MdCheckCircle,
  MdError,
  MdHourglassEmpty
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
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showScrapeModal, setShowScrapeModal] = useState(false);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    type: 'manual' as 'document' | 'website' | 'manual'
  });

  // Upload form
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Scrape form
  const [scrapeForm, setScrapeForm] = useState({
    url: '',
    maxPages: 10
  });

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  const loadKnowledgeBases = async () => {
    try {
      const response = await apiClient.get('/api/knowledge-bases');
      setKnowledgeBases(response.data);
    } catch (error) {
      console.error('Failed to load knowledge bases:', error);
      toast.error('Failed to load knowledge bases');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      const response = await apiClient.post('/api/knowledge-bases', createForm);
      setKnowledgeBases([response.data, ...knowledgeBases]);
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', type: 'manual' });
      toast.success('Knowledge base created');
    } catch (error) {
      console.error('Failed to create knowledge base:', error);
      toast.error('Failed to create knowledge base');
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !selectedKB) {
      toast.error('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      await apiClient.post(`/api/knowledge-bases/${selectedKB.id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowUploadModal(false);
      setUploadFile(null);
      toast.success('Document uploaded successfully');
      loadKnowledgeBases();
    } catch (error) {
      console.error('Failed to upload document:', error);
      toast.error('Failed to upload document');
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
                          Link to Agents
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

      {/* Create Modal */}
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
        }} onClick={() => setShowCreateModal(false)}>
          <div className="card" style={{ maxWidth: '500px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">Create Knowledge Base</h3>
            </div>

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
                  rows={3}
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

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleCreate} className="btn btn-primary">
                  Create
                </button>
              </div>
            </div>
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
              <h3 className="card-title">Upload Document</h3>
              <p className="card-subtitle">{selectedKB.name}</p>
            </div>

            <div style={{ marginTop: '16px' }}>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px dashed #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300
                }}
              />
              {uploadFile && (
                <p style={{ fontSize: '13px', fontWeight: 300, color: '#64748b', marginTop: '8px' }}>
                  Selected: {uploadFile.name}
                </p>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button onClick={() => setShowUploadModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleUpload} disabled={!uploadFile} className="btn btn-primary">
                  Upload
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
