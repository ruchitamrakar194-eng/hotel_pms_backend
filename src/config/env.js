const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL,
  env: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret_key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  mews: {
    baseUrl: process.env.MEWS_BASE_URL,
    clientToken: process.env.MEWS_CLIENT_TOKEN,
    accessToken: process.env.MEWS_ACCESS_TOKEN
  }
};

module.exports = config;
module.exports = config;


