import swaggerJsDoc from 'swagger-jsdoc';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Trust-Pay API Documentation',
      version: '1.0.0',
      description: 'Trust-Pay Financial Services API - Public endpoints (auth, ping, webhooks) require no authentication. Private endpoints require JWT token obtained via login.',
      contact: {
        name: 'Trust-Pay Support',
        email: 'support@trustpay.com'
      },
      license: {
        name: 'Proprietary',
        url: 'https://trustpay.com/license'
      }
    },
    servers: [
      {
        url: 'http://localhost:8090/v1',
        description: 'Development Server',
      },
      {
        url: 'https://api-staging.trustpay.com/v1',
        description: 'Staging Server',
      },
      {
        url: 'https://api.trustpay.com/v1',
        description: 'Production Server',
      }
    ],
    components: {
      securitySchemes: {
        xAuthToken: {
          type: 'apiKey',
          in: 'header',
          name: 'x-auth-token',
          description: 'JWT Authentication Token - Step 1: Login using POST /auth/login with your username and password. Step 2: Copy the accessToken from the response. Step 3: Click Authorize button and paste the token. Step 4: All private APIs will now be accessible.',
        }
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['success', 'message'],
          properties: {
            success: {
              type: 'boolean',
              example: false,
              description: 'Indicates operation failure'
            },
            message: {
              type: 'string',
              example: 'Error message description',
              description: 'Human-readable error message'
            },
            error: {
              type: 'object',
              description: 'Detailed error information',
              properties: {
                code: {
                  type: 'string',
                  example: 'AUTH_001'
                },
                details: {
                  type: 'string',
                  example: 'Additional error context'
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-11-18T14:30:00.000Z',
              description: 'Error occurrence timestamp'
            }
          }
        },
        Success: {
          type: 'object',
          required: ['success', 'message'],
          properties: {
            success: {
              type: 'boolean',
              example: true,
              description: 'Indicates operation success'
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully',
              description: 'Human-readable success message'
            },
            data: {
              type: 'object',
              description: 'Response payload data'
            },
            pagination: {
              type: 'object',
              description: 'Pagination metadata for list endpoints',
              properties: {
                page: {
                  type: 'integer',
                  example: 1
                },
                limit: {
                  type: 'integer', 
                  example: 10
                },
                total: {
                  type: 'integer',
                  example: 150
                },
                pages: {
                  type: 'integer',
                  example: 15
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-11-18T14:30:00.000Z',
              description: 'Response timestamp'
            }
          }
        },
        AuthToken: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              description: 'JWT authentication token'
            },
            expires_at: {
              type: 'string',
              format: 'date-time',
              example: '2024-11-18T14:30:00.000Z',
              description: 'Token expiration timestamp'
            },
            refresh_token: {
              type: 'string',
              example: 'refresh_token_string_here',
              description: 'Token for refreshing expired access token'
            }
          }
        }
      }
    },
    security: [
      {
        xAuthToken: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: '🔐 User authentication and session management (Public)'
      },
      {
        name: 'Ping',
        description: '💓 Health checks and system monitoring (Public)'
      },
      {
        name: 'Users',
        description: '👥 User management and administration (Private)'
      },
      {
        name: 'Roles',
        description: '🛡️ Role and permission management (Private)'
      },
      {
        name: 'Company',
        description: '🏢 Company and organization management (Private)'
      },
      {
        name: 'PayIn',
        description: '💳 Payment collection and processing (Private)'
      },
      {
        name: 'PayOut',
        description: '💸 Payment disbursement and transfers (Private)'
      },
      {
        name: 'Settlements',
        description: '⚖️ Financial settlement processing and transaction reconciliation (Private)'
      },
      {
        name: 'BankResponse',
        description: '🏦 Bank communication and responses (Private)'
      },
      {
        name: 'Cron Jobs',
        description: '⏰ Scheduled task management (Private - Admin Only)'
      },
      {
        name: 'Reports',
        description: '📊 Financial reporting and analytics (Private)'
      }
    ]
  },
  apis: ['./src/apis/**/*.js', './src/cron/**/*.js'],
};

// Enhanced Swagger UI configuration for better user experience
export const swaggerUIOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    displayOperationId: false,
    tryItOutEnabled: true
  },
  customSiteTitle: 'Trust-Pay API Documentation',
  customfavIcon: '/favicon.ico',
  customCss: `
    .swagger-ui .topbar { 
      background-color: #1f2937; 
      border-bottom: 3px solid #3b82f6;
    }
    .swagger-ui .topbar .download-url-wrapper .select-label { 
      color: #ffffff; 
    }
    .swagger-ui .info .title { 
      color: #1f2937; 
      font-size: 2.5em;
      font-weight: bold;
    }
    .swagger-ui .btn.authorize { 
      background-color: #10b981; 
      border-color: #10b981;
      font-weight: bold;
      font-size: 14px;
      padding: 8px 16px;
    }
    .swagger-ui .btn.authorize:hover { 
      background-color: #059669; 
      border-color: #059669;
    }
    .swagger-ui .auth-container .auth-wrapper {
      padding: 20px;
      background: #ffffff;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .swagger-ui .auth-container .auth-wrapper h4 {
      color: #1f2937;
      margin-bottom: 10px;
    }
    .swagger-ui .auth-container .auth-wrapper input {
      width: 100%;
      margin-bottom: 10px;
    }
  `
};

export const swaggerSpecs = swaggerJsDoc(swaggerOptions);
