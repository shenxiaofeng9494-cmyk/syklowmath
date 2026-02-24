const fs = require('fs');
const path = require('path');

// Load .env.local from app directory
const envPath = path.join(__dirname, '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
      }
    }
  }
}

module.exports = {
  apps: [{
    name: 'mathtalk',
    script: path.join(__dirname, '.next/standalone/server.js'),
    cwd: path.join(__dirname, '.next/standalone'),
    env: env,
  }]
};
