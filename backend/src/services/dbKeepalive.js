/**
 * DB Keepalive Service
 * 
 * Supabase pauses free-tier projects after 7 days of inactivity.
 * This service runs a lightweight SELECT query against the database 
 * every 2 days to ensure it stays active indefinitely.
 */

const { sequelize } = require('../models');

// 2 days in milliseconds
const KEEPALIVE_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000;

const pingDatabase = async () => {
  try {
    await sequelize.query('SELECT 1+1 AS result');
    console.log(`💓 DB Keepalive: Supabase pinged successfully at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('❌ DB Keepalive: Failed to ping database:', error.message);
  }
};

const start = () => {
  // Run immediately on startup so we confirm DB is alive
  pingDatabase();

  // Then schedule every 2 days
  setInterval(pingDatabase, KEEPALIVE_INTERVAL_MS);

  const days = KEEPALIVE_INTERVAL_MS / (24 * 60 * 60 * 1000);
  console.log(`💓 DB Keepalive: Scheduled to ping Supabase every ${days} day(s).`);
};

module.exports = { start, pingDatabase };
