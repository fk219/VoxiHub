import React, { useState, useEffect } from 'react';
import {
  MdFunctions,
  MdAdd,
  MdSearch,
  MdPlayArrow,
  MdDelete,
  MdCode,
  MdBuild,
  MdStorage,
  MdApi,
  MdHistory,
  MdCheckCircle,
  MdError
} from 'react-icons/md';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface FunctionDefinition {
  id: string;
  name: string;
  description: string;
  category: 'builtin' | 'database' | 'api' | 'custom';
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
    enum?: string[];
  }>;
  enabled: boolean;
  createdAt: string;
  usageCount?: number;
  successRate?: number;
}

interface FunctionCall {
  id: string;
  functionName: string;
  parameters: Record<string, any>;
  success: boolean;
  executionTime: number;
  executedAt: string;
  error?: string;
  result?: any;
}

const FunctionManagement: React.FC = () => {
  const [functions, setFunctions] = useState<FunctionDefinition[]>([]);
  const [functionCalls, setFunctionCalls] = useState<FunctionCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'functions' | 'calls'>('functions');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFunction, setSelectedFunction] = useState<FunctionDefinition | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testParameters, setTestParameters] = useState<Record<string, any>>({});
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    loadFunctions();
    loadFunctionCalls();
  }, []);

  const loadFunctions = async () => {
    try {
      const response = await apiClient.get('/api/v1/functions');
      setFunctions(response.data);
    } catch (error) {
      console.error('Failed to load functions:', error);
      toast.error('Failed to load functions');
    } finally {
      setLoading(false);
    }
  };

  const loadFunctionCalls = async () => {
    try {
      const response = await apiClient.get('/api/v1/functions/calls');
      setFunctionCalls(response.data);
    } catch (error) {
      console.error('Failed to load function calls:', error);
    }
  };

  const testFunction = async () => {
    if (!selectedFunction) return;

    setTestLoading(true);
    setTestResult(null);

    try {
      const response = await apiClient.post(`/api/v1/functions/${selectedFunction.id}/test`, {
        parameters: testParameters
      });
      
      setTestResult(response.data);
      toast.success('Function executed successfully');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Function test failed';
      setTestResult({ success: false, error: errorMessage });
      toast.error(errorMessage);
    } finally {
      setTestLoading(false);
    }
  };

  const toggleFunction = async (functionId: string, enabled: boolean) => {
    try {
      await apiClient.patch(`/api/v1/functions/${functionId}`, { enabled });
      setFunctions(functions.map(f => 
        f.id === functionId ? { ...f, enabled } : f
      ));
      toast.success(`Function ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle function:', error);
      toast.error('Failed to update function');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'builtin': return <MdBuild className="w-4 h-4" />;
      case 'database': return <MdStorage className="w-4 h-4" />;
      case 'api': return <MdApi className="w-4 h-4" />;
      case 'custom': return <MdCode className="w-4 h-4" />;
      default: return <MdFunctions className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'builtin': return 'bg-blue-100 text-blue-700';
      case 'database': return 'bg-green-100 text-green-700';
      case 'api': return 'bg-purple-100 text-purple-700';
      case 'custom': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredFunctions = functions.filter(func => {
    const matchesSearch = func.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         func.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || func.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
            <h2 className="card-title">Function Management</h2>
            <p className="card-subtitle">Manage AI agent functions and tools</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          {[
            { id: 'functions', label: 'Functions', icon: MdFunctions },
            { id: 'calls', label: 'Call History', icon: MdHistory }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300,
                  cursor: 'pointer',
                  background: activeTab === tab.id ? '#84cc16' : 'transparent',
                  color: activeTab === tab.id ? 'white' : '#64748b'
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Functions Tab */}
      {activeTab === 'functions' && (
        <div>
          {/* Filters */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
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
                  placeholder="Search functions..."
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
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: '12px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 300,
                  minWidth: '150px'
                }}
              >
                <option value="all">All Categories</option>
                <option value="builtin">Built-in</option>
                <option value="database">Database</option>
                <option value="api">API</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          {/* Functions List */}
          <div className="stats-grid">
            {filteredFunctions.map(func => (
              <div key={func.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      padding: '8px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)',
                      color: 'white'
                    }}>
                      {getCategoryIcon(func.category)}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 400, color: '#0f172a', marginBottom: '4px' }}>
                        {func.name}
                      </h3>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 300,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        textTransform: 'capitalize'
                      }} className={getCategoryColor(func.category)}>
                        {func.category}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        setSelectedFunction(func);
                        setShowTestModal(true);
                        setTestParameters({});
                        setTestResult(null);
                      }}
                      style={{
                        padding: '6px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        background: 'white',
                        cursor: 'pointer',
                        color: '#64748b'
                      }}
                      title="Test function"
                    >
                      <MdPlayArrow size={16} />
                    </button>
                    <button
                      onClick={() => toggleFunction(func.id, !func.enabled)}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        background: func.enabled ? '#ef4444' : '#84cc16',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 300
                      }}
                    >
                      {func.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>

                <p style={{ fontSize: '13px', fontWeight: 300, color: '#64748b', marginBottom: '16px', lineHeight: '1.5' }}>
                  {func.description}
                </p>

                <div style={{ display: 'flex', gap: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 300, color: '#64748b', marginBottom: '4px' }}>
                      Parameters
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 400, color: '#0f172a' }}>
                      {func.parameters.length}
                    </div>
                  </div>
                  {func.usageCount !== undefined && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 300, color: '#64748b', marginBottom: '4px' }}>
                        Usage
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 400, color: '#0f172a' }}>
                        {func.usageCount}
                      </div>
                    </div>
                  )}
                  {func.successRate !== undefined && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 300, color: '#64748b', marginBottom: '4px' }}>
                        Success Rate
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 400, color: func.successRate > 90 ? '#84cc16' : '#f59e0b' }}>
                        {func.successRate}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Call History Tab */}
      {activeTab === 'calls' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Function Call History</h3>
          </div>

          <div style={{ marginTop: '16px' }}>
            {functionCalls.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
                <MdHistory size={48} style={{ margin: '0 auto 16px' }} />
                <p>No function calls yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {functionCalls.map(call => (
                  <div key={call.id} style={{
                    padding: '16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: 'white'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {call.success ? (
                          <MdCheckCircle size={20} style={{ color: '#84cc16' }} />
                        ) : (
                          <MdError size={20} style={{ color: '#ef4444' }} />
                        )}
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 400, color: '#0f172a' }}>
                            {call.functionName}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 300, color: '#64748b' }}>
                            {new Date(call.executedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 300, color: '#64748b' }}>
                        {call.executionTime}ms
                      </div>
                    </div>

                    <div style={{ fontSize: '12px', fontWeight: 300, color: '#64748b', marginBottom: '8px' }}>
                      Parameters: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                        {JSON.stringify(call.parameters)}
                      </code>
                    </div>

                    {call.error && (
                      <div style={{ fontSize: '12px', fontWeight: 300, color: '#ef4444', background: '#fef2f2', padding: '8px', borderRadius: '4px' }}>
                        Error: {call.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Test Modal */}
      {showTestModal && selectedFunction && (
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
        }} onClick={() => setShowTestModal(false)}>
          <div className="card" style={{ maxWidth: '600px', width: '90%', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">Test Function: {selectedFunction.name}</h3>
            </div>

            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: 300, color: '#64748b', marginBottom: '16px' }}>
                {selectedFunction.description}
              </p>

              {selectedFunction.parameters.length > 0 ? (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 400, marginBottom: '12px' }}>Parameters</h4>
                  {selectedFunction.parameters.map(param => (
                    <div key={param.name} style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 300, color: '#64748b', marginBottom: '4px' }}>
                        {param.name} {param.required && <span style={{ color: '#ef4444' }}>*</span>}
                      </label>
                      <input
                        type={param.type === 'number' ? 'number' : 'text'}
                        placeholder={param.description}
                        value={testParameters[param.name] || ''}
                        onChange={(e) => setTestParameters({
                          ...testParameters,
                          [param.name]: param.type === 'number' ? Number(e.target.value) : e.target.value
                        })}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '13px', fontWeight: 300, color: '#64748b', marginBottom: '16px' }}>
                  This function has no parameters.
                </p>
              )}

              {testResult && (
                <div style={{
                  padding: '12px',
                  borderRadius: '6px',
                  background: testResult.success ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${testResult.success ? '#84cc16' : '#ef4444'}`,
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 400, marginBottom: '8px', color: testResult.success ? '#84cc16' : '#ef4444' }}>
                    {testResult.success ? 'Success' : 'Error'}
                  </div>
                  <pre style={{ fontSize: '12px', fontWeight: 300, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(testResult.success ? testResult.result : testResult.error, null, 2)}
                  </pre>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowTestModal(false)}
                  className="btn btn-secondary"
                >
                  Close
                </button>
                <button
                  onClick={testFunction}
                  disabled={testLoading}
                  className="btn btn-primary"
                >
                  {testLoading ? 'Testing...' : 'Test Function'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FunctionManagement;
