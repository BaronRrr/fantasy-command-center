const { REST, Routes } = require('discord.js');
const { commands } = require('./slash-commands');
const { config } = require('../../config/config');

async function registerSlashCommands() {
  console.log('🔄 Registering Discord slash commands...');

  const rest = new REST({ version: '10' }).setToken(config.discord.botToken);

  try {
    // Get application ID from environment variable or extract from token
    const clientId = process.env.DISCORD_APPLICATION_ID || 
                     Buffer.from(config.discord.botToken.split('.')[0], 'base64').toString();

    console.log(`📝 Registering ${commands.length} slash commands globally...`);

    // Register commands globally (works in all servers)
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    console.log(`✅ Successfully registered ${data.length} slash commands!`);
    
    // List registered commands
    console.log('📋 Registered commands:');
    data.forEach(cmd => {
      console.log(`   /${cmd.name} - ${cmd.description}`);
    });

    console.log('\n⚡ Commands will be available in Discord within 1-5 minutes');
    return true;

  } catch (error) {
    console.error('❌ Failed to register slash commands:', error);
    
    // Provide helpful error messages
    if (error.code === 50001) {
      console.log('💡 Bot token may be invalid. Check DISCORD_BOT_TOKEN in your environment.');
    } else if (error.code === 50013) {
      console.log('💡 Bot needs "applications.commands" scope. Re-invite bot with proper permissions.');
    }
    
    return false;
  }
}

// Allow running this script directly
if (require.main === module) {
  const { validateEnvironment } = require('../../config/config');
  
  try {
    validateEnvironment();
    registerSlashCommands().then(success => {
      process.exit(success ? 0 : 1);
    });
  } catch (error) {
    console.error('❌ Environment validation failed:', error.message);
    process.exit(1);
  }
}

module.exports = { registerSlashCommands };