// Load environment variables
require('dotenv').config();

const DiscordAIBot = require('./src/discord-ai-bot');

async function startDiscordBot() {
  console.log('🤖 Starting Fantasy AI Discord Chat Bot...\n');
  
  // Debug environment variables in production
  if (process.env.NODE_ENV === 'production') {
    console.log('🔍 Environment check:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- Discord Token:', process.env.DISCORD_BOT_TOKEN ? '✅ Found' : '❌ Missing');
    console.log('- Claude API Key:', process.env.CLAUDE_API_KEY ? '✅ Found' : '❌ Missing');
  }
  
  // Check if Discord.js is installed
  try {
    require('discord.js');
  } catch (error) {
    console.log('❌ discord.js not installed. Installing now...');
    const { execSync } = require('child_process');
    try {
      execSync('npm install discord.js', { stdio: 'inherit' });
      console.log('✅ discord.js installed successfully!\n');
    } catch (installError) {
      console.error('❌ Failed to install discord.js. Please run: npm install discord.js');
      process.exit(1);
    }
  }
  
  // Check for bot token
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.log('❌ Missing DISCORD_BOT_TOKEN in .env file');
    console.log('\n📋 Setup Instructions:');
    console.log('1. Go to https://discord.com/developers/applications');
    console.log('2. Create a new application called "Fantasy AI Coach"');
    console.log('3. Go to Bot section and copy the Bot Token');
    console.log('4. Add to .env file: DISCORD_BOT_TOKEN=your_token_here');
    console.log('5. Add bot to your Discord server with Send Messages permission');
    console.log('\n📖 See DISCORD-AI-CHAT-BOT-GUIDE.txt for complete setup');
    return;
  }
  
  const bot = new DiscordAIBot();
  
  try {
    const started = await bot.start();
    
    if (started) {
      console.log('🎉 SUCCESS! Fantasy AI Chat Bot is running!');
      console.log('\n💬 How to use in Discord:');
      console.log('   !coach Should I draft Josh Jacobs?');
      console.log('   !coach Weather impact for Bills game?');
      console.log('   @Fantasy AI Coach Trade advice needed');
      console.log('\n📱 The bot works in these channels:');
      console.log('   - #draft-central');
      console.log('   - #ai-analysis');
      console.log('   - #league-intelligence');
      console.log('   - #general');
      console.log('\n🆘 Type "!coach help" in Discord for more commands');
      console.log('\n⚡ Your Fantasy Command Center is now FULLY INTERACTIVE!');
      
      // Keep the process running
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down Discord bot...');
        await bot.stop();
        process.exit(0);
      });
      
    } else {
      console.log('❌ Failed to start Discord bot. Check your bot token and permissions.');
    }
    
  } catch (error) {
    console.error('❌ Error starting Discord bot:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Verify DISCORD_BOT_TOKEN is correct');
    console.log('2. Ensure bot has been added to your Discord server');
    console.log('3. Check bot permissions (Send Messages, Read Message History)');
    console.log('4. Verify you have discord.js installed: npm install discord.js');
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

startDiscordBot();