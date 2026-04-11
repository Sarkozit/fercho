/**
 * gmail-watch.ts
 * 
 * Script to register Gmail push notifications via Pub/Sub.
 * Must be run once initially, then every 24h via cron to renew
 * before Gmail's 7-day expiry limit.
 * 
 * Usage:  npx tsx scripts/gmail-watch.ts
 * Cron:   0 4 * * * cd /path/to/backend && npx tsx scripts/gmail-watch.ts >> /var/log/gmail-watch.log 2>&1
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { setupGmailWatch } from '../src/services/gmail.service.js';

async function main() {
  try {
    console.log(`[${new Date().toISOString()}] Setting up Gmail watch...`);
    const result = await setupGmailWatch();
    console.log(`[${new Date().toISOString()}] ✅ Gmail watch registered successfully.`);
    console.log(`  historyId: ${result.historyId}`);
    console.log(`  expiration: ${result.expiration} (${new Date(Number(result.expiration)).toISOString()})`);
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] ❌ Failed to setup Gmail watch:`, error.message);
    process.exit(1);
  }
}

main();
