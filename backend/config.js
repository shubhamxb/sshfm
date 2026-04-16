/**
 * Backend configuration
 * One place to rule them all
 */

require('dotenv').config();

const config = {
  server: {
    port: parseInt(process.env.PORT || process.env.SERVER_PORT || '6969', 10),
    env: process.env.NODE_ENV || 'development',
  },
  ssh: {
    defaultPort: parseInt(process.env.SSH_PORT || '22', 10),
    connectionTimeout: 15000, // 15 seconds
    maxFilesPerListing: 1000,
  },
  upload: {
    maxFileSizeMB: 500,
    maxFileSizeBytes: 500 * 1024 * 1024,
  },
};

module.exports = config;
