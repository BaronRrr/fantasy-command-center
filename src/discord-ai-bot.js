const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const ClaudeAI = require('./api/claude-ai');
const ExternalAPIsClient = require('./api/external-apis');
const FantasyKnowledgeEnhancer = require('./knowledge/fantasy-enhancer');
const ESPNPublicAPI = require('./api/espn-public-api');
const LiveDraftAnalyzer = require('./discord/live-draft-analyzer');
const TwitterMonitor = require('./monitoring/twitter-monitor');
const AdvancedDataMonitor = require('./monitoring/advanced-data-monitor');
const ScheduledNotifications = require('./monitoring/scheduled-notifications');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class DiscordAIBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    
    this.claude = new ClaudeAI();
    this.externalAPIs = new ExternalAPIsClient();
    this.knowledgeEnhancer = new FantasyKnowledgeEnhancer();
    this.espnAPI = new ESPNPublicAPI();
    this.draftAnalyzer = new LiveDraftAnalyzer();
    this.twitterMonitor = new TwitterMonitor();
    this.dataMonitor = new AdvancedDataMonitor();
    this.scheduledNotifications = new ScheduledNotifications();
    
    // Bot configuration
    this.botToken = process.env.DISCORD_BOT_TOKEN;
    this.commandPrefix = '!coach';
    this.allowedChannels = [
      'draft-central',
      'ai-analysis', 
      'league-intelligence',
      'general'
    ];
    
    // Draft state for manual tracking
    this.draftState = null;
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.on('ready', () => {
      logger.info(`🤖 Fantasy AI Coach is online as ${this.client.user.tag}!`);
      this.client.user.setActivity('Fantasy Football | Type !coach help', { type: 'WATCHING' });
    });

    this.client.on('messageCreate', async (message) => {
      await this.handleMessage(message);
    });

    this.client.on('error', (error) => {
      logger.error('Discord client error:', error);
    });
  }

  async handleMessage(message) {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Check if message is in allowed channels
    if (!this.allowedChannels.includes(message.channel.name)) return;
    
    // Check if message starts with command prefix, mentions the bot, or uses dot commands
    const content = message.content.toLowerCase();
    const mentionsBot = message.mentions.has(this.client.user);
    const startsWithPrefix = content.startsWith(this.commandPrefix);
    const isDotCommand = message.content.startsWith('.');
    
    if (!startsWithPrefix && !mentionsBot && !isDotCommand) return;
    
    try {
      // Show typing indicator
      await message.channel.sendTyping();
      
      // Handle dot commands first
      if (isDotCommand) {
        const response = await this.handleDotCommand(message, message.content);
        await message.reply(response);
        return;
      }
      
      // Extract the actual question
      let question = message.content;
      if (startsWithPrefix) {
        question = question.substring(this.commandPrefix.length).trim();
      }
      if (mentionsBot) {
        question = question.replace(/<@!?\d+>/g, '').trim();
      }
      
      // Handle specific commands
      if (question.toLowerCase().includes('help')) {
        await this.sendHelpMessage(message);
        return;
      }

      // Handle draft commands
      if (question.toLowerCase().includes('draft connect') || question.toLowerCase().includes('connect draft')) {
        await this.handleDraftConnect(message, question);
        return;
      }

      if (question.toLowerCase().includes('draft') && (question.toLowerCase().includes('who') || question.toLowerCase().includes('next') || question.toLowerCase().includes('recommend'))) {
        await this.handleDraftRecommendation(message);
        return;
      }

      if (question.toLowerCase().includes('draft refresh') || question.toLowerCase().includes('refresh draft')) {
        await this.handleDraftRefresh(message);
        return;
      }
      
      // Process the fantasy football question
      const response = await this.processFantasyQuestion(question, message);
      await this.sendResponse(message, response);
      
    } catch (error) {
      logger.error('Error processing message:', error);
      await message.reply('🚨 Sorry, I encountered an error processing your request. Please try again!');
    }
  }

  async processFantasyQuestion(question, message) {
    try {
      // Gather context for better AI responses
      const context = await this.gatherContext(question);
      
      // Create comprehensive prompt for Claude
      const prompt = this.buildFantasyPrompt(question, context, message.author.username);
      
      // Get AI response
      const aiResponse = await this.claude.makeRequest([
        {
          role: 'user',
          content: prompt
        }
      ], this.getSystemPrompt());
      
      return this.parseAIResponse(aiResponse);
      
    } catch (error) {
      logger.error('Error processing fantasy question:', error);
      return {
        title: '🚨 Error',
        description: 'I encountered an issue analyzing your question. Please try rephrasing it!',
        color: 0xFF0000
      };
    }
  }

  async gatherContext(question) {
    const context = {
      timestamp: new Date().toISOString(),
      currentWeek: this.getCurrentNFLWeek(),
      isDraftSeason: this.isDraftSeason()
    };
    
    // If question mentions specific players, get their news
    const playerNames = this.extractPlayerNames(question);
    if (playerNames.length > 0) {
      context.playerNews = {};
      for (const player of playerNames.slice(0, 3)) { // Limit to prevent API overuse
        try {
          const news = await this.externalAPIs.getPlayerNews(player, 3);
          context.playerNews[player] = news;
        } catch (error) {
          logger.debug(`Failed to get news for ${player}:`, error.message);
        }
      }
    }
    
    // If question mentions weather/games, get weather data
    if (question.toLowerCase().includes('weather') || question.toLowerCase().includes('game')) {
      try {
        context.weatherReport = await this.externalAPIs.getGameWeather(context.currentWeek);
      } catch (error) {
        logger.debug('Failed to get weather data:', error.message);
      }
    }

    // Get real-time NFL news and scores
    try {
      if (question.toLowerCase().includes('news') || question.toLowerCase().includes('injury') || question.toLowerCase().includes('update')) {
        const fantasyNews = await this.espnAPI.getFantasyRelevantNews();
        context.liveNews = fantasyNews.slice(0, 5); // Latest 5 articles
      }
      
      if (question.toLowerCase().includes('score') || question.toLowerCase().includes('game') || question.toLowerCase().includes('result')) {
        const games = await this.espnAPI.getScoreboard();
        context.liveScores = games.slice(0, 10); // Recent games
      }
    } catch (error) {
      logger.debug('Failed to get live ESPN data:', error.message);
    }
    
    // Search knowledge base for relevant articles and draft data
    try {
      const knowledgeResults = await this.knowledgeEnhancer.searchKnowledge(question);
      if (knowledgeResults.length > 0) {
        context.knowledgeBase = knowledgeResults.slice(0, 3).map(result => ({
          type: result.type,
          title: result.title || result.source,
          content: result.content?.substring(0, 300) || 'ADP data available',
          source: result.source,
          relevance: result.relevance
        }));
      }
      
      // Get draft comparisons for mentioned players
      for (const player of playerNames) {
        try {
          const comparisons = await this.knowledgeEnhancer.getPlayerDraftComparison(player);
          if (comparisons.length > 0) {
            context.draftComparisons = context.draftComparisons || {};
            context.draftComparisons[player] = comparisons.slice(0, 3);
          }
        } catch (error) {
          logger.debug(`Failed to get draft comparison for ${player}:`, error.message);
        }
      }
    } catch (error) {
      logger.debug('Failed to search knowledge base:', error.message);
    }
    
    return context;
  }

  buildFantasyPrompt(question, context, username) {
    return `Fantasy Football AI Coach Request:

USER: ${username}
QUESTION: "${question}"

CONTEXT:
- Current Date: ${context.timestamp}
- NFL Week: ${context.currentWeek}
- Draft Season: ${context.isDraftSeason}
${context.playerNews ? `- Player News Available: ${Object.keys(context.playerNews).join(', ')}` : ''}
${context.weatherReport ? `- Weather Data: Available for ${context.weatherReport.length} games` : ''}
${context.knowledgeBase ? `- Knowledge Base: ${context.knowledgeBase.length} relevant articles found` : ''}

IMPORTANT DRAFT GUIDELINES:
- PRIORITIZE ESPN 2025 projections and ADP data above all else
- For first pick questions: Only recommend consensus top 3 players (McCaffrey, Jefferson, Hill, Kupp tier)
- Always cite specific ranking/projection data when making recommendations
- Be conservative with risky picks - emphasize proven performers
- Factor in injury history and team changes for 2025 season

Please provide a helpful, detailed fantasy football response that:
1. Directly answers their question with ESPN 2025 data emphasis
2. Provides specific reasoning citing rankings/projections/ADP
3. Includes actionable advice based on proven data
4. Uses context data when relevant
5. Keeps response under 1500 characters for Discord
6. ONLY include articleLinks if you have real, helpful URLs - do not include example links

${context.knowledgeBase && context.knowledgeBase.length > 0 ? `
RELEVANT KNOWLEDGE BASE ARTICLES:
${context.knowledgeBase.map(article => `- ${article.title} (${article.source}): ${article.content.substring(0, 200)}...`).join('\n')}
` : ''}

Format your response as JSON:
{
  "title": "Brief title for the response",
  "description": "Main response content with analysis",
  "fields": [
    {"name": "Field Title", "value": "Field content", "inline": true}
  ],
  "color": "hex color code (without #)",
  "footer": "Based on ESPN 2025 projections and historical data"
}

CRITICAL: Only include "articleLinks" field if you have real, working URLs. Do not include example or placeholder links.`;
  }

  getSystemPrompt() {
    return `You are an elite Fantasy Football AI Coach with deep expertise in ESPN 2025 fantasy projections and data-driven analysis. You provide expert analysis, player recommendations, and strategic advice based on:

- ESPN 2025 player projections and rankings (PRIMARY SOURCE)
- Historical performance data and consistency metrics
- Injury reports and recovery timelines
- Team context and coaching changes for 2025
- Weather effects on games
- Draft strategy and ADP (Average Draft Position) data
- Start/sit decisions based on matchups
- Trade value analysis using multiple season data

DRAFT PHILOSOPHY:
- For #1 overall pick: Only recommend proven elite RB1s or WR1s (McCaffrey, Jefferson tier players)
- Always emphasize players with multiple top-5 finishes
- Factor in age, injury history, and team stability
- Be conservative with rookies or players coming off down seasons
- Cite specific ESPN projections, ADP ranges, and ranking data

Always be:
- Data-driven with specific ESPN 2025 projections
- Conservative with high-stakes picks (early rounds)
- Specific with reasoning including numbers/stats
- Professional but conversational
- Honest about player risks and concerns

CRITICAL: Never include fake or example links. Only include real article URLs if available.

Respond in JSON format for Discord embeds.`;
  }

  parseAIResponse(aiResponse) {
    try {
      // Extract content from Claude's response
      let content;
      if (aiResponse.content && aiResponse.content[0]) {
        content = aiResponse.content[0].text;
      } else if (typeof aiResponse === 'string') {
        content = aiResponse;
      } else if (aiResponse.text) {
        content = aiResponse.text;
      } else {
        throw new Error('Unknown response format');
      }
      
      // Try to parse as JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Convert color to number if it's a string
        if (parsed.color && typeof parsed.color === 'string') {
          parsed.color = parseInt(parsed.color, 16);
        }
        
        // Remove example or fake links
        if (parsed.articleLinks && Array.isArray(parsed.articleLinks)) {
          parsed.articleLinks = parsed.articleLinks.filter(link => 
            link && 
            typeof link === 'string' && 
            !link.includes('example.com') && 
            !link.includes('url1.com') && 
            !link.includes('url2.com') &&
            link.startsWith('http')
          );
          
          // Remove articleLinks if empty
          if (parsed.articleLinks.length === 0) {
            delete parsed.articleLinks;
          }
        }
        
        return parsed;
      }
      
      // Fallback if not JSON
      return {
        title: '🤖 Fantasy AI Coach',
        description: content.substring(0, 1500),
        color: 0x0099FF
      };
      
    } catch (error) {
      logger.error('Error parsing AI response:', error);
      return {
        title: '🤖 Fantasy AI Coach',
        description: 'I have some thoughts on your question, but had trouble formatting them. Please try asking again!',
        color: 0xFF8800
      };
    }
  }

  async sendResponse(message, response) {
    const embed = new EmbedBuilder()
      .setTitle(response.title || '🤖 Fantasy AI Coach')
      .setDescription(response.description || 'No response generated')
      .setColor(response.color || 0x0099FF)
      .setTimestamp()
      .setFooter({ 
        text: response.footer || 'Fantasy Command Center AI Coach',
        iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
      });

    // Add fields if provided
    if (response.fields && Array.isArray(response.fields)) {
      response.fields.forEach(field => {
        embed.addFields({
          name: field.name,
          value: field.value,
          inline: field.inline || false
        });
      });
    }

    // Add article links if provided
    if (response.articleLinks && Array.isArray(response.articleLinks)) {
      const linksText = response.articleLinks.map((link, index) => 
        `[📰 Article ${index + 1}](${link})`
      ).join(' • ');
      embed.addFields({
        name: '📚 Related Articles',
        value: linksText,
        inline: false
      });
    }

    await message.reply({ embeds: [embed] });
  }

  async sendHelpMessage(message) {
    const helpEmbed = new EmbedBuilder()
      .setTitle('🤖 Fantasy AI Coach - Help')
      .setDescription('I\'m your personal Fantasy Football AI assistant! Here\'s how to use me:')
      .setColor(0x00FF00)
      .addFields(
        {
          name: '💬 How to Ask Questions',
          value: '`!coach [your question]` or `@Fantasy AI Coach [question]`',
          inline: false
        },
        {
          name: '🎯 Example Questions',
          value: '• "Should I draft Josh Jacobs or DeVonta Smith?"\n• "Is Christian McCaffrey worth the #1 pick?"\n• "Weather impact for Bills vs Dolphins?"\n• "Trade advice: my Kelce for their Jefferson?"',
          inline: false
        },
        {
          name: '🚀 Live Draft Commands',
          value: '• `!coach draft connect` - Connect to your ESPN draft\n• `!coach draft connect 356030745` - Connect with league ID\n• `!coach who should I draft` - Get real-time pick advice\n• `!coach when should I draft QB` - Position strategy\n• `!coach draft refresh` - Update draft state',
          inline: false
        },
        {
          name: '📊 What I Can Do',
          value: '• Draft recommendations with reasoning\n• Start/sit advice\n• Trade analysis\n• Injury impact assessment\n• Weather game analysis\n• Player comparisons',
          inline: false
        },
        {
          name: '⚡ Real-Time Data',
          value: 'I have access to live player news, weather reports, and injury updates!',
          inline: false
        }
      )
      .setFooter({ text: 'Fantasy Command Center AI Coach' })
      .setTimestamp();

    await message.reply({ embeds: [helpEmbed] });
  }

  // Helper methods
  extractPlayerNames(text) {
    // Simple player name extraction - could be enhanced with a player database
    const commonNames = [
      'Josh Allen', 'Christian McCaffrey', 'Cooper Kupp', 'Travis Kelce',
      'Josh Jacobs', 'DeVonta Smith', 'George Kittle', 'Tyreek Hill',
      'Davante Adams', 'Aaron Rodgers', 'Tom Brady', 'Patrick Mahomes'
    ];
    
    return commonNames.filter(name => 
      text.toLowerCase().includes(name.toLowerCase())
    );
  }

  getCurrentNFLWeek() {
    // Simple week calculation - could be enhanced with actual NFL calendar
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 8, 1); // September 1st
    const diffTime = Math.abs(now - seasonStart);
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    return Math.min(Math.max(diffWeeks, 1), 18);
  }

  isDraftSeason() {
    const now = new Date();
    const month = now.getMonth();
    return month >= 6 && month <= 8; // July, August, September
  }

  async start() {
    if (!this.botToken) {
      logger.error('DISCORD_BOT_TOKEN not provided. Cannot start Discord AI bot.');
      return false;
    }

    try {
      await this.client.login(this.botToken);
      
      // Start Twitter monitoring and learning
      await this.startTwitterLearning();
      
      // Start scheduled notifications (24/7 monitoring)
      if (process.env.NODE_ENV === 'production') {
        this.scheduledNotifications.start();
        logger.info('🔔 Scheduled notifications started for 24/7 monitoring');
      }
      
      logger.info('Discord AI Bot started successfully with full intelligence suite');
      return true;
    } catch (error) {
      logger.error('Failed to start Discord AI bot:', error);
      return false;
    }
  }

  async startTwitterLearning() {
    try {
      // Start Twitter monitoring for real-time updates
      await this.twitterMonitor.startMonitoring();
      
      // Set up periodic AI learning every 10 minutes
      setInterval(async () => {
        try {
          await this.twitterMonitor.performPeriodicAILearning();
          logger.debug('🧠 Completed background AI learning from Twitter');
        } catch (error) {
          logger.error('Background AI learning failed:', error.message);
        }
      }, 10 * 60 * 1000); // 10 minutes
      
      logger.info('🐦 Twitter intelligence system active');
      
    } catch (error) {
      logger.error('Failed to start Twitter learning:', error.message);
    }
  }

  async handleDraftConnect(message, question) {
    try {
      // Extract league ID from message if provided
      const leagueIdMatch = question.match(/(\d{9,12})/);
      const leagueId = leagueIdMatch ? leagueIdMatch[1] : null;

      const result = await this.draftAnalyzer.startDraftSession(leagueId, message.author.id);
      
      if (result.success) {
        const embed = new EmbedBuilder()
          .setTitle('🚀 Live Draft Connected!')
          .setDescription(result.message)
          .setColor(0x00FF00)
          .addFields(
            { name: 'League', value: result.draftInfo?.leagueName || 'Connected', inline: true },
            { name: 'Teams', value: `${result.draftInfo?.size || 'N/A'}`, inline: true },
            { name: 'Format', value: result.draftInfo?.scoringType || 'Standard', inline: true }
          )
          .addFields({
            name: '🎯 Available Commands',
            value: '• `!coach who should I draft` - Get real-time pick recommendations\n• `!coach draft refresh` - Update draft state\n• `!coach when should I draft QB` - Position strategy advice',
            inline: false
          })
          .setFooter({ text: 'Live draft analysis powered by ESPN 2025 projections' })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setTitle('❌ Draft Connection Failed')
          .setDescription(result.message)
          .setColor(0xFF0000)
          .addFields({
            name: '💡 Tips',
            value: '• Make sure your draft is currently active\n• Use: `!coach draft connect 356030745` (with your league ID)\n• Check that league settings allow API access',
            inline: false
          });

        await message.reply({ embeds: [embed] });
      }
    } catch (error) {
      logger.error('Error handling draft connect:', error);
      await message.reply('❌ Failed to connect to draft. Please try again!');
    }
  }

  async handleDraftRecommendation(message) {
    try {
      const userId = message.author.id;
      const analysis = await this.draftAnalyzer.getNextPickAdvice(userId);

      if (analysis.error) {
        const embed = new EmbedBuilder()
          .setTitle('❌ No Active Draft Session')
          .setDescription(analysis.error)
          .setColor(0xFF8800)
          .addFields({
            name: '🔗 Connect to Draft',
            value: 'Use `!coach draft connect` or `!coach draft connect [league-id]` first!',
            inline: false
          });

        await message.reply({ embeds: [embed] });
        return;
      }

      // Build recommendation embed
      const embed = new EmbedBuilder()
        .setTitle(analysis.isYourTurn ? '🎯 YOUR PICK - Draft Recommendation' : '📊 Draft Analysis')
        .setDescription(analysis.isYourTurn ? '**It\'s your turn to pick!**' : `**Pick ${analysis.draftPosition.overall}** - Round ${analysis.draftPosition.round}`)
        .setColor(analysis.isYourTurn ? 0xFF6B35 : 0x4A90E2)
        .setTimestamp();

      // Add current team info
      if (analysis.myTeam && analysis.myTeam.roster.length > 0) {
        const rosterText = analysis.myTeam.roster.map(player => 
          `${player.name} (${player.position})`
        ).slice(0, 5).join('\n') + (analysis.myTeam.roster.length > 5 ? `\n... +${analysis.myTeam.roster.length - 5} more` : '');
        
        embed.addFields({
          name: '👥 Your Current Team',
          value: rosterText || 'No picks yet',
          inline: false
        });
      }

      // Add top recommendations
      if (analysis.recommendations && analysis.recommendations.length > 0) {
        const recText = analysis.recommendations.slice(0, 3).map((rec, i) => 
          `${i + 1}. **${rec.player}** (${rec.position}, ${rec.team})\n   ${rec.urgency} Priority - ${rec.reasoning.substring(0, 80)}...`
        ).join('\n\n');

        embed.addFields({
          name: '🏆 Top Recommendations',
          value: recText,
          inline: false
        });
      }

      // Add steal opportunities
      if (analysis.steals && analysis.steals.length > 0) {
        const stealsText = analysis.steals.slice(0, 2).map(steal => 
          `**${steal.player}** - ${steal.reasoning.substring(0, 60)}...`
        ).join('\n');

        embed.addFields({
          name: '💎 Value Picks Available',
          value: stealsText,
          inline: true
        });
      }

      // Add threats (players likely to be taken)
      if (analysis.threats && analysis.threats.length > 0) {
        const threatsText = analysis.threats.slice(0, 2).map(threat => 
          `**${threat.player}** (${threat.likelihood} chance)`
        ).join('\n');

        embed.addFields({
          name: '⚠️ May Be Taken Soon',
          value: threatsText,
          inline: true
        });
      }

      // Add strategy advice
      if (analysis.strategy && analysis.strategy.nextRound) {
        embed.addFields({
          name: '🎯 Strategy Advice',
          value: `Focus: **${analysis.strategy.nextRound}**\n${analysis.strategy.reasoning?.substring(0, 100)}...`,
          inline: false
        });
      }

      embed.setFooter({ text: 'Based on ESPN 2025 projections • Live draft analysis' });

      await message.reply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error handling draft recommendation:', error);
      await message.reply('❌ Failed to analyze draft. Try `!coach draft refresh` to reconnect.');
    }
  }

  async handleDraftRefresh(message) {
    try {
      const userId = message.author.id;
      // Refresh the draft session
      const analysis = await this.draftAnalyzer.getNextPickAdvice(userId);
      
      if (analysis.error) {
        await message.reply('❌ No active draft session to refresh. Use `!coach draft connect` first!');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🔄 Draft Refreshed')
        .setDescription('✅ Updated with latest draft state!')
        .setColor(0x00FF00)
        .addFields({
          name: 'Current Status',
          value: `Pick ${analysis.draftPosition.overall} (Round ${analysis.draftPosition.round})\n${analysis.isYourTurn ? '🎯 **Your turn!**' : '⏳ Waiting for other picks'}`,
          inline: false
        })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error refreshing draft:', error);
      await message.reply('❌ Failed to refresh draft state.');
    }
  }

  async handleDotCommand(message, content) {
    // Handle fast draft commands with dot syntax
    const command = content.trim();
    const username = message.author?.username || 'User';
    
    console.log(`📝 Processing dot command: "${command}" from ${username}`);
    
    // Initialize draft state if needed
    if (!this.draftState) {
      this.draftState = { picks: [], currentPick: 1, userTeam: 2, leagueSize: 8 };
    }
    
    // Parse different dot command formats
    if (command.startsWith('.my ')) {
      return await this.handleMyPick(message, command.slice(4), username);
    } else if (command.startsWith('.force ')) {
      return await this.handleForcePick(message, command.slice(7), username);
    } else if (command.startsWith('.p ')) {
      return await this.handleTeamPick(message, command.slice(3), username);
    } else if (command.match(/^\.\d+ /)) {
      return await this.handleNumberedPick(message, command, username);
    } else if (command.startsWith('.catch ')) {
      return await this.handleBatchPicks(message, command.slice(7), username);
    } else if (command === '.who' || command === '.next') {
      return await this.handleWhoNext(message, username);
    } else if (command === '.analyze') {
      return await this.manualAnalysis(this.draftState, username);
    } else if (command === '.clear') {
      return this.clearDraft(username);
    } else if (command.startsWith('.team ')) {
      return this.setUserTeam(command.slice(6), username);
    } else if (command.startsWith('.import ')) {
      return this.importDraftBoard(command.slice(8), username);
    } else if (command.startsWith('. ')) {
      return this.importDraftBoard(command.slice(2), username);
    } else if (command === '.draft' || command === '.status') {
      return await this.handleDraftStatus(message, username);
    } else if (command === '.update') {
      return await this.handleDataUpdate(username);
    } else if (command.startsWith('.intel ')) {
      return await this.handleDraftIntelligence(command.slice(7), username);
    } else if (command === '.intel') {
      return await this.handleDraftIntelligence(null, username);
    } else if (command === '.monitor') {
      return this.getMonitoringStatus();
    } else if (command === '.news') {
      return await this.handleNewsCommand(username);
    } else if (command === '.help') {
      return this.getDotCommandHelp();
    } else {
      return "❓ Unknown dot command. Type `.help` for available commands.";
    }
  }

  async manualAnalysis(draftState, username) {
    try {
      if (!draftState || draftState.picks.length === 0) {
        return `📊 **MANUAL AI ANALYSIS**
        
🚫 No picks recorded yet! Use \`.my PlayerName\` to start drafting.

**Current Status:** Draft not started
**Next Action:** Record your first pick

Type \`.help\` for commands.`;
      }

      const teamAnalysis = this.analyzeTeamNeeds(draftState);
      const context = this.buildDraftContext(draftState);
      
      const prompt = `🎯 COMPREHENSIVE DRAFT ANALYSIS (Manual Request)

CURRENT TEAM COMPOSITION:
${teamAnalysis.rosterBreakdown}

TEAM NEEDS ANALYSIS:
${teamAnalysis.needs}

DRAFT PROGRESS:
- Total picks made: ${draftState.picks.length}
- Your picks: ${draftState.picks.filter(p => p.isUser).length}
- Next pick: #${draftState.currentPick}

Provide detailed analysis:
1. **ROSTER STRENGTHS:** What positions are you strong at?
2. **CRITICAL WEAKNESSES:** What gaps must be filled immediately?
3. **DRAFT STRATEGY:** Should you go BPA (best player available) or reach for need?
4. **TOP 5 TARGETS:** Specific players to target next with ADP/reasoning
5. **RISK ASSESSMENT:** Any concerns with current roster construction?

Use ESPN 2025 projections and ADP data. Be specific with player names and strategy.`;

      const analysis = await this.claude.makeRequest([{
        role: 'user',
        content: prompt
      }], this.buildFantasyPrompt('', context, username));

      const connectionStatus = `🔗 **Draft Connection:** Active (Pick #${draftState.currentPick} ready)\n🤖 **AI Tracking:** Monitoring team composition & needs\n\n`;
      
      console.log('🔍 Claude Manual Analysis Response:', JSON.stringify(analysis, null, 2));
      
      // Handle different response formats
      let analysisText = 'Analysis temporarily unavailable.';
      if (typeof analysis === 'string') {
        analysisText = analysis;
      } else if (analysis.content?.[0]?.text || analysis.text || analysis.message) {
        analysisText = analysis.content?.[0]?.text || analysis.text || analysis.message;
      }
      
      return `📊 **MANUAL AI ANALYSIS**\n\n${connectionStatus}${analysisText}`;

    } catch (error) {
      console.error('Error in manual analysis:', error);
      return '❌ Failed to generate analysis. Try again.';
    }
  }

  importDraftBoard(text, username) {
    try {
      if (!this.draftState) {
        this.draftState = { picks: [], currentPick: 1, userTeam: 2 };
      }

      console.log(`📋 Importing draft board by ${username}`);
      
      const lines = text.split('\n').filter(line => line.trim());
      let imported = 0;
      let errors = [];
      
      // Check for large imports that might hit Discord limits
      if (lines.length > 20) {
        return `⚠️ **Large Import Detected (${lines.length} lines)**

🚀 **For best results with large imports:**
1. Copy your ESPN draft data
2. Paste directly in Claude Code chat
3. Get instant full analysis without Discord limits

**Or continue here with smaller chunks (under 20 picks at a time)**

Currently imported: ${imported} picks`;
      }

      // Handle multiple ESPN formats
      for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i].trim();
        let pick = null;
        
        // Format 1: Try current line alone first
        pick = this.parseDraftLine(currentLine);
        
        // Format 2: If that fails, check for ESPN R#, P# format (2-line)
        if (!pick && i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.match(/R\d+.*P\d+.*-/)) {
            const combinedLine = `${currentLine}\n${nextLine}`;
            pick = this.parseDraftLine(combinedLine);
            if (pick) {
              i++; // Skip the next line since we used it
            }
          }
        }
        
        // Format 3: 4-line ESPN format (Player, Team, Position, DraftTeam)
        if (!pick && i + 3 < lines.length) {
          const line2 = lines[i + 1]?.trim();
          const line3 = lines[i + 2]?.trim();
          const line4 = lines[i + 3]?.trim();
          
          if (line2 && line3 && line4) {
            pick = this.parse4LineFormat(currentLine, line2, line3, line4);
            if (pick) {
              i += 3; // Skip the next 3 lines since we used them
            }
          }
        }
        
        if (pick) {
          this.draftState.picks.push(pick);
          imported++;
          this.draftState.currentPick = Math.max(this.draftState.currentPick, pick.pick + 1);
        } else if (currentLine && !currentLine.match(/R\d+.*P\d+.*-/) && !currentLine.match(/^(QB|RB|WR|TE|K|D\/ST)$/)) {
          // Only add to errors if it's not a pick info line or position line
          errors.push(currentLine);
        }
      }

      const { round, pickInRound } = this.getRoundAndPick(this.draftState.currentPick, this.draftState.leagueSize);
      
      // Show your picks
      const userPicks = this.draftState.picks.filter(pick => pick.isUser);
      let yourPicksText = '';
      if (userPicks.length > 0) {
        yourPicksText = `\n\n🎯 **YOUR PICKS (Team ${this.draftState.userTeam}):**\n${userPicks.map(pick => {
          const { round: pRound, pickInRound: pPick } = this.getRoundAndPick(pick.pick, this.draftState.leagueSize);
          return `• R${pRound}, P${pPick}: ${pick.player} (${pick.position}, ${pick.nflTeam})`;
        }).join('\n')}`;
      }
      
      let result = `📋 **DRAFT BOARD IMPORTED**

✅ **${imported} picks imported successfully**
📊 **Current pick:** #${this.draftState.currentPick} (Rnd ${round}, Pick ${pickInRound})${yourPicksText}`;

      if (errors.length > 0 && errors.length <= 3) {
        result += `\n\n⚠️ **Could not parse:**\n${errors.map(e => `• ${e}`).join('\n')}`;
      } else if (errors.length > 3) {
        result += `\n\n⚠️ **${errors.length} lines could not be parsed**`;
      }

      result += `\n\nUse \`.analyze\` for AI analysis or \`.draft\` to see current board.`;

      return result;

    } catch (error) {
      console.error('Error importing draft board:', error);
      return '❌ Failed to import draft board. Check format and try again.';
    }
  }

  parse4LineFormat(playerName, nflTeam, position, draftTeam) {
    // Format: 4-line ESPN format
    // Line 1: Bijan Robinson
    // Line 2: Atl  
    // Line 3: RB
    // Line 4: Baron's Best Team
    
    if (!playerName || !position || !draftTeam) return null;
    
    // Validate position
    const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST', 'DST'];
    if (!validPositions.includes(position.toUpperCase())) return null;
    
    const teamNumber = this.parseTeamName(draftTeam);
    const pickNumber = this.draftState.picks.length + 1;
    
    return {
      player: playerName.trim(),
      position: position.toUpperCase() === 'DST' ? 'D/ST' : position.toUpperCase(),
      nflTeam: nflTeam?.toUpperCase() || '',
      team: teamNumber,
      pick: pickNumber,
      timestamp: new Date(),
      isUser: teamNumber === this.draftState.userTeam || draftTeam.toLowerCase().includes("baron's best team"),
      imported: true,
      format: '4-line'
    };
  }

  parseDraftLine(line) {
    // Handle multiple formats:
    // Format 1: "Bijan Robinson / Atl RB\nR1, P1 - Michael's Monstrous Team"
    // Format 2: "1. Christian McCaffrey (RB, SF) - Team 1"  
    // Format 3: "Josh Allen QB BUF - Team 2"

    let player = '', position = '', team = '', pickNum = 1, draftTeam = 1;

    // Format 1: ESPN style with R#, P# - TeamName
    if (line.includes(' / ') && line.includes('R') && line.includes('P')) {
      const parts = line.split('\n');
      if (parts.length >= 2) {
        // Parse player: "Bijan Robinson / Atl RB"
        const playerLine = parts[0];
        const [nameTeam, pos] = playerLine.split(' / ');
        player = nameTeam.trim();
        
        if (pos) {
          const positionMatch = pos.match(/([A-Z]+)$/);
          position = positionMatch ? positionMatch[1] : '';
          const teamMatch = pos.match(/^([A-Z]{2,3})/);
          team = teamMatch ? teamMatch[1] : '';
        }

        // Parse pick info: "R1, P1 - Michael's Monstrous Team"
        const pickLine = parts[1];
        const roundMatch = pickLine.match(/R(\d+)/);
        const pickMatch = pickLine.match(/P(\d+)/);
        if (roundMatch && pickMatch) {
          const round = parseInt(roundMatch[1]);
          const pickInRound = parseInt(pickMatch[1]);
          // Calculate absolute pick number: (Round - 1) × LeagueSize + PickInRound
          const leagueSize = this.draftState?.leagueSize || 8;
          pickNum = (round - 1) * leagueSize + pickInRound;
        }

        const teamMatch = pickLine.match(/- (.+)$/);
        if (teamMatch) {
          draftTeam = this.parseTeamName(teamMatch[1]);
        }
      }
    }
    // Format 2: Numbered list format
    else if (line.match(/^\d+\./)) {
      const match = line.match(/^(\d+)\.\s*(.+?)\s*\(([^,]+),\s*([^)]+)\)\s*-\s*Team\s*(\d+)/);
      if (match) {
        pickNum = parseInt(match[1]);
        player = match[2].trim();
        position = match[3].trim();
        team = match[4].trim();
        draftTeam = parseInt(match[5]);
      }
    }
    // Format 3: Simple format
    else {
      const match = line.match(/^(.+?)\s+(QB|RB|WR|TE|K|D\/ST)\s+([A-Z]{2,4})\s*-\s*Team\s*(\d+)/i);
      if (match) {
        player = match[1].trim();
        position = match[2].toUpperCase();
        team = match[3].toUpperCase();
        draftTeam = parseInt(match[4]);
        pickNum = this.draftState.picks.length + 1;
      }
    }

    if (player && position) {
      return {
        player: player,
        position: position,
        nflTeam: team,
        team: draftTeam,
        pick: pickNum,
        timestamp: new Date(),
        isUser: draftTeam === this.draftState.userTeam || teamMatch?.[1]?.toLowerCase().includes("baron's best team"),
        imported: true
      };
    }

    return null;
  }

  parseTeamName(teamName) {
    const key = teamName.toLowerCase().trim();
    
    // Dynamic team mapping based on order of appearance
    if (!this.teamNameMap) {
      this.teamNameMap = {};
      this.nextTeamNumber = 1;
    }
    
    // Check if we already mapped this team name
    if (this.teamNameMap[key]) {
      return this.teamNameMap[key];
    }
    
    // Check for explicit team numbers first
    const teamNumberMatch = key.match(/team\s*(\d+)/);
    if (teamNumberMatch) {
      const teamNum = parseInt(teamNumberMatch[1]);
      this.teamNameMap[key] = teamNum;
      return teamNum;
    }
    
    // Known team mappings  
    const knownTeams = {
      "michael's monstrous team": 1,
      "baron's best team": 7,  // YOU are team 7
      "kodak red": 3
    };
    
    if (knownTeams[key]) {
      this.teamNameMap[key] = knownTeams[key];
      return knownTeams[key];
    }
    
    // Auto-assign new team number based on draft order
    const assignedNumber = this.nextTeamNumber++;
    this.teamNameMap[key] = assignedNumber;
    
    console.log(`📝 Auto-assigned team "${teamName}" as Team ${assignedNumber}`);
    return assignedNumber;
  }

  setUserTeam(teamNumber, username) {
    const team = parseInt(teamNumber);
    if (isNaN(team) || team < 1 || team > 12) {
      return `❌ Invalid team number. Use 1-12.\nExample: \`.team 2\``;
    }
    
    if (!this.draftState) {
      this.draftState = { picks: [], currentPick: 1, userTeam: team };
    } else {
      this.draftState.userTeam = team;
    }
    
    console.log(`👤 Team number set to ${team} by ${username}`);
    
    return `✅ **TEAM NUMBER SET**

**You are now Team ${team}**

Next \`.my PlayerName\` will record as Team ${team}.
Continue drafting! 🎯`;
  }

  getRoundAndPick(absolutePick, leagueSize = 8) {
    const round = Math.ceil(absolutePick / leagueSize);
    const pickInRound = ((absolutePick - 1) % leagueSize) + 1;
    return { round, pickInRound };
  }

  clearDraft(username) {
    this.draftState = { picks: [], currentPick: 1, userTeam: 2, leagueSize: 8 };
    
    console.log(`🗑️ Draft cleared by ${username}`);
    
    return `🗑️ **DRAFT RESET**

✅ All picks cleared!
✅ Draft state reset to beginning
✅ Ready for fresh start

**Current Status:**
- Pick #1 ready (Rnd 1, Pick 1)
- Team: 2 (Your Team)
- No players drafted

Start fresh with \`.my PlayerName\` or \`.help\` for commands.
Use \`.team #\` to change your team number.

🎯 **Ready to draft!**`;
  }

  async handleForcePick(message, input, username) {
    try {
      const parts = input.trim().split(' ');
      if (parts.length < 3) {
        return `❌ **Invalid force format!**
Usage: \`.force PlayerName POS TEAM\`
Example: \`.force John Smith RB FA\``;
      }

      const playerName = parts.slice(0, -2).join(' ');
      const position = parts[parts.length - 2].toUpperCase();
      const team = parts[parts.length - 1].toUpperCase();

      // Create manual player entry
      const pick = {
        player: playerName,
        position: position,
        nflTeam: team,
        team: this.draftState.userTeam,
        pick: this.draftState.currentPick,
        timestamp: new Date(),
        isUser: true,
        isForced: true
      };
      
      this.draftState.picks.push(pick);
      this.draftState.currentPick++;
      
      console.log(`🔧 Force pick recorded: ${playerName} for team ${this.draftState.userTeam}`);
      
      const analysis = await this.generatePickAnalysis(pick, this.draftState);
      
      return `🔧 **FORCE PICK RECORDED!**
**Pick #${pick.pick}:** ${playerName} (${position}, ${team})
**Team:** ${this.draftState.userTeam} (Your Team)
⚠️ **Override:** Player not in database, manually added

${analysis}

Type \`.who\` for next recommendations.`;

    } catch (error) {
      console.error('Error processing force pick:', error);
      return '❌ Failed to record force pick. Try again.';
    }
  }

  async handleMyPick(message, playerName, username) {
    try {
      // Validate player name
      const validationResult = await this.validatePlayer(playerName.trim());
      if (!validationResult.isValid) {
        return `❌ **INVALID PLAYER: "${playerName}"**

${validationResult.suggestion || 'Player not found in NFL database.'}

**Did you mean:**
• Use full names: "Christian McCaffrey" not "CMC"  
• Check spelling: "Jaylen Waddle" not "Jaylen Wadel"

💡 **Override Option:**
• Use \`.force ${playerName} POS TEAM\` to force record anyway
• Example: \`.force ${playerName} RB FA\`

Type \`.help\` for examples.`;
      }

      const pick = {
        player: validationResult.correctName,
        position: validationResult.position,
        team: this.draftState.userTeam,
        pick: this.draftState.currentPick,
        timestamp: new Date(),
        isUser: true
      };
      
      this.draftState.picks.push(pick);
      this.draftState.currentPick++;
      
      console.log(`✅ User pick recorded: ${validationResult.correctName} for team ${this.draftState.userTeam}`);
      
      // Generate AI response with next recommendations
      const analysis = await this.generatePickAnalysis(pick, this.draftState);
      
      // Add rich ESPN data to the response
      let enrichedInfo = '';
      if (validationResult.enrichedData) {
        const data = validationResult.enrichedData;
        enrichedInfo = `\n📊 **ESPN DATA:**`;
        
        if (data.adp) {
          enrichedInfo += `\n• **ADP:** ${Math.round(data.adp)}`;
        }
        
        if (data.projections?.seasonTotal?.fantasyPoints) {
          enrichedInfo += `\n• **Projected Points:** ${Math.round(data.projections.seasonTotal.fantasyPoints)}`;
        }
        
        if (data.injuryStatus && data.injuryStatus !== 'ACTIVE') {
          enrichedInfo += `\n• **Injury Status:** ${data.injuryStatus}`;
        }
        
        if (data.insights) {
          enrichedInfo += `\n• **Outlook:** ${data.insights}`;
        }
      }

      return `🎯 **YOUR PICK RECORDED!**
**Pick #${pick.pick}:** ${validationResult.correctName} (${validationResult.position}, ${validationResult.nflTeam})
**Team:** ${this.draftState.userTeam} (Your Team)${enrichedInfo}

${analysis}

Type \`.who\` for next pick suggestions!`;

    } catch (error) {
      console.error('Error handling my pick:', error);
      return "❌ Error recording your pick. Try again.";
    }
  }

  async handleTeamPick(message, content, username) {
    try {
      // Parse "PlayerName t3" format
      const parts = content.trim().split(' ');
      if (parts.length < 2) {
        return "❓ Format: `.p PlayerName t3` (player name then team number)";
      }
      
      const teamPart = parts[parts.length - 1]; // Last part should be team
      const playerName = parts.slice(0, -1).join(' '); // Everything else is player name
      
      if (!teamPart.startsWith('t') || isNaN(teamPart.slice(1))) {
        return "❓ Format: `.p PlayerName t3` (team should be t1, t2, etc.)";
      }
      
      const teamNumber = parseInt(teamPart.slice(1));
      
      // Validate player name
      const validationResult = await this.validatePlayer(playerName.trim());
      if (!validationResult.isValid) {
        return `❌ **INVALID PLAYER: "${playerName}"**

${validationResult.suggestion || 'Player not found in NFL database.'}

**Format:** \`.p RealPlayerName t${teamNumber}\``;
      }
      
      const pick = {
        player: validationResult.correctName,
        position: validationResult.position,
        team: teamNumber,
        pick: this.draftState.currentPick,
        timestamp: new Date(),
        isUser: false
      };
      
      this.draftState.picks.push(pick);
      this.draftState.currentPick++;
      
      console.log(`📊 Team pick recorded: ${validationResult.correctName} for team ${teamNumber}`);
      
      // Add ESPN data for team picks too
      let teamPickInfo = '';
      if (validationResult.enrichedData?.adp) {
        teamPickInfo = `\n📊 **ADP:** ${Math.round(validationResult.enrichedData.adp)}`;
      }

      // Quick confirmation
      return `📊 **PICK RECORDED**
**Pick #${pick.pick}:** ${validationResult.correctName} (${validationResult.position}, ${validationResult.nflTeam})
**Team:** ${teamNumber}${teamPickInfo}

${this.draftState.picks.length} total picks recorded. Type \`.who\` when it's your turn!`;

    } catch (error) {
      console.error('Error handling team pick:', error);
      return "❌ Error recording pick. Format: `.p PlayerName t3`";
    }
  }

  async handleNumberedPick(message, command, username) {
    // Handle ".3 PlayerName" format (team 3 picks player)
    const match = command.match(/^\.(\d+) (.+)$/);
    if (!match) {
      return "❓ Format: `.3 PlayerName` (team 3 picks player)";
    }
    
    const teamNumber = parseInt(match[1]);
    const playerName = match[2].trim();
    
    // Use same logic as team pick
    return await this.handleTeamPick(message, `${playerName} t${teamNumber}`, username);
  }

  async handleWhoNext(message, username) {
    if (!this.draftState || this.draftState.picks.length === 0) {
      return "❓ No draft in progress. Record some picks first with `.my PlayerName` or `.p PlayerName t3`";
    }
    
    try {
      const recommendations = await this.generateCurrentRecommendations(this.draftState);
      return `🤖 **PICK RECOMMENDATIONS**

${recommendations}

**Quick Commands:**
\`\`.my PlayerName\`\` - Record your pick
\`\`.p PlayerName t3\`\` - Record team 3's pick`;

    } catch (error) {
      console.error('Error generating recommendations:', error);
      return "❌ Error generating recommendations. Try again.";
    }
  }

  async handleDraftStatus(message, username) {
    if (!this.draftState) {
      return "❓ No draft in progress. Start with `.my PlayerName` or `.p PlayerName t3`";
    }
    
    const userPicks = this.draftState.picks.filter(pick => pick.isUser);
    const totalPicks = this.draftState.picks.length;
    
    return `📊 **DRAFT STATUS**

**Total Picks:** ${totalPicks}
**Your Picks:** ${userPicks.length}
**Next Pick:** #${this.draftState.currentPick}

**Your Team:**
${userPicks.map(pick => `${pick.pick}. ${pick.player}`).join('\n') || 'No picks yet'}

Type \`.who\` for recommendations!`;
  }

  getDotCommandHelp() {
    return `⚡ **FAST DRAFT COMMANDS**

**Record Picks:**
\`\`.my McCaffrey\`\` - Your pick
\`\`.force Unknown Player RB FA\`\` - Force unknown player
\`\`.p Jefferson t2\`\` - Team 2 picks Jefferson  
\`\`.3 Adams\`\` - Team 3 picks Adams

**AI Analysis:**
\`\`.who\`\` or \`\`.next\`\` - AI recommendations  
\`\`.analyze\`\` - Manual comprehensive analysis
\`\`.status\`\` - Draft summary

**Intelligence:**
\`\`.update\`\` - Update all data sources
\`\`.intel [player]\`\` - Player intelligence report
\`\`.news\`\` - Send news update to #newsarticles
\`\`.monitor\`\` - System monitoring status

**Utility:**
\`\`.team #\`\` - Set your team number (1-12)
\`\`. [paste]\`\` - Import ESPN draft board (just . then paste)
\`\`.clear\`\` - Reset draft (fresh start)
\`\`.help\`\` - This help

**Example:** 
\`\`.my Travis Kelce\`\` → Records pick & AI advice
\`\`.analyze\`\` → Full team analysis
\`\`.clear\`\` → Start over clean`;
  }

  async generatePickAnalysis(pick, draftState) {
    try {
      const context = this.buildDraftContext(draftState);
      const teamAnalysis = this.analyzeTeamNeeds(draftState);
      
      const prompt = `🎯 LIVE DRAFT ANALYSIS for Pick #${pick.pick}: ${pick.player}

CURRENT TEAM COMPOSITION:
${teamAnalysis.rosterBreakdown}

TEAM NEEDS ANALYSIS:
${teamAnalysis.needs}

PICK EVALUATION:
Pick: ${pick.player} (${pick.position}) - Pick #${pick.pick}
Current draft state: ${draftState.picks.length} picks made

Provide comprehensive analysis:
1. **VALUE ASSESSMENT:** Was this good value for this round?
2. **TEAM FIT:** How does this fill your needs?
3. **ROSTER GAPS:** What positions are you still missing?
4. **NEXT TARGETS:** Top 3 positions to target next with specific player suggestions
5. **STRATEGY:** Should you pivot strategy based on current roster?

Use ESPN ADP data and 2025 projections for recommendations. Be specific with player names.
Keep sections clear with bold headers. Max 8 sentences total.`;

      const analysis = await this.claude.makeRequest([{
        role: 'user',
        content: prompt
      }], this.buildFantasyPrompt('', context, 'User'));

      console.log('🔍 Claude Analysis Response:', JSON.stringify(analysis, null, 2));
      
      // Handle different response formats
      if (typeof analysis === 'string') {
        return analysis;
      }
      
      return analysis.content?.[0]?.text || analysis.text || analysis.message || 'Good pick! Keep building your team.';

    } catch (error) {
      console.error('Error generating pick analysis:', error);
      return 'Pick recorded! Type `.who` for next recommendations.';
    }
  }

  async generateCurrentRecommendations(draftState) {
    try {
      const context = this.buildDraftContext(draftState);
      const userPicks = draftState.picks.filter(pick => pick.isUser);
      
      // Get recent Twitter insights for enhanced analysis
      const twitterInsights = this.twitterMonitor.getDraftRelevantInsights(null, 180); // Last 3 hours
      
      let twitterContext = '';
      if (twitterInsights && (twitterInsights.critical_news.length > 0 || twitterInsights.injury_updates.length > 0)) {
        twitterContext = `\n\nRECENT BREAKING NEWS (Last 3 hours):
${twitterInsights.critical_news.slice(0, 3).map(item => `- ${item.content}`).join('\n')}
${twitterInsights.injury_updates.slice(0, 2).map(item => `- ${item.content}`).join('\n')}

Factor this into recommendations.`;
      }
      
      const prompt = `Generate pick recommendations for my next draft selection:

My current roster: ${userPicks.map(p => p.player).join(', ') || 'None yet'}
Total picks made: ${draftState.picks.length}
Next pick: #${draftState.currentPick}${twitterContext}

Based on ESPN 2025 projections and any recent news, recommend 3-4 players I should target next.
Focus on value and team needs. Keep it concise for live draft.`;

      const recommendations = await this.claude.makeRequest([{
        role: 'user',
        content: prompt
      }], this.buildFantasyPrompt('', context, 'User'));

      console.log('🔍 Claude Response:', JSON.stringify(recommendations, null, 2));
      
      // Handle different response formats
      if (typeof recommendations === 'string') {
        return recommendations;
      }
      
      return recommendations.content?.[0]?.text || recommendations.text || recommendations.message || 'Focus on best available player for your team needs.';

    } catch (error) {
      console.error('Error generating recommendations:', error);
      return 'Unable to generate recommendations. Pick the best available player!';
    }
  }

  buildDraftContext(draftState) {
    const userPicks = draftState.picks.filter(pick => pick.isUser);
    const recentPicks = draftState.picks.slice(-5);
    
    return {
      totalPicks: draftState.picks.length,
      userPicks: userPicks,
      recentPicks: recentPicks,
      nextPick: draftState.currentPick
    };
  }

  analyzeTeamNeeds(draftState) {
    const userPicks = draftState.picks.filter(pick => pick.isUser);
    const positions = { QB: [], RB: [], WR: [], TE: [], K: [], 'D/ST': [] };
    
    // Categorize current picks
    userPicks.forEach(pick => {
      const pos = pick.position || 'UNKNOWN';
      if (positions[pos]) {
        positions[pos].push(pick.player);
      }
    });

    // Standard lineup requirements
    const needs = {
      QB: Math.max(0, 1 - positions.QB.length),
      RB: Math.max(0, 2 - positions.RB.length), 
      WR: Math.max(0, 2 - positions.WR.length),
      TE: Math.max(0, 1 - positions.TE.length),
      K: Math.max(0, 1 - positions.K.length),
      'D/ST': Math.max(0, 1 - positions['D/ST'].length)
    };

    // Build roster breakdown
    let rosterBreakdown = '';
    Object.keys(positions).forEach(pos => {
      const players = positions[pos];
      if (players.length > 0) {
        rosterBreakdown += `${pos}: ${players.join(', ')}\n`;
      } else {
        rosterBreakdown += `${pos}: EMPTY\n`;
      }
    });

    // Build needs analysis
    let needsAnalysis = '';
    const urgentNeeds = Object.keys(needs).filter(pos => needs[pos] > 0);
    
    if (urgentNeeds.length === 0) {
      needsAnalysis = '✅ Starting lineup complete! Focus on depth and upside picks.';
    } else {
      needsAnalysis = `🚨 MISSING: ${urgentNeeds.map(pos => `${needs[pos]} ${pos}`).join(', ')}`;
      
      // Add depth recommendations
      const depthNeeds = [];
      if (positions.RB.length < 4) depthNeeds.push('RB depth');
      if (positions.WR.length < 4) depthNeeds.push('WR depth');
      
      if (depthNeeds.length > 0) {
        needsAnalysis += `\n📈 Consider: ${depthNeeds.join(', ')}`;
      }
    }

    return {
      rosterBreakdown: rosterBreakdown,
      needs: needsAnalysis,
      positions: positions,
      urgentNeeds: urgentNeeds
    };
  }

  async validatePlayer(playerName) {
    try {
      // Load NFL players database
      const fs = require('fs');
      const path = require('path');
      const playersPath = path.join(__dirname, '../data/nfl-players-enriched.json');
      
      let players = [];
      try {
        const playersData = fs.readFileSync(playersPath, 'utf8');
        players = JSON.parse(playersData);
      } catch (error) {
        console.warn('Could not load players database:', error.message);
        // Return valid for now if database unavailable
        return { isValid: true, correctName: playerName };
      }

      // Direct match (case insensitive)
      const directMatch = players.find(player => 
        player.name.toLowerCase() === playerName.toLowerCase()
      );
      
      if (directMatch) {
        return {
          isValid: true,
          correctName: directMatch.name,
          position: directMatch.position,
          nflTeam: directMatch.team || directMatch.proTeam,
          enrichedData: directMatch
        };
      }

      // Fuzzy matching for partial names
      const partialMatches = players.filter(player => {
        const playerLower = player.name.toLowerCase();
        const inputLower = playerName.toLowerCase();
        
        // Check if input matches first/last name parts
        const nameParts = playerLower.split(' ');
        const inputParts = inputLower.split(' ');
        
        return inputParts.every(inputPart => 
          nameParts.some(namePart => 
            namePart.includes(inputPart) || inputPart.includes(namePart)
          )
        );
      });

      if (partialMatches.length === 1) {
        const match = partialMatches[0];
        return {
          isValid: true,
          correctName: match.name,
          position: match.position,
          nflTeam: match.team || match.proTeam,
          enrichedData: match,
          suggestion: `Auto-corrected to: ${match.name}`
        };
      }

      if (partialMatches.length > 1) {
        const suggestions = partialMatches.slice(0, 3).map(p => p.name).join(', ');
        return {
          isValid: false,
          suggestion: `Multiple matches found: ${suggestions}`
        };
      }

      // No matches found
      const commonMistakes = {
        'cmc': 'Christian McCaffrey',
        'cmac': 'Christian McCaffrey',
        'jj': 'Justin Jefferson',
        'kelce': 'Travis Kelce',
        'hill': 'Tyreek Hill',
        'adams': 'Davante Adams',
        'kupp': 'Cooper Kupp'
      };

      const suggestion = commonMistakes[playerName.toLowerCase()];
      if (suggestion) {
        return {
          isValid: false,
          suggestion: `Did you mean: ${suggestion}?`
        };
      }

      return {
        isValid: false,
        suggestion: 'Player not found. Use full names like "Christian McCaffrey".'
      };

    } catch (error) {
      console.error('Error validating player:', error);
      // Fallback to accepting the name if validation fails
      return { isValid: true, correctName: playerName };
    }
  }

  async handleDataUpdate(username) {
    try {
      logger.info(`📡 ${username} requested data update`);
      
      const results = await this.dataMonitor.updateAllSources();
      
      let response = `🔄 **DATA UPDATE COMPLETE**\n\n`;
      
      // Injuries
      if (results.injuries?.critical_updates?.length > 0) {
        response += `🚨 **INJURY ALERTS:**\n`;
        results.injuries.critical_updates.slice(0, 3).forEach(injury => {
          response += `- ${injury.player} (${injury.team}): ${injury.status} - ${injury.injury}\n`;
        });
        response += '\n';
      }
      
      // Depth Chart Changes
      if (results.depth_charts?.lineup_changes?.length > 0) {
        response += `📊 **LINEUP CHANGES:**\n`;
        results.depth_charts.lineup_changes.slice(0, 2).forEach(change => {
          response += `- ${change.team}: ${change.change}\n`;
        });
        response += '\n';
      }
      
      // Reddit Trending
      if (results.reddit_sentiment?.trending_discussions?.length > 0) {
        response += `📈 **TRENDING PLAYERS:**\n`;
        results.reddit_sentiment.trending_discussions.slice(0, 3).forEach(player => {
          response += `- ${player.name} (${player.mentions} mentions)\n`;
        });
        response += '\n';
      }
      
      response += `⏰ Updated: ${new Date().toLocaleTimeString()}`;
      return response;
      
    } catch (error) {
      logger.error('Data update failed:', error.message);
      return '❌ Data update failed. Try again later.';
    }
  }

  async handleDraftIntelligence(playerName, username) {
    try {
      logger.info(`🎯 ${username} requested draft intelligence${playerName ? ` for ${playerName}` : ''}`);
      
      const intelligence = await this.dataMonitor.getDraftIntelligence(playerName);
      
      let response = `🧠 **DRAFT INTELLIGENCE**${playerName ? ` - ${playerName}` : ''}\n\n`;
      
      // Critical Alerts
      if (intelligence.critical_alerts.length > 0) {
        response += `🚨 **CRITICAL ALERTS:**\n`;
        intelligence.critical_alerts.slice(0, 3).forEach(alert => {
          response += `- ${alert.player || alert.team}: ${alert.fantasy_impact || alert.change}\n`;
        });
        response += '\n';
      }
      
      // Player-Specific
      if (intelligence.player_specific.length > 0) {
        response += `👤 **${playerName ? playerName.toUpperCase() + ' ' : ''}PLAYER UPDATES:**\n`;
        intelligence.player_specific.forEach(update => {
          if (update.injury) {
            response += `- ${update.player}: ${update.status} (${update.injury})\n`;
          } else if (update.trend) {
            response += `- ${update.player}: ${update.trend}\n`;
          } else {
            response += `- ${update.player}: ${update.status}\n`;
          }
          response += `  Impact: ${update.fantasy_impact}\n`;
        });
        response += '\n';
      }
      
      // Opportunities
      if (intelligence.opportunities.length > 0) {
        response += `💡 **OPPORTUNITIES:**\n`;
        intelligence.opportunities.slice(0, 3).forEach(opp => {
          response += `- ${opp.player} (${opp.team}): ${opp.fantasy_impact}\n`;
        });
        response += '\n';
      }
      
      // Trending
      if (intelligence.trending_players.length > 0) {
        response += `📈 **TRENDING:**\n`;
        intelligence.trending_players.slice(0, 3).forEach(player => {
          response += `- ${player.name} (${player.mentions} mentions)\n`;
        });
        response += '\n';
      }
      
      response += `🕒 Last updated: ${new Date(intelligence.last_updated).toLocaleTimeString()}`;
      
      if (response.length < 100) {
        response = `🧠 **DRAFT INTELLIGENCE**\n\n✅ No critical updates at this time.\n\nUse \`.update\` to refresh all data sources.`;
      }
      
      return response;
      
    } catch (error) {
      logger.error('Draft intelligence failed:', error.message);
      return '❌ Intelligence gathering failed. Try again later.';
    }
  }

  getMonitoringStatus() {
    const status = this.dataMonitor.getMonitoringStatus();
    
    let response = `📊 **MONITORING STATUS**\n\n`;
    response += `🔄 Active: ${status.monitoring_active ? 'YES' : 'NO'}\n`;
    response += `📡 Sources: ${status.total_sources}\n\n`;
    
    if (Object.keys(status.sources).length > 0) {
      response += `**Last Updates:**\n`;
      Object.entries(status.sources).forEach(([source, info]) => {
        const emoji = info.status === 'FRESH' ? '🟢' : info.status === 'STALE' ? '🟡' : '🔴';
        response += `${emoji} ${source}: ${info.minutes_ago}m ago\n`;
      });
    } else {
      response += `⚠️ No sources updated yet. Use \`.update\` to refresh.`;
    }
    
    return response;
  }

  async handleNewsCommand(username) {
    console.log(`📰 ${username} requested news update`);
    
    try {
      // Get fresh intelligence data
      const intelligence = await this.dataMonitor.getDraftIntelligence();
      
      // Create news embed for #newsarticles channel
      const newsEmbed = {
        title: '📰 Fantasy Football News Update',
        description: 'Latest fantasy football news and developments',
        color: 0x1E90FF,
        fields: [],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Fantasy Command Center • News Update'
        }
      };

      // Get real-time analysis from Claude AI
      const aiAnalysis = await this.generateNewsAnalysis(intelligence);
      
      // Critical alerts with AI analysis
      if (intelligence.critical_alerts.length > 0) {
        newsEmbed.fields.push({
          name: '🚨 Breaking Fantasy News',
          value: aiAnalysis.breakingNews || intelligence.critical_alerts.slice(0, 2).map(alert => 
            `• **${alert.player || alert.team}**: ${alert.fantasy_impact || alert.change}`
          ).join('\n'),
          inline: false
        });
      }

      // Trending analysis with AI insights
      if (aiAnalysis.trendingAnalysis) {
        newsEmbed.fields.push({
          name: '📈 Trending Players Analysis',
          value: aiAnalysis.trendingAnalysis.substring(0, 1000),
          inline: false
        });
      }

      // Waiver wire opportunities  
      if (aiAnalysis.waiverGems) {
        newsEmbed.fields.push({
          name: '💎 Waiver Wire Gems',
          value: aiAnalysis.waiverGems.substring(0, 1000),
          inline: false
        });
      }

      if (newsEmbed.fields.length === 0) {
        newsEmbed.fields.push({
          name: '✅ All Quiet',
          value: 'No major developments in fantasy football right now. Keep monitoring!',
          inline: false
        });
      }

      // Send to dedicated news channel
      if (this.discordNotifier && this.discordNotifier.sendNewsAlert) {
        await this.discordNotifier.sendNewsAlert(newsEmbed);
        return `📰 **News update sent to #newsarticles!**\n\n⏰ Updated: ${new Date().toLocaleTimeString()}`;
      } else {
        return `📰 **News Update**\n\n${newsEmbed.fields.map(f => `**${f.name}**\n${f.value}`).join('\n\n')}\n\n⏰ Updated: ${new Date().toLocaleTimeString()}`;
      }

    } catch (error) {
      console.error('Failed to get news update:', error.message);
      return '❌ Failed to get news update. Please try again later.';
    }
  }

  async generateNewsAnalysis(intelligence) {
    try {
      const newsPrompt = `FANTASY FOOTBALL NEWS ANALYSIS

Current Data:
- Critical Alerts: ${JSON.stringify(intelligence.critical_alerts.slice(0, 3), null, 2)}
- Trending Players: ${JSON.stringify(intelligence.trending_players.slice(0, 5), null, 2)}
- Opportunities: ${JSON.stringify(intelligence.opportunities.slice(0, 3), null, 2)}

Create engaging fantasy football news content with:

1. BREAKING NEWS (2-3 detailed stories with fantasy impact):
   - Injury analysis with timeline and replacement options
   - Depth chart changes with target adjustments
   - Trade/signing impacts on fantasy values

2. TRENDING ANALYSIS (why players are buzzing):
   - What's driving the mentions
   - Fantasy relevance and actionable advice
   - Sleeper alerts and avoid warnings

3. WAIVER WIRE GEMS (immediate opportunities):
   - Pickup percentages and availability
   - Matchup advantages coming up
   - Handcuff values and insurance plays

Make it ESPN-quality analysis with specific fantasy advice. No generic content.`;

      const response = await this.claudeAPI.messages.create({
        model: this.config.ai.claude.model,
        max_tokens: 1500,
        temperature: 0.4,
        messages: [{ role: 'user', content: newsPrompt }]
      });

      const analysis = response.content[0].text;
      
      // Parse the AI response into structured sections
      const sections = analysis.split(/\d\.\s+/);
      
      return {
        breakingNews: sections[1]?.trim() || null,
        trendingAnalysis: sections[2]?.trim() || null,
        waiverGems: sections[3]?.trim() || null,
        fullAnalysis: analysis
      };

    } catch (error) {
      console.error('Failed to generate AI news analysis:', error.message);
      return {
        breakingNews: null,
        trendingAnalysis: null, 
        waiverGems: null,
        fullAnalysis: null
      };
    }
  }

  async stop() {
    if (this.client) {
      await this.client.destroy();
    }
  }
}

module.exports = DiscordAIBot;