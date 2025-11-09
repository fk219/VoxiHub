import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MdArrowBack,
  MdUpload,
  MdDelete,
  MdSearch,
  MdDescription,
  MdRefresh
} from 'react-icons/md';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface Document {
  id: string;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  content: string;
  status: string;
  created_at: string;
}

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  total_documents: number;
  total_size: number;
  documents?: Document[];
}

const KnowledgeBaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  useEffect(() => {
    loadKnowledgeBase();
  }, [id]);

  const loadKnowledgeBase = async () => {
    try {
      const response = await apiClient.get(`/api/knowledge-bases/${id}`) as KnowledgeBase;
      setKb(response);
      setDocuments(response.documents || []);
    } catch (error) {
      console.error('Failed to load knowledge base:', error);
      toast.error('Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    const formData = new FormData();
    uploadFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await apiClient.post(`/api/knowledge-bases/${id}/upload`, formData) as { uploaded: number };
      setShowUploadModal(false);
      setUploadFiles([]);
      toast.success(`${response.uploaded || uploadFiles.length} document(s) uploaded successfully`);
      loadKnowledgeBase();
    } catch (error) {
      console.error('Failed to upload documents:', error);
      toast.error('Failed to upload documents');
    }
  };

  const handleDelete = async (docId: string, filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return;

    try {
      await apiClient.delete(`/api/knowledge-bases/${id}/documents/${docId}`);
      setDocuments(documents.filter(d => d.id !== docId));
      if (selectedDoc?.id === docId) {
        setSelectedDoc(null);
      }
      toast.success('Document deleted');
    } catch (error) {
      console.error('Failed to delete document:', error);
      toast.error('Failed to delete document');
    }
  };

  const filteredDocs = documents.filter(doc =>
    doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
          Knowledge base not found
        </h3>
        <button onClick={() => navigate('/knowledge-base')} className="btn btn-primary" style={{ marginTop: '16px' }}>
          <MdArrowBack size={20} />
          <span>Back to Knowledge Bases</span>
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => navigate('/knowledge-base')}
              style={{
                padding: '8px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <MdArrowBack size={20} />
            </button>
            <div>
              <h2 className="card-title">{kb.name}</h2>
              <p className="card-subtitle">{kb.description || 'No description'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={loadKnowledgeBase} className="btn btn-secondary">
              <MdRefresh size={20} />
              <span>Refresh</span>
            </button>
            <button onClick={() => setShowUploadModal(true)} className="btn btn-primary">
              <MdUpload size={20} />
              <span>Upload Documents</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ marginTop: '16px', display: 'flex', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 400, color: '#0f172a' }}>
              {documents.length}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 300, color: '#64748b' }}>
              Documents
            </div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 400, color: '#0f172a' }}>
              {((kb.total_size || 0) / 1024 / 1024).toFixed(2)} MB
            </div>
            <div style={{ fontSize: '12px', fontWeight: 300, color: '#64748b' }}>
              Total Size
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedDoc ? '350px 1fr' : '1fr', gap: '24px' }}>
        {/* Documents List */}
        <div className="card">
          <div style={{ marginBottom: '16px' }}>
            <div style={{ position: 'relative' }}>
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
                placeholder="Search documents..."
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

          {filteredDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <MdDescription size={48} style={{ color: '#cbd5e1', marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', fontWeight: 300, color: '#64748b' }}>
                {searchQuery ? 'No documents found' : 'No documents yet'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredDocs.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  style={{
                    padding: '12px',
                    border: `1px solid ${selectedDoc?.id === doc.id ? '#a3e635' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: selectedDoc?.id === doc.id ? '#f7fee7' : 'white',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedDoc?.id !== doc.id) {
                      e.currentTarget.style.background = '#f8fafc';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedDoc?.id !== doc.id) {
                      e.currentTarget.style.background = 'white';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 400,
                        color: '#0f172a',
                        marginBottom: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {doc.original_filename}
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 300, color: '#64748b' }}>
                        {doc.file_type.toUpperCase()} • {(doc.file_size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(doc.id, doc.original_filename);
                      }}
                      style={{
                        padding: '6px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: '#ef4444',
                        borderRadius: '4px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <MdDelete size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Document Viewer */}
        {selectedDoc && (
          <div className="card">
            <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 400, color: '#0f172a', marginBottom: '8px' }}>
                {selectedDoc.original_filename}
              </h3>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', fontWeight: 300, color: '#64748b' }}>
                <span>{selectedDoc.file_type.toUpperCase()}</span>
                <span>•</span>
                <span>{(selectedDoc.file_size / 1024).toFixed(1)} KB</span>
                <span>•</span>
                <span>{new Date(selectedDoc.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div style={{
              maxHeight: '600px',
              overflowY: 'auto',
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 300,
              lineHeight: '1.6',
              color: '#0f172a',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {selectedDoc.content || 'No content available'}
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
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
              <p className="card-subtitle">{kb.name}</p>
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
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setUploadFiles(files);
                  }}
                  style={{ display: 'none' }}
                  id="file-upload-detail"
                />
                <label htmlFor="file-upload-detail" className="btn btn-secondary" style={{ cursor: 'pointer' }}>
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
    </div>
  );
};

export default KnowledgeBaseDetail;
