const fs = require('fs');
const path = require('path');

console.log('🏈 Fantasy Command Center - Setup Verification\n');

// Check if all core files exist
const requiredFiles = [
  'src/index.js',
  'src/api/espn-client.js',
  'src/api/claude-ai.js',
  'src/api/external-apis.js',
  'src/services/draft-monitor.js',
  'src/alerts/discord-bot.js',
  'config/index.js',
  'database/migrate.js',
  'package.json',
  '.env.example'
];

let allFilesExist = true;

console.log('📁 Checking required files...');
requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

console.log('\n📦 Checking dependencies...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = [
    'express', 'espn-fantasy-football-api', 'axios', 'sqlite3', 
    'dotenv', 'discord.js', 'winston', 'helmet', 'cors'
  ];
  
  requiredDeps.forEach(dep => {
    const installed = packageJson.dependencies && packageJson.dependencies[dep];
    console.log(`${installed ? '✅' : '❌'} ${dep}`);
  });
} catch (error) {
  console.log('❌ Error reading package.json');
}

console.log('\n🔧 Configuration check...');
const envExists = fs.existsSync('.env');
console.log(`${envExists ? '✅' : '⚠️'} .env file ${envExists ? 'exists' : 'missing (copy from .env.example)'}`);

console.log('\n📚 Documentation...');
const readmeExists = fs.existsSync('README.md');
console.log(`${readmeExists ? '✅' : '❌'} README.md`);

console.log('\n🎯 Setup Status:');
if (allFilesExist) {
  console.log('✅ All core files are present');
  console.log('✅ Project structure is correct');
  console.log('\n🚀 Next steps:');
  console.log('1. Copy .env.example to .env and add your API keys');
  console.log('2. Run: npm run migrate');
  console.log('3. Run: npm start');
  console.log('\n🏆 You\'re ready to dominate your fantasy league!');
} else {
  console.log('❌ Some files are missing - please check the setup');
}

console.log('\n📖 Quick Start Commands:');
console.log('  npm run migrate    # Setup database');
console.log('  npm run dev       # Start in development mode');
console.log('  npm start         # Start in production mode');
console.log('  npm test          # Run tests');

console.log('\n🔗 API Endpoints (when running):');
console.log('  GET  /health              # System status');
console.log('  POST /draft/start         # Start draft monitoring');
console.log('  POST /notifications/test  # Test Discord alerts');