import dotenv from 'dotenv';
import path from 'path';

// Load environment variables BEFORE any other imports
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Validate required environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file in packages/backend/.env');
  process.exit(1);
}

// Export validated config
export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  supabase: {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
  },
  
  groq: {
    apiKey: process.env.GROQ_API_KEY,
  },
  
  sip: {
    providerHost: process.env.SIP_PROVIDER_HOST,
    providerPort: parseInt(process.env.SIP_PROVIDER_PORT || '5060', 10),
    username: process.env.SIP_USERNAME,
    password: process.env.SIP_PASSWORD,
  },
  
  jwt: {
    secret: process.env.JWT_SECRET!,
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
    allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,txt,md').split(','),
  },
};
