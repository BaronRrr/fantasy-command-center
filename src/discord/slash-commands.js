const { SlashCommandBuilder } = require('discord.js');

// Define all slash commands for the Fantasy Command Center
const commands = [
  // News command
  new SlashCommandBuilder()
    .setName('news')
    .setDescription('Get latest fantasy football news articles with AI summaries'),

  // Draft management commands
  new SlashCommandBuilder()
    .setName('draft')
    .setDescription('Draft a player to your team')
    .addStringOption(option =>
      option.setName('player')
        .setDescription('Player name (e.g., "Josh Jacobs")')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('analyze')
    .setDescription('Get AI analysis of your current draft situation'),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear all draft data and start fresh'),

  // Team management
  new SlashCommandBuilder()
    .setName('team')
    .setDescription('View your current team roster'),

  // Player information
  new SlashCommandBuilder()
    .setName('player')
    .setDescription('Get detailed information about a specific player')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Player name to look up')
        .setRequired(true)),

  // Draft import
  new SlashCommandBuilder()
    .setName('import')
    .setDescription('Import draft data from ESPN (paste draft board text)')
    .addStringOption(option =>
      option.setName('data')
        .setDescription('Paste your ESPN draft data here')
        .setRequired(true)),

  // Intel command
  new SlashCommandBuilder()
    .setName('intel')
    .setDescription('Get player intelligence and breaking news')
    .addStringOption(option =>
      option.setName('player')
        .setDescription('Player name for specific intel')
        .setRequired(false)),

  // Injury monitoring commands
  new SlashCommandBuilder()
    .setName('injury')
    .setDescription('Check injury reports and status')
    .addStringOption(option =>
      option.setName('player')
        .setDescription('Specific player to check (optional)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('trending')
    .setDescription('Get trending players from social media and news'),

  // Help command
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands and how to use them'),

  // Admin/testing commands
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check Fantasy Command Center system status'),

  new SlashCommandBuilder()
    .setName('update')
    .setDescription('Manually trigger data updates (injuries, news, etc.)'),

  // Trade analysis command
  new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Get AI-powered trade analysis and suggestions')
    .addStringOption(option =>
      option.setName('analysis_type')
        .setDescription('Type of trade analysis to perform')
        .setRequired(false)
        .addChoices(
          { name: 'Full Analysis', value: 'full' },
          { name: 'Quick Suggestions', value: 'quick' },
          { name: 'League Context', value: 'context' }
        ))
];

module.exports = {
  commands: commands.map(command => command.toJSON()),
  
  // Command handlers
  async handleSlashCommand(interaction, discordBot) {
    const { commandName, options, user } = interaction;
    const username = user.username;

    try {
      switch (commandName) {
        case 'news':
          await interaction.deferReply();
          const newsResult = await discordBot.handleNewsCommand(username);
          await interaction.editReply(newsResult);
          break;

        case 'draft':
          await interaction.deferReply();
          const playerName = options.getString('player');
          const draftResult = await discordBot.processDotCommand(`.my ${playerName}`, username);
          await interaction.editReply(draftResult);
          break;

        case 'analyze':
          await interaction.deferReply();
          const analyzeResult = await discordBot.processDotCommand('.analyze', username);
          await interaction.editReply(analyzeResult);
          break;

        case 'clear':
          await interaction.deferReply();
          const clearResult = await discordBot.processDotCommand('.clear', username);
          await interaction.editReply(clearResult);
          break;

        case 'team':
          await interaction.deferReply();
          const teamResult = await discordBot.showUserTeam(username);
          await interaction.editReply(teamResult);
          break;

        case 'player':
          await interaction.deferReply();
          const playerName2 = options.getString('name');
          const playerResult = await discordBot.processDotCommand(`.intel ${playerName2}`, username);
          await interaction.editReply(playerResult);
          break;

        case 'import':
          await interaction.deferReply();
          const importData = options.getString('data');
          const importResult = await discordBot.importDraftBoard(importData, username);
          await interaction.editReply(importResult);
          break;

        case 'intel':
          await interaction.deferReply();
          const playerName3 = options.getString('player') || '';
          const intelResult = await discordBot.processDotCommand(`.intel ${playerName3}`.trim(), username);
          await interaction.editReply(intelResult);
          break;

        case 'help':
          const helpResult = await discordBot.getSlashCommandHelp();
          await interaction.reply(helpResult);
          break;

        case 'status':
          const statusResult = await discordBot.getSystemStatus();
          await interaction.reply(statusResult);
          break;

        case 'injury':
          await interaction.deferReply();
          const playerName4 = options.getString('player');
          const injuryResult = await discordBot.handleInjuryCommand(playerName4);
          await interaction.editReply(injuryResult);
          break;

        case 'trending':
          await interaction.deferReply();
          const trendingResult = await discordBot.handleTrendingCommand();
          await interaction.editReply(trendingResult);
          break;

        case 'trade':
          await interaction.deferReply();
          const analysisType = options.getString('analysis_type') || 'full';
          const tradeResult = await discordBot.handleTradeCommand(`.trade ${analysisType}`, username);
          await interaction.editReply(tradeResult);
          break;

        case 'update':
          await interaction.deferReply();
          const updateResult = await discordBot.processDotCommand('.update', username);
          await interaction.editReply(updateResult);
          break;

        default:
          await interaction.reply({
            content: '❓ Unknown command. Use `/help` to see available commands.',
            ephemeral: true
          });
      }
    } catch (error) {
      console.error(`Error handling slash command ${commandName}:`, error);
      
      const errorMessage = '🚨 Sorry, I encountered an error processing your request. Please try again!';
      
      if (interaction.deferred) {
        await interaction.editReply(errorMessage);
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }
};