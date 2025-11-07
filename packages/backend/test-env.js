// Simple test to verify environment variables are loaded
require('dotenv').config();

console.log('Environment Variables Check:');
console.log('============================');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✓ Set' : '✗ Missing');
console.log('PORT:', process.env.PORT || '3001 (default)');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development (default)');
console.log('');
console.log('Full SUPABASE_URL value:', process.env.SUPABASE_URL);
