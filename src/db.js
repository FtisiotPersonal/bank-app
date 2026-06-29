const { Pool } = require('pg');

// pg v8 treats sslmode=require as verify-full, rejecting Aiven's self-signed cert.
// Strip sslmode from the URL so the explicit ssl option below takes full effect.
const connectionString = (process.env.DATABASE_URL || '').replace(/([?&])sslmode=[^&]*/g, '$1').replace(/[?&]$/, '');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;
