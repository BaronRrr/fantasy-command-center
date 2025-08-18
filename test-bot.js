require('dotenv').config();
const DiscordAIBot = require('./src/discord-ai-bot');

async function startBot() {
  console.log('🤖 Starting Discord AI Bot...');
  
  const bot = new DiscordAIBot();
  
  try {
    await bot.start();
    console.log('✅ Discord AI Bot started successfully!');
  } catch (error) {
    console.error('❌ Failed to start Discord AI Bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

startBot();