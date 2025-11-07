import swaggerJsdoc from 'swagger-jsdoc';
import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'VoxiHub API',
      version: '1.0.0',
      description: 'AI Agent Creator Platform REST API',
      contact: {
        name: 'API Support',
        email: 'support@voxihub.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: 'https://api.voxihub.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from authentication',
        },
        apiKeyAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key',
          description: 'API key starting with vx_',
        },
      },
      schemas: {
        Agent: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique agent identifier',
            },
            user_id: {
              type: 'string',
              format: 'uuid',
              description: 'Owner user ID',
            },
            name: {
              type: 'string',
              description: 'Agent name',
            },
            description: {
              type: 'string',
              description: 'Agent description',
            },
            personality_tone: {
              type: 'string',
              enum: ['professional', 'friendly', 'casual', 'formal'],
              description: 'Agent personality tone',
            },
            personality_style: {
              type: 'string',
              description: 'Agent personality style',
            },
            personality_instructions: {
              type: 'string',
              description: 'Custom personality instructions',
            },
            status: {
              type: 'string',
              enum: ['draft', 'active', 'inactive'],
              description: 'Agent status',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Function: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Function ID',
            },
            name: {
              type: 'string',
              description: 'Function name',
            },
            description: {
              type: 'string',
              description: 'Function description',
            },
            parameters: {
              type: 'object',
              description: 'Function parameters schema',
            },
            category: {
              type: 'string',
              enum: ['builtin', 'custom', 'integration'],
              description: 'Function category',
            },
            enabled: {
              type: 'boolean',
              description: 'Whether function is enabled',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Webhook: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Webhook ID',
            },
            agent_id: {
              type: 'string',
              format: 'uuid',
              description: 'Associated agent ID (optional)',
            },
            url: {
              type: 'string',
              format: 'uri',
              description: 'Webhook endpoint URL',
            },
            events: {
              type: 'array',
              items: {
                type: 'string',
                enum: [
                  'call.started',
                  'call.ended',
                  'call.failed',
                  'conversation.updated',
                  'conversation.ended',
                  'agent.deployed',
                  'agent.updated',
                  'function.executed',
                  'error.occurred',
                ],
              },
              description: 'Events to subscribe to',
            },
            enabled: {
              type: 'boolean',
              description: 'Whether webhook is enabled',
            },
            retry_count: {
              type: 'integer',
              description: 'Number of retry attempts',
            },
            last_triggered_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last trigger timestamp',
            },
            last_status: {
              type: 'integer',
              description: 'Last HTTP status code',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        ApiKey: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'API key ID',
            },
            name: {
              type: 'string',
              description: 'API key name',
            },
            key_prefix: {
              type: 'string',
              description: 'First 10 characters of the key',
            },
            last_used_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last usage timestamp',
            },
            expires_at: {
              type: 'string',
              format: 'date-time',
              description: 'Expiration timestamp',
            },
            rate_limit: {
              type: 'integer',
              description: 'Requests per minute limit',
            },
            usage_quota: {
              type: 'integer',
              description: 'Total usage quota',
            },
            usage_count: {
              type: 'integer',
              description: 'Current usage count',
            },
            enabled: {
              type: 'boolean',
              description: 'Whether key is enabled',
            },
            scopes: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'API key scopes',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            code: {
              type: 'string',
              description: 'Error code',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Authentication required',
                code: 'UNAUTHORIZED',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Insufficient permissions',
                code: 'FORBIDDEN',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Resource not found',
                code: 'NOT_FOUND',
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: {
                  field: 'name',
                  message: 'Name is required',
                },
              },
            },
          },
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Too many requests',
                code: 'RATE_LIMIT_EXCEEDED',
                limit: 100,
                remaining: 0,
                reset: '2024-01-01T00:00:00Z',
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Agents',
        description: 'Agent management endpoints',
      },
      {
        name: 'Functions',
        description: 'Function calling endpoints',
      },
      {
        name: 'Webhooks',
        description: 'Webhook management endpoints',
      },
      {
        name: 'API Keys',
        description: 'API key management endpoints',
      },
      {
        name: 'Conversations',
        description: 'Conversation management endpoints',
      },
      {
        name: 'SIP',
        description: 'SIP and call management endpoints',
      },
    ],
  },
  apis: [
    './src/routes/api/v1/*.ts',
    './src/routes/*.ts',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  // Swagger UI
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'VoxiHub API Documentation',
  }));

  // OpenAPI JSON
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

export { swaggerSpec };
