-- Knowledge Base Tables for VoxiHub

-- Knowledge Bases table
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'general', -- general, faq, documentation, etc.
  status VARCHAR(50) DEFAULT 'active', -- active, processing, error
  total_documents INTEGER DEFAULT 0,
  total_size BIGINT DEFAULT 0, -- in bytes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge Base Documents table
CREATE TABLE IF NOT EXISTS knowledge_base_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL, -- pdf, docx, txt, md
  file_size BIGINT NOT NULL,
  file_path TEXT, -- S3 path or local path
  content TEXT, -- Extracted text content
  metadata JSONB, -- Additional metadata
  status VARCHAR(50) DEFAULT 'processing', -- processing, ready, error
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_user_id ON knowledge_bases(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_status ON knowledge_bases(status);
CREATE INDEX IF NOT EXISTS idx_kb_documents_kb_id ON knowledge_base_documents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_kb_documents_status ON knowledge_base_documents(status);

-- Full text search index on content
CREATE INDEX IF NOT EXISTS idx_kb_documents_content_search ON knowledge_base_documents USING gin(to_tsvector('english', content));

-- Comments
COMMENT ON TABLE knowledge_bases IS 'Stores knowledge base collections for agents';
COMMENT ON TABLE knowledge_base_documents IS 'Stores individual documents within knowledge bases';
COMMENT ON COLUMN knowledge_base_documents.content IS 'Extracted text content from uploaded files';
