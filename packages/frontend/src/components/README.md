# Agent Configuration Interface Components

This directory contains the React components that implement the agent configuration interface for the AI Agent Creator Platform.

## Components

### AgentBuilder (`/pages/AgentBuilder.tsx`)

The main component for creating and editing AI agents. Provides a comprehensive form interface with the following sections:

#### Features:
- **Basic Information**: Agent name and description
- **Personality Configuration**: Tone selection, communication style, and special instructions
- **Knowledge Base Management**: Document upload, URL ingestion, and FAQ management
- **Settings**: Response time, conversation length limits, and escalation triggers
- **Real-time Preview**: Side panel showing agent configuration summary
- **Agent Testing**: Integrated testing modal for immediate feedback

#### Usage:
```tsx
// Create new agent
<Route path="/agents/new" element={<AgentBuilder />} />

// Edit existing agent
<Route path="/agents/:id" element={<AgentBuilder />} />
```

### AgentTester (`/components/AgentTester.tsx`)

A modal component that provides a chat interface for testing agent configurations in real-time.

#### Features:
- **Chat Interface**: Send and receive messages with the configured agent
- **Voice Controls**: Toggle voice input and output (UI only, backend integration required)
- **Personality Testing**: Responses adapt based on agent's configured tone and style
- **Real-time Feedback**: Immediate testing without saving the agent

#### Usage:
```tsx
<AgentTester 
  agent={agentConfiguration} 
  onClose={() => setShowTester(false)} 
/>
```

### DocumentUploader (`/components/DocumentUploader.tsx`)

A drag-and-drop file upload component for managing agent knowledge base documents.

#### Features:
- **Drag & Drop**: Intuitive file upload with visual feedback
- **File Validation**: Type and size validation with error messages
- **Progress Indication**: Upload progress and status feedback
- **File Management**: View uploaded files and remove unwanted ones
- **Customizable**: Configurable file types, size limits, and maximum file count

#### Usage:
```tsx
<DocumentUploader
  documents={agent.knowledgeBase?.documents || []}
  onDocumentsChange={handleDocumentsChange}
  maxFiles={20}
  maxFileSize={10}
  acceptedTypes={['.pdf', '.txt', '.doc', '.docx', '.md', '.csv']}
/>
```

## Validation

### Validation Utilities (`/utils/validation.ts`)

Comprehensive validation functions for agent configuration:

- `validateAgent()`: Validates complete agent configuration
- `validateUrl()`: URL format validation
- `validateFileType()`: File extension validation
- `validateFileSize()`: File size limit validation

## State Management

The components integrate with the global app state through the `AppContext`:

```tsx
const { state, dispatch } = useApp()

// Add new agent
dispatch({ type: 'ADD_AGENT', payload: newAgent })

// Update existing agent
dispatch({ type: 'UPDATE_AGENT', payload: updatedAgent })
```

## API Integration

Components use the `apiClient` service for backend communication:

```tsx
// Create agent
const newAgent = await apiClient.createAgent(agentData)

// Update agent
const updatedAgent = await apiClient.updateAgent(id, agentData)

// Load agent
const agent = await apiClient.getAgent(id)
```

## Testing

Each component includes comprehensive test coverage:

- **Unit Tests**: Component rendering and user interactions
- **Integration Tests**: API calls and state management
- **Validation Tests**: Input validation and error handling

Run tests with:
```bash
npm test
```

## Styling

Components use Tailwind CSS for styling with:
- Responsive design for mobile and desktop
- Consistent color scheme and spacing
- Interactive states (hover, focus, disabled)
- Loading and error states

## Accessibility

Components follow accessibility best practices:
- Semantic HTML structure
- ARIA labels and descriptions
- Keyboard navigation support
- Screen reader compatibility
- Focus management

## Future Enhancements

Potential improvements for the agent configuration interface:

1. **Advanced Knowledge Base**: Support for web scraping, API integrations
2. **Workflow Builder**: Visual workflow designer for complex agent behaviors
3. **A/B Testing**: Compare different agent configurations
4. **Analytics Integration**: Track agent performance metrics
5. **Collaboration**: Multi-user editing and version control
6. **Templates**: Pre-built agent templates for common use cases