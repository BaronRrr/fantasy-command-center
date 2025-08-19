// Load and validate environment configuration
const { validateEnvironment, config } = require('./config/config');
const HealthCheck = require('./src/health-check');
const DiscordAIBot = require('./src/discord-ai-bot');

async function startDiscordBot() {
  console.log('🤖 Starting Fantasy Command Center Discord Bot...\n');
  
  // Validate environment variables first
  try {
    validateEnvironment();
  } catch (error) {
    console.error('❌ Environment validation failed:', error.message);
    process.exit(1);
  }
  
  // Initialize health check server
  const healthCheck = new HealthCheck();
  healthCheck.start(config.app.port);
  
  // Debug environment variables in production
  if (config.app.nodeEnv === 'production') {
    console.log('🔍 Production environment validated');
    console.log('- Discord Token: ✅ Found');
    console.log('- Claude API Key: ✅ Found');
    console.log('- Health Check: ✅ Running on port', config.app.port);
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
  
  const bot = new DiscordAIBot();
  
  try {
    const started = await bot.start();
    
    if (started) {
      // Update health check status
      healthCheck.updateDiscordStatus(true);
      healthCheck.updateSchedulerStatus(true, 1);
      
      console.log('🎉 SUCCESS! Fantasy Command Center is ONLINE!');
      console.log('\n💬 Discord Bot Commands:');
      console.log('   .news        - Latest fantasy news articles');
      console.log('   .my Player   - Add player to your team');
      console.log('   .analyze     - AI draft analysis');
      console.log('   .clear       - Reset draft data');
      console.log('   .help        - Show all commands');
      console.log('\n📱 Active Channels:');
      console.log('   - #draft-central (main commands)');
      console.log('   - #ai-analysis (in-depth analysis)');
      console.log('   - #newsarticles (automated news)');
      console.log('\n🏥 Health Check Endpoints:');
      console.log(`   - http://localhost:${config.app.port}/health`);
      console.log(`   - http://localhost:${config.app.port}/ready`);
      console.log(`   - http://localhost:${config.app.port}/status`);
      console.log('\n⚡ 24/7 Fantasy Intelligence Active!');
      
      // Graceful shutdown handling
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down Fantasy Command Center...');
        healthCheck.updateDiscordStatus(false);
        healthCheck.stop();
        await bot.stop();
        console.log('✅ Shutdown complete');
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down...');
        healthCheck.updateDiscordStatus(false);
        healthCheck.stop();
        await bot.stop();
        process.exit(0);
      });
      
    } else {
      healthCheck.updateDiscordStatus(false);
      console.log('❌ Failed to start Discord bot. Check configuration.');
    }
    
  } catch (error) {
    healthCheck.updateDiscordStatus(false);
    console.error('❌ Error starting Discord bot:', error.message);
    console.log('\n🔧 Check Railway logs for detailed error information');
    
    // Send error alert if ops webhook configured
    if (process.env.DISCORD_OPS_WEBHOOK) {
      const discordUtils = require('./src/utils/discord-utils');
      await discordUtils.sendErrorAlert(error, { 
        service: 'discord-bot-startup',
        environment: config.app.nodeEnv 
      });
    }
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