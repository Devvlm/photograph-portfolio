/**
 * Password Hash Generator
 *
 * Run this script to generate a password hash for your admin password.
 * Usage: node scripts/hash-password.js <your-password>
 *
 * Then set the hash in Cloudflare using:
 * wrangler secret put ADMIN_PASSWORD_HASH
 * (paste the generated hash when prompted)
 */

const crypto = require('crypto');

const password = process.argv[2];

if (!password) {
  console.log('Usage: node scripts/hash-password.js <your-password>');
  console.log('');
  console.log('Example: node scripts/hash-password.js MySecurePassword123!');
  process.exit(1);
}

// Get JWT_SECRET from environment or use default
const jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret-here';

console.log('');
console.log('='.repeat(60));
console.log('PASSWORD HASH GENERATOR');
console.log('='.repeat(60));
console.log('');

// Generate hash using SHA-256 (same method as auth.js)
const hash = crypto
  .createHash('sha256')
  .update(password + jwtSecret)
  .digest('hex');

console.log('Your password hash:');
console.log('');
console.log(hash);
console.log('');
console.log('='.repeat(60));
console.log('');
console.log('IMPORTANT: Copy this hash and set it in Cloudflare:');
console.log('');
console.log('  cd worker');
console.log('  wrangler secret put ADMIN_PASSWORD_HASH');
console.log('  (paste the hash above when prompted)');
console.log('');
console.log('Also set your JWT secret:');
console.log('');
console.log('  wrangler secret put JWT_SECRET');
console.log(`  (enter: ${jwtSecret})`);
console.log('');
console.log('NOTE: The JWT_SECRET used here MUST match the one in Cloudflare!');
console.log('If you change JWT_SECRET, regenerate the password hash.');
console.log('');
