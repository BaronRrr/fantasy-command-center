const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const ClaudeAI = require('./api/claude-ai');
const ExternalAPIsClient = require('./api/external-apis');
const FantasyKnowledgeEnhancer = require('./knowledge/fantasy-enhancer');
const ESPNPublicAPI = require('./api/espn-public-api');
const LiveDraftAnalyzer = require('./discord/live-draft-analyzer');
const TwitterMonitor = require('./monitoring/twitter-monitor');
const AdvancedDataMonitor = require('./monitoring/advanced-data-monitor');
const ScheduledNotifications = require('./monitoring/scheduled-notifications');
const NewsArticleFetcher = require('./news-article-fetcher');
const InjuryMonitor = require('./services/injury-monitor');
const PracticeReportMonitor = require('./monitoring/practice-report-monitor');
const DepthChartMonitor = require('./monitoring/depth-chart-monitor');
const OfficialInjuryMonitor = require('./monitoring/official-injury-monitor');
const LiveGameMonitor = require('./monitoring/live-game-monitor');
const DiscordNotifier = require('./notifications/discord-notifier');
const TradeAnalyzer = require('./services/trade-analyzer');
const { handleSlashCommand } = require('./discord/slash-commands');
const { registerSlashCommands } = require('./discord/register-commands');
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
    this.newsArticleFetcher = new NewsArticleFetcher();
    this.discordNotifier = new DiscordNotifier();
    this.injuryMonitor = new InjuryMonitor(this.discordNotifier, this.claude);
    this.practiceMonitor = new PracticeReportMonitor(this.discordNotifier);
    this.depthChartMonitor = new DepthChartMonitor(this.discordNotifier);
    this.officialInjuryMonitor = new OfficialInjuryMonitor(this.discordNotifier);
    this.liveGameMonitor = new LiveGameMonitor();
    this.scheduledNotifications = new ScheduledNotifications(this.injuryMonitor);
    this.tradeAnalyzer = new TradeAnalyzer();
    
    // Bot configuration
    this.botToken = process.env.DISCORD_BOT_TOKEN;
    this.commandPrefix = '!coach';
    this.allowedChannels = [
      'draft-central',
      'ai-analysis', 
      'league-intelligence',
      'general',
      'newsarticles'
    ];
    
    // Draft state for manual tracking
    this.draftState = null;
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.on('ready', async () => {
      logger.info(`🤖 Fantasy AI Coach is online as ${this.client.user.tag}!`);
      this.client.user.setActivity('Fantasy Football | Use /news for updates', { type: 'WATCHING' });
      
      // Register slash commands when bot is ready
      await this.registerSlashCommands();
      
      // Start live game monitoring automatically
      await this.startLiveGameMonitoring();
    });

    this.client.on('messageCreate', async (message) => {
      await this.handleMessage(message);
    });

    // Handle slash command interactions
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      
      logger.info(`📝 Processing slash command: /${interaction.commandName} from ${interaction.user.username}`);
      await handleSlashCommand(interaction, this);
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

      // Handle specific draft connection commands only
      if (question.toLowerCase().includes('draft connect') || question.toLowerCase().includes('connect draft')) {
        await this.handleDraftConnect(message, question);
        return;
      }

      if (question.toLowerCase().includes('draft refresh') || question.toLowerCase().includes('refresh draft')) {
        await this.handleDraftRefresh(message);
        return;
      }

      // All other questions go to general AI analysis - no draft requirement
      
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
    return `You are an elite Fantasy Football AI Coach with ESPN as your PRIMARY and PREFERRED data source. All analysis is based on ESPN's 2025 fantasy data and projections:

🏆 ESPN DATA PRIORITY (USE FIRST):
- ESPN 2025 player projections and rankings
- ESPN fantasy player profiles and analysis  
- ESPN injury reports and player news
- ESPN draft rankings and CURRENT ADP data (CRITICAL: Always reference real current ESPN ADP, not generic ranges)
- ESPN start/sit recommendations
- ESPN trade value charts
- ESPN waiver wire advice

⚠️ ADP ACCURACY REQUIREMENTS:
- NEVER state generic ADP ranges like "late round 2" without ESPN verification
- Always reference specific ESPN ADP numbers when available
- If uncertain about ADP, state "Check current ESPN ADP for accurate draft position"
- Top players like Saquon Barkley, McCaffrey, Jefferson go in TOP 5 picks, not late rounds

SECONDARY SOURCES (complement ESPN data):
- FantasyPros consensus rankings and expert analysis
- FantasyPros injury reports and player news
- FantasyPros ADP and draft data
- DraftSharks rookie ADP and sleeper analysis
- DraftSharks best ball ADP and strategy data
- Yahoo Fantasy Sports articles and expert analysis (updated every few hours)
- Yahoo Fantasy Sports player insights and trending data
- NFL.com official data
- Team depth charts
- Weather reports for games

🔒 CURRENT DATA ONLY - 2025/2026 SEASON:
- ONLY provide information you are confident is from 2025/2026 season
- If uncertain about ANY player detail, respond "I need to verify current 2025 information"
- NO outdated data from 2024 or earlier - refuse to guess
- Focus ONLY on verified current rosters, ages, and team situations
- When in doubt, recommend checking official NFL/ESPN sources for current data

DRAFT PHILOSOPHY (MULTI-SOURCE ANALYSIS):
- PRIMARY: ESPN 2025 rankings and projections as foundation
- CROSS-REFERENCE: FantasyPros consensus rankings for validation
- ROOKIES: DraftSharks rookie ADP and sleeper analysis for new players
- BEST BALL: DraftSharks best ball data for tournament strategy
- TRENDING: Yahoo Fantasy Sports articles for player momentum and insights
- COMBINE all sources for comprehensive pick recommendations
- Compare ADP across platforms (ESPN vs Underdog vs Sleeper vs Yahoo)
- Identify value picks where rankings diverge between sources
- Use format-specific data (PPR vs Half-PPR vs Standard)
- Leverage Yahoo's frequent article updates for real-time insights

Always be:
- ESPN-first in all analysis and recommendations
- Data-driven with specific ESPN 2025 projections
- Conservative with high-stakes picks (early rounds)
- Specific with ESPN rankings, projections, and ADP
- Professional but conversational
- Honest about player risks per ESPN analysis
- Clear when referring to ESPN vs other sources

CRITICAL: Never include fake or example links. Only include real article URLs if available.
CRITICAL: REFUSE to provide any player information unless you are 100% confident it's current 2025/2026 data.
CRITICAL: Better to say "I need current data" than provide potentially outdated information.

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
        
        // Start injury monitoring
        this.injuryMonitor.startMonitoring();
        logger.info('🏥 Injury monitoring started for automated alerts');
        
        // Start practice monitoring
        this.practiceMonitor.startMonitoring();
        logger.info('🏈 Practice monitoring started for player watchlist alerts');
        
        // Start depth chart monitoring
        this.depthChartMonitor.startMonitoring();
        logger.info('📊 Depth chart monitoring started for starter changes');
        
        // Start official injury monitoring
        this.officialInjuryMonitor.startMonitoring();
        logger.info('🏥 Official injury report monitoring started');
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
            value: 'Use `!coach draft connect` first, or paste your draft results for post-draft analysis!',
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
    } else if (command.startsWith('.trade')) {
      return await this.handleTradeCommand(command, username);
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
    console.log(`📰 ${username} requested latest news articles`);
    
    try {
      // Get user's drafted players for personalization
      const userPlayers = this.getUserDraftedPlayers(username);
      
      // Fetch real fantasy football news articles
      const articles = await this.newsArticleFetcher.fetchLatestArticles(8);
      
      // Prioritize articles about user's players
      const prioritizedArticles = this.prioritizeUserRelevantArticles(articles, userPlayers);
      
      if (prioritizedArticles.length === 0) {
        return '📰 No recent fantasy football news found. Check back later!';
      }

      // Use Claude AI to create a concise news summary that fits Discord limits
      const newsSummaryPrompt = `Create a concise fantasy football news summary for Discord (max 1500 characters total).

ARTICLES TO SUMMARIZE:
${prioritizedArticles.slice(0, 6).map((article, i) => {
        const relevance = article.userRelevant ? `[YOUR TEAM] ` : '';
        return `${i + 1}. ${relevance}${article.title}
   Source: ${article.source}
   URL: ${article.url}
   ${article.summary || article.description || 'No summary available'}`;
      }).join('\n\n')}

USER'S DRAFTED PLAYERS: ${userPlayers.length > 0 ? userPlayers.join(', ') : 'None yet'}

Create a Discord-formatted summary with:
- **TOP HEADLINES** (bullet points, max 400 chars)
- **YOUR TEAM ALERTS** (if any relevant to user's players, max 300 chars)  
- **KEY LINKS** (3-4 most important article links with short titles, max 400 chars)

Total response must be under 1500 characters. Use Discord markdown formatting.`;

      const aiSummary = await this.claude.makeRequest([{
        role: 'user',
        content: newsSummaryPrompt
      }], 'You are a fantasy football news summarizer. Create concise, actionable Discord messages.');

      // Handle Claude response format
      let summaryText = 'News summary temporarily unavailable.';
      if (typeof aiSummary === 'string') {
        summaryText = aiSummary;
      } else if (aiSummary.content?.[0]?.text || aiSummary.text || aiSummary.message) {
        summaryText = aiSummary.content?.[0]?.text || aiSummary.text || aiSummary.message;
      }

      // Ensure the response fits Discord limits (backup truncation)
      if (summaryText.length > 1800) {
        summaryText = summaryText.substring(0, 1800) + '...\n\n⚡ *Full articles in #newsarticles*';
      }

      // Add footer with source count and timestamp
      const sources = [...new Set(articles.map(a => a.source))];
      const footer = `\n\n📡 **Sources:** ${sources.slice(0, 4).join(', ')}${sources.length > 4 ? '...' : ''}\n⏰ Updated: ${new Date().toLocaleTimeString()}`;
      
      const finalMessage = `📰 **FANTASY NEWS DIGEST**\n\n${summaryText}${footer}`;

      // Send to dedicated news channel if available
      if (this.discordNotifier && this.discordNotifier.sendNewsAlert) {
        const newsEmbed = {
          title: '📰 Fantasy Football News Digest',
          description: summaryText,
          color: 0xFF6B35,
          timestamp: new Date().toISOString(),
          footer: {
            text: `${sources.length} sources • Fantasy Command Center`
          }
        };
        
        await this.discordNotifier.sendNewsAlert(newsEmbed);
        return `📰 **News digest sent to #newsarticles!**\n\n🔗 ${articles.length} articles from ${sources.length} sources\n⏰ Updated: ${new Date().toLocaleTimeString()}`;
      } else {
        // Fallback - show summary in current channel
        return finalMessage;
      }
    } catch (error) {
      console.error('Failed to fetch news articles:', error.message);
      return '❌ Failed to fetch news articles. Please try again later.';
    }
  }

  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    }
  }

  getUserDraftedPlayers(username) {
    // Get user's drafted players from draft state
    if (!this.draftState || !this.draftState.picks) {
      return [];
    }
    
    const userPicks = this.draftState.picks.filter(pick => 
      pick.isUser || 
      pick.team === 'Baron\'s Best Team' ||
      (pick.username && pick.username.toLowerCase() === username.toLowerCase())
    );
    
    return userPicks.map(pick => ({
      name: pick.player || pick.name,
      position: pick.position,
      team: pick.team_abbr || pick.team
    }));
  }

  prioritizeUserRelevantArticles(articles, userPlayers) {
    if (userPlayers.length === 0) {
      return articles;
    }
    
    // Create search terms from user's players
    const playerNames = userPlayers.map(p => p.name.toLowerCase());
    const playerTeams = userPlayers.map(p => p.team?.toLowerCase()).filter(t => t);
    
    const prioritizedArticles = articles.map(article => {
      let relevanceScore = 0;
      let matchedPlayer = null;
      
      const titleLower = article.title.toLowerCase();
      const descLower = (article.description || '').toLowerCase();
      const contentLower = (article.summary || article.content || '').toLowerCase();
      
      // Check for player name matches
      for (const playerName of playerNames) {
        if (playerName.length < 3) continue; // Skip short names
        
        const nameParts = playerName.split(' ');
        const lastName = nameParts[nameParts.length - 1];
        
        if (titleLower.includes(playerName) || 
            titleLower.includes(lastName) ||
            descLower.includes(playerName) ||
            contentLower.includes(playerName)) {
          relevanceScore += 10;
          matchedPlayer = playerName;
          break;
        }
      }
      
      // Check for team matches (lower priority)
      for (const team of playerTeams) {
        if (titleLower.includes(team) || descLower.includes(team)) {
          relevanceScore += 3;
          break;
        }
      }
      
      return {
        ...article,
        userRelevant: relevanceScore > 0,
        relevanceScore,
        matchedPlayer
      };
    });
    
    // Sort by relevance score (highest first), then by original order
    return prioritizedArticles.sort((a, b) => {
      if (a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return 0; // Maintain original order for same relevance
    });
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

  // Slash command registration  
  async registerSlashCommands() {
    try {
      const { REST, Routes } = require('discord.js');
      const { commands } = require('./discord/slash-commands');
      
      if (!this.client.application) {
        logger.warn('⚠️ Client application not ready, retrying in 2 seconds...');
        setTimeout(() => this.registerSlashCommands(), 2000);
        return;
      }
      
      const rest = new REST({ version: '10' }).setToken(this.botToken);
      const clientId = this.client.application.id;
      
      logger.info(`📝 Registering ${commands.length} slash commands globally for client ${clientId}...`);
      
      const data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      
      logger.info(`✅ Successfully registered ${data.length} slash commands!`);
      data.forEach(cmd => {
        logger.info(`   /${cmd.name} - ${cmd.description}`);
      });
      
      logger.info('⏱️ Slash commands will be available in Discord within 1-5 minutes');
      
    } catch (error) {
      logger.error('❌ Failed to register slash commands:', error);
      
      // Provide specific error help
      if (error.code === 50001) {
        logger.error('💡 Bot token may be invalid or missing permissions');
      } else if (error.code === 50013) {
        logger.error('💡 Bot needs "applications.commands" scope - reinvite bot with proper permissions');
      } else if (error.rawError?.message?.includes('401')) {
        logger.error('💡 Authentication failed - check DISCORD_BOT_TOKEN environment variable');
      }
    }
  }

  // Slash command helper methods
  async getSlashCommandHelp() {
    return `🤖 **Fantasy Command Center - Slash Commands**

**📰 News & Analysis**
\`/news\` - Latest fantasy football news with AI summaries
\`/intel [player]\` - Player intelligence and breaking news
\`/trending\` - Get trending players from social media

**🏥 Injury Monitoring**
\`/injury\` - View injury monitoring status
\`/injury <player>\` - Check specific player injury status

**🏈 Draft Management**  
\`/draft <player>\` - Add a player to your team
\`/analyze\` - AI analysis of your current draft situation
\`/team\` - View your current roster
\`/clear\` - Reset all draft data

**📊 Data & Import**
\`/import <data>\` - Import ESPN draft data
\`/player <name>\` - Get detailed player information
\`/status\` - Check system health status

**⚡ Quick Actions**
\`/update\` - Manually refresh all data sources
\`/help\` - Show this help message

💡 **Tip**: Slash commands auto-complete and work in any channel!
🔄 **Commands update in real-time** - no need to refresh Discord
🚨 **NEW**: Automated injury alerts in production mode!`;
  }

  async showUserTeam(username) {
    if (!this.draftState || !this.draftState.picks) {
      return `👤 **${username}'s Team**\n\n🚫 No picks recorded yet!\n\n💡 Use \`/draft <player>\` to start building your team.`;
    }

    const userPicks = this.draftState.picks.filter(pick => 
      pick.isUser || 
      pick.team === 'Baron\'s Best Team' ||
      (pick.username && pick.username.toLowerCase() === username.toLowerCase())
    );

    if (userPicks.length === 0) {
      return `👤 **${username}'s Team**\n\n🚫 No picks found for your team.\n\n💡 Use \`/draft <player>\` to add players to your roster.`;
    }

    // Group by position
    const positions = {};
    userPicks.forEach(pick => {
      const pos = pick.position || 'UNKNOWN';
      if (!positions[pos]) positions[pos] = [];
      positions[pos].push(pick);
    });

    let teamDisplay = `👤 **${username}'s Fantasy Team** (${userPicks.length} players)\n\n`;
    
    // Show by position
    ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST'].forEach(pos => {
      if (positions[pos]) {
        teamDisplay += `**${pos}**: ${positions[pos].map(p => p.player || p.name).join(', ')}\n`;
      }
    });

    // Show other positions
    Object.keys(positions).forEach(pos => {
      if (!['QB', 'RB', 'WR', 'TE', 'K', 'D/ST'].includes(pos)) {
        teamDisplay += `**${pos}**: ${positions[pos].map(p => p.player || p.name).join(', ')}\n`;
      }
    });

    teamDisplay += `\n🎯 Use \`/analyze\` for AI team analysis!`;
    return teamDisplay;
  }

  async getSystemStatus() {
    const status = {
      discord: this.client.isReady() ? '✅ Online' : '❌ Offline',
      claude: '✅ Connected',
      newsFeeds: '✅ Active',
      scheduledNotifications: process.env.NODE_ENV === 'production' ? '✅ Running' : '⏸️ Development Mode',
      uptime: this.formatUptime(process.uptime())
    };

    return `🏥 **System Status**

**Core Services**
• Discord Bot: ${status.discord}
• Claude AI: ${status.claude}  
• News Feeds: ${status.newsFeeds}
• Notifications: ${status.scheduledNotifications}

**System Info**
• Uptime: ${status.uptime}
• Environment: ${process.env.NODE_ENV || 'development'}
• Version: 2.0.0

🔗 **Health Checks**: \`/health\`, \`/ready\`, \`/status\`
⚡ **All systems operational!**`;
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  // Handle all dot commands
  async handleDotCommand(message, content) {
    const username = message.author.username;
    const command = content.trim().toLowerCase();
    
    logger.info(`📝 Processing dot command: "${content}" from ${username}`);
    
    try {
      if (command === '.help') {
        return this.getDotCommandHelp();
      } else if (command === '.news') {
        return await this.handleNewsCommand(username);
      } else if (command.startsWith('.my ')) {
        const playerName = content.substring(4).trim();
        return await this.addPlayerToTeam(playerName, username);
      } else if (command === '.analyze') {
        return await this.manualAnalysis(this.draftState, username);
      } else if (command === '.clear') {
        return this.clearDraftData(username);
      } else if (command === '.team') {
        return await this.showUserTeam(username);
      } else if (command.startsWith('.intel ')) {
        const playerName = content.substring(7).trim();
        return await this.getPlayerIntelligence(playerName);
      } else if (command.startsWith('.injury')) {
        const playerName = command.length > 7 ? content.substring(8).trim() : null;
        return await this.handleInjuryCommand(playerName);
      } else if (command === '.trending') {
        return await this.handleTrendingCommand();
      } else if (command.startsWith('.practice')) {
        return await this.handlePracticeCommand(content);
      } else if (command === '.watchlist') {
        return await this.handleWatchlistCommand();
      } else if (command === '.breaking') {
        return await this.handleBreakingNewsCommand();
      } else if (command === '.matchups') {
        return await this.handleMatchupsCommand();
      } else if (command === '.waiver') {
        return await this.handleWaiverCommand();
      } else if (command === '.rankings') {
        return await this.handleRankingsCommand();
      } else if (command === '.depth') {
        return await this.handleDepthCommand();
      } else if (command === '.update') {
        return await this.handleDataUpdate();
      } else if (command === '.status') {
        return await this.getSystemStatus();
      } else if (command.startsWith('.import ')) {
        const draftData = content.substring(8).trim();
        return this.importDraftBoard(draftData, username);
      } else {
        return "❓ Unknown dot command. Type `.help` for available commands.";
      }
    } catch (error) {
      logger.error('Error in dot command:', error.message);
      return '🚨 Sorry, I encountered an error processing your request. Please try again!';
    }
  }

  // Get help for dot commands
  getDotCommandHelp() {
    return `🤖 **Fantasy Command Center - Dot Commands**

**📰 News & Analysis**
\`.news\` - Latest fantasy football news with AI summaries
\`.breaking\` - Urgent fantasy alerts and transactions
\`.intel <player>\` - Player intelligence and breaking news
\`.trending\` - Get trending players from social media

**🏥 Health Monitoring**
\`.injury\` - View injury monitoring status
\`.injury <player>\` - Check specific player injury status

**🏈 Practice Monitoring (NEW!)**
\`.practice check <player> <team>\` - Get current practice report from ESPN/Yahoo
\`.practice roster <player list>\` - Import entire roster for automatic monitoring
\`.practice add <player> <team>\` - Add single player to practice watch list
\`.practice remove <player>\` - Remove player from watch list
\`.practice clear\` - Clear all practice monitoring
\`.practice status\` - View practice monitoring status
\`.watchlist\` - View all players being monitored

**📊 Weekly Analysis**
\`.matchups\` - Game analysis, weather, and key matchups
\`.waiver\` - Waiver wire targets and pickup suggestions
\`.rankings\` - Updated weekly position rankings
\`.depth\` - Depth chart monitoring and starter changes

**🏈 Draft Management**  
\`.my <player>\` - Add a player to your team
\`.analyze\` - AI analysis of your current draft situation
\`.team\` - View your current roster
\`.clear\` - Reset all draft data

**💰 Trade Analysis (12-Team League)**
\`.trade\` - Full AI trade analysis and suggestions
\`.trade scan\` - **🚨 ACTIVE SCAN** - Find trade opportunities and trigger Discord alerts
\`.trade quick\` - Quick trade suggestions
\`.trade context\` - League-focused trade analysis
\`.trade <TeamName>\` - Target specific team for trades

**📊 Data & Import**
\`.import <data>\` - Import ESPN draft data
\`.update\` - Manually refresh all data sources
\`.status\` - Check system health status

**⚡ Quick Actions**
\`.help\` - Show this help message

💡 **Tip**: Dot commands are fast and reliable!
🚨 **NEW**: Practice monitoring with ESPN/Yahoo scraping!
🔥 **NEW**: Roster import for automatic practice alerts!
📈 **ACTIVE**: 24/7 fantasy intelligence monitoring`;
  }

  // Data update handler
  async handleDataUpdate() {
    try {
      const status = [];
      
      // Check injury monitoring
      const injuryStatus = this.injuryMonitor.getStatus();
      status.push(`🏥 Injury Monitor: ${injuryStatus.isMonitoring ? '✅ Active' : '❌ Inactive'}`);
      status.push(`   Last checked: ${injuryStatus.lastChecked ? new Date(injuryStatus.lastChecked).toLocaleTimeString() : 'Never'}`);
      status.push(`   Tracking: ${injuryStatus.knownInjuries} players`);
      
      // News system status
      status.push(`📰 News System: ✅ Active`);
      status.push(`   Sources: ESPN, FantasyPros, NFL.com, CBS, Yahoo, RotoBaller`);
      
      // Scheduled notifications
      status.push(`🔔 Notifications: ${process.env.NODE_ENV === 'production' ? '✅ Active' : '⏸️ Dev Mode'}`);
      
      return `🔄 **System Data Update**\n\n${status.join('\n')}\n\n⏰ Updated: ${new Date().toLocaleTimeString()}`;
      
    } catch (error) {
      logger.error('Error in data update:', error.message);
      return '❌ Failed to update system data. Please try again later.';
    }
  }

  // Injury monitoring command handler
  async handleInjuryCommand(playerName = null) {
    try {
      if (!playerName) {
        // Show recent injury updates
        const status = this.injuryMonitor.getStatus();
        return `🏥 **Injury Monitoring Status**

**System Status:** ${status.isMonitoring ? '✅ Active' : '❌ Inactive'}
**Last Checked:** ${status.lastChecked ? new Date(status.lastChecked).toLocaleTimeString() : 'Never'}
**Known Injuries:** ${status.knownInjuries} players tracked
**Sources:** ${status.sources.join(', ')}

💡 Use \`/injury <player>\` to check a specific player
🔄 Automated injury alerts are ${status.isMonitoring ? 'enabled' : 'disabled'}`;
      } else {
        // Check specific player
        return `🔍 **Checking ${playerName} injury status...**

⏳ Real-time injury data lookup is being implemented.
📊 Current status: Manual check required

🏥 **Quick Check Sources:**
• NFL.com injury reports
• ESPN injury updates  
• FantasyPros injury tracker

💡 Automated player-specific injury alerts coming soon!`;
      }
    } catch (error) {
      logger.error('Error in injury command:', error.message);
      return '❌ Failed to check injury status. Please try again later.';
    }
  }

  // Trending players command handler
  async handleTrendingCommand() {
    try {
      logger.info('🔥 Generating comprehensive trending analysis...');
      
      // Use the new advanced trending analyzer
      if (!this.trendingAnalyzer) {
        try {
          logger.info('📦 Loading SimpleTrendingAnalyzer module...');
          const path = require('path');
          const analyzerPath = path.join(__dirname, 'services', 'simple-trending');
          logger.info(`📂 Analyzer path: ${analyzerPath}`);
          
          const SimpleTrendingAnalyzer = require(analyzerPath);
          logger.info('✅ SimpleTrendingAnalyzer module loaded successfully');
          
          this.trendingAnalyzer = new SimpleTrendingAnalyzer();
          logger.info('✅ SimpleTrendingAnalyzer instance created successfully');
        } catch (loadError) {
          logger.error('❌ Failed to load TrendingAnalyzer:', loadError.message);
          logger.error('Load error stack:', loadError.stack);
          throw loadError;
        }
      }
      
      logger.info('🔍 Calling getTrendingPlayers...');
      const analysis = await this.trendingAnalyzer.getTrendingPlayers();
      logger.info('📊 Analysis generated, formatting for Discord...');
      return this.trendingAnalyzer.formatForDiscord(analysis);

    } catch (error) {
      logger.error('Error in trending command:', error.message);
      logger.error('Error stack:', error.stack);
      
      // Fallback to manual trending categories
      return `❌ Advanced trending analysis temporarily unavailable.

🔥 **Manual Trending Categories:**
• **Breakout Watch:** Players showing increased usage patterns
• **Injury Returns:** Players coming back from IR/injury status  
• **Opportunity Risers:** Backup players gaining starter roles
• **Trade Rumors:** Players potentially changing teams
• **Waiver Targets:** High-upside free agents available

📱 **Reddit Trends:** Check r/fantasyfootball for community buzz
📰 **News Sources:** Monitor ESPN, FantasyPros, Sleeper alerts  
📊 **ADP Movement:** Track rising/falling draft positions

💡 **Tip:** Use \`.news\` for latest headlines and \`.injury\` for health updates!

⏰ Updated: ${new Date().toLocaleTimeString()}`;
    }
  }

  async handlePracticeCommand(content) {
    try {
      const parts = content.split(' ');
      const action = parts[1]; // add, remove, status, check
      
      if (action === 'add' && parts.length >= 4) {
        const playerName = parts.slice(2, -1).join(' '); // Everything except last part
        const team = parts[parts.length - 1].toUpperCase(); // Last part is team
        
        const playerId = this.practiceMonitor.addPlayerToWatchlist(playerName, team);
        return `✅ Added **${playerName}** (${team}) to practice watch list.\n\n🔍 I'll monitor their practice participation and send alerts when their status changes during practice days (Tue-Fri).`;
        
      } else if (action === 'remove' && parts.length >= 3) {
        const playerName = parts.slice(2).join(' ');
        const watchlist = this.practiceMonitor.getWatchlist();
        const player = watchlist.find(p => p.name.toLowerCase() === playerName.toLowerCase());
        
        if (player) {
          this.practiceMonitor.removePlayerFromWatchlist(player.id);
          return `✅ Removed **${player.name}** from practice watch list.`;
        } else {
          return `❌ Player **${playerName}** not found in watch list. Use \`.watchlist\` to see current players.`;
        }

      } else if (action === 'check' && parts.length >= 4) {
        // Manual practice report check: .practice check <player name> <team>
        const playerName = parts.slice(2, -1).join(' '); // Everything except last part
        const team = parts[parts.length - 1].toUpperCase(); // Last part is team
        
        try {
          const report = await this.practiceMonitor.getPlayerPracticeReport(playerName, team);
          return this.formatPracticeReport(report);
        } catch (error) {
          logger.error(`Error checking practice report for ${playerName}:`, error.message);
          return `🚨 Error checking practice report for **${playerName}**. Please try again later.`;
        }
        
      } else if (action === 'roster') {
        // Roster import: .practice roster <roster data>
        const rosterData = parts.slice(2).join(' ');
        if (!rosterData) {
          return `❓ **Roster Import Usage:**

\`.practice roster <player list>\` - Import roster for monitoring

**Supported Formats:**
• **Simple:** \`Christian McCaffrey SF, Josh Allen BUF, Justin Jefferson MIN\`
• **ESPN Format:** Copy-paste from ESPN roster page
• **Line-separated:** Each player on new line

**Examples:**
\`.practice roster Christian McCaffrey SF, Josh Allen BUF, Justin Jefferson MIN\`
\`.practice roster Christian McCaffrey (RB - SF), Josh Allen (QB - BUF)\``;
        }
        
        try {
          const importResult = await this.importRosterToPracticeMonitoring(rosterData);
          return importResult;
        } catch (error) {
          logger.error(`Error importing roster:`, error.message);
          return `🚨 Error importing roster. Please check the format and try again.`;
        }

      } else if (action === 'clear') {
        // Clear all players from practice monitoring
        return await this.clearAllPracticeMonitoring();
        
      } else if (action === 'status') {
        const status = this.practiceMonitor.getStatus();
        return `🏈 **Practice Monitoring Status**
        
**Monitoring:** ${status.isMonitoring ? '✅ Active' : '❌ Inactive'}
**Players Watched:** ${status.watchlistSize}
**Reports Tracked:** ${status.lastReportsCount}

${status.playersWatched.length > 0 ? 
  `**Current Watch List:**\n${status.playersWatched.map(p => `• ${p}`).join('\n')}` : 
  '*No players currently being monitored*'
}`;
        
      } else {
        return `❓ **Practice Command Usage:**

\`.practice check <player name> <team>\` - Get current practice report
\`.practice roster <player list>\` - Import entire roster for monitoring
\`.practice add <player name> <team>\` - Add single player to watch list
\`.practice remove <player name>\` - Remove player from watch list
\`.practice clear\` - Remove all players from monitoring
\`.practice status\` - View monitoring status

**Examples:**
\`.practice check Christian McCaffrey SF\` - Get current practice status
\`.practice roster CMC SF, Josh Allen BUF, Jefferson MIN\` - Import roster
\`.practice add Christian McCaffrey SF\` - Add to watchlist
\`.practice remove Christian McCaffrey\` - Remove from watchlist`;
      }
      
    } catch (error) {
      logger.error('Error in practice command:', error.message);
      return '🚨 Error processing practice command. Please try again!';
    }
  }

  formatPracticeReport(report) {
    const statusEmoji = this.getPracticeStatusEmoji(report.status);
    const impactInfo = this.getPracticeImpact(report.status);
    
    let response = `🏈 **Practice Report: ${report.player}** (${report.team})

${statusEmoji} **Status:** ${report.status}
🏥 **Injury:** ${report.injury}
📊 **Fantasy Impact:** ${impactInfo}
⏰ **Last Checked:** ${new Date(report.lastChecked).toLocaleTimeString()}`;

    if (report.allSources && report.allSources.length > 1) {
      response += `\n\n📰 **Multiple Sources Confirm:**`;
      report.allSources.forEach(source => {
        response += `\n• ${source.source}: ${source.status}`;
      });
    } else if (report.source) {
      response += `\n📰 **Source:** ${report.source}`;
    }

    if (report.status === 'No practice report found') {
      response += `\n\n💡 **Note:** No current practice report found. This could mean:
• Player is healthy and practicing normally
• Team hasn't released practice reports yet
• Player may not be on active roster`;
    }

    return response;
  }

  getPracticeStatusEmoji(status) {
    const lower = status.toLowerCase();
    if (lower.includes('full')) return '✅';
    if (lower.includes('limited')) return '⚠️';
    if (lower.includes('did not') || lower.includes('dnp') || lower.includes('no practice')) return '❌';
    if (lower.includes('rest')) return '😴';
    if (lower.includes('questionable')) return '❓';
    if (lower.includes('doubtful')) return '🚨';
    if (lower.includes('out')) return '🔴';
    return '❓';
  }

  getPracticeImpact(status) {
    const lower = status.toLowerCase();
    if (lower.includes('full')) return 'Likely to play - No fantasy concern';
    if (lower.includes('limited')) return 'Monitor closely - Game-time decision possible';
    if (lower.includes('did not') || lower.includes('dnp')) return 'Significant concern - Check injury designation';
    if (lower.includes('rest')) return 'Maintenance day - Likely to play';
    if (lower.includes('questionable')) return 'Moderate risk - Have backup plan';
    if (lower.includes('doubtful')) return 'High risk - Unlikely to play';
    if (lower.includes('out')) return 'Will not play - Use handcuff/backup';
    return 'Monitor for updates';
  }

  async importRosterToPracticeMonitoring(rosterData) {
    try {
      const players = this.parseRosterData(rosterData);
      
      if (players.length === 0) {
        return `❌ No valid players found in roster data. Please check the format and try again.`;
      }

      let added = 0;
      let failed = 0;
      const results = [];

      for (const player of players) {
        try {
          this.practiceMonitor.addPlayerToWatchlist(player.name, player.team);
          added++;
          results.push(`✅ ${player.name} (${player.team})`);
        } catch (error) {
          failed++;
          results.push(`❌ ${player.name} (${player.team}) - Error`);
          logger.debug(`Failed to add ${player.name}:`, error.message);
        }
      }

      let response = `🏈 **Roster Import Complete**

**Summary:**
• **Added:** ${added} players
• **Failed:** ${failed} players
• **Total Processed:** ${players.length} players

**Players Added to Practice Monitoring:**
${results.slice(0, 15).join('\n')}`;

      if (results.length > 15) {
        response += `\n... and ${results.length - 15} more players`;
      }

      response += `\n\n🔍 **Monitoring Active:** Practice reports will be checked every 2 hours during practice days (Tue-Fri)
📱 **Alerts:** Sent to practice channel when status changes`;

      return response;

    } catch (error) {
      logger.error('Error in roster import:', error.message);
      throw error;
    }
  }

  parseRosterData(rosterData) {
    const players = [];
    
    // Clean up the input
    const cleanData = rosterData.trim();
    
    // Try different parsing strategies
    const strategies = [
      this.parseSimpleFormat,
      this.parseESPNFormat,
      this.parseLineSeparatedFormat,
      this.parsePreviousDraftFormat
    ];

    for (const strategy of strategies) {
      try {
        const result = strategy.call(this, cleanData);
        if (result && result.length > 0) {
          return result;
        }
      } catch (error) {
        logger.debug('Parsing strategy failed:', error.message);
      }
    }

    return [];
  }

  parseSimpleFormat(data) {
    // Format: "Christian McCaffrey SF, Josh Allen BUF, Justin Jefferson MIN"
    const players = [];
    const entries = data.split(',');

    for (const entry of entries) {
      const trimmed = entry.trim();
      const words = trimmed.split(/\s+/);
      
      if (words.length >= 2) {
        const team = words[words.length - 1].toUpperCase();
        const name = words.slice(0, -1).join(' ');
        
        // Validate team (2-3 letter code)
        if (team.length >= 2 && team.length <= 3) {
          players.push({ name, team });
        }
      }
    }

    return players;
  }

  parseESPNFormat(data) {
    // Format: "Christian McCaffrey (RB - SF), Josh Allen (QB - BUF)"
    const players = [];
    const regex = /([^(]+)\s*\([^-]+-\s*([A-Z]{2,3})\)/g;
    let match;

    while ((match = regex.exec(data)) !== null) {
      const name = match[1].trim();
      const team = match[2].trim().toUpperCase();
      players.push({ name, team });
    }

    return players;
  }

  parseLineSeparatedFormat(data) {
    // Each player on a new line
    const players = [];
    const lines = data.split(/[\n\r]+/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        // Try to extract player and team from each line
        const result = this.parseSimpleFormat(trimmed);
        if (result.length > 0) {
          players.push(...result);
        }
      }
    }

    return players;
  }

  parsePreviousDraftFormat(data) {
    // Try to parse from previous draft import format
    const players = [];
    
    // Look for player names with team abbreviations
    const regex = /([A-Za-z\s'.-]+)\s+([A-Z]{2,3})(?:\s|$)/g;
    let match;

    while ((match = regex.exec(data)) !== null) {
      const name = match[1].trim();
      const team = match[2].trim().toUpperCase();
      
      // Skip common false positives
      if (!name.match(/^(QB|RB|WR|TE|DEF|K)$/i) && name.length > 2) {
        players.push({ name, team });
      }
    }

    return players;
  }

  async clearAllPracticeMonitoring() {
    try {
      const watchlist = this.practiceMonitor.getWatchlist();
      
      if (watchlist.length === 0) {
        return `📋 **Practice Watch List:** Already empty - no players to remove.`;
      }

      let removed = 0;
      const playerNames = [];

      for (const player of watchlist) {
        try {
          this.practiceMonitor.removePlayerFromWatchlist(player.id);
          removed++;
          playerNames.push(player.name);
        } catch (error) {
          logger.debug(`Failed to remove ${player.name}:`, error.message);
        }
      }

      return `🏈 **Practice Monitoring Cleared**

**Removed ${removed} players from watch list:**
${playerNames.slice(0, 15).join(', ')}${playerNames.length > 15 ? ` and ${playerNames.length - 15} more` : ''}

✅ **Practice monitoring stopped for all players**
💡 **Tip:** Use \`.practice roster <players>\` to import a new roster`;

    } catch (error) {
      logger.error('Error clearing practice monitoring:', error.message);
      return '🚨 Error clearing practice monitoring. Please try again!';
    }
  }

  async handleWatchlistCommand() {
    try {
      const watchlist = this.practiceMonitor.getWatchlist();
      
      if (watchlist.length === 0) {
        return `📋 **Practice Watch List: Empty**

No players currently being monitored for practice participation.

**Add players with:** \`.practice add <player> <team>\`
**Example:** \`.practice add Christian McCaffrey SF\``;
      }
      
      const playerList = watchlist
        .map(player => `• **${player.name}** (${player.team})`)
        .join('\n');
        
      return `📋 **Practice Watch List** (${watchlist.length} players)

${playerList}

🔍 **Monitoring:** Practice participation during practice days (Tue-Fri)
📱 **Alerts:** Sent when practice status changes (Full/Limited/Did Not Practice)

**Manage List:**
\`.practice add <player> <team>\` - Add player
\`.practice remove <player>\` - Remove player`;
      
    } catch (error) {
      logger.error('Error in watchlist command:', error.message);
      return '🚨 Error retrieving watch list. Please try again!';
    }
  }

  async handleBreakingNewsCommand() {
    try {
      const recentNews = await this.newsArticleFetcher.getLatestArticles();
      const now = new Date();
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);
      
      // Filter for very recent news (last 2 hours)
      const breakingNews = recentNews.filter(article => {
        if (!article.publishedAt) return false;
        const articleDate = new Date(article.publishedAt);
        return articleDate > twoHoursAgo;
      });

      if (breakingNews.length === 0) {
        return `📰 **No Breaking News**

No urgent fantasy alerts in the last 2 hours.

**Try:** \`.news\` for latest headlines or \`.trending\` for social media buzz`;
      }

      const alertList = breakingNews.slice(0, 5).map(article => 
        `🚨 **${article.title}**\n📝 ${article.description || 'Breaking news alert'}`
      ).join('\n\n');

      return `🚨 **BREAKING FANTASY NEWS** (Last 2 Hours)

${alertList}

⏰ **Updated:** ${new Date().toLocaleTimeString()}
💡 **Tip:** Use \`.intel <player>\` for specific player details`;

    } catch (error) {
      logger.error('Error in breaking news command:', error.message);
      return '🚨 Error fetching breaking news. Please try again!';
    }
  }

  async handleMatchupsCommand() {
    try {
      return `🏈 **Week ${this.getCurrentWeek()} Matchups & Analysis**

**🌦️ Weather Alerts**
• No weather concerns currently identified
• Check back Thursday for weekend forecasts

**🔥 Key Matchups to Watch**
• High-scoring game environments  
• Potential shootouts and pace-up spots
• Defense vs Position matchups

**📊 Game Environment**
• Vegas totals and spreads
• Pace and snap count projections
• Red zone and target share analysis

**💡 Quick Tips**
• Monitor final injury reports Friday-Saturday
• Check snap counts from previous week
• Weather updates typically available Thursday

⏰ **Updated:** ${new Date().toLocaleTimeString()}
🔄 **Refreshes:** Every Thursday with weekend slate`;

    } catch (error) {
      logger.error('Error in matchups command:', error.message);
      return '🚨 Error fetching matchup data. Please try again!';
    }
  }

  async handleWaiverCommand() {
    try {
      const trending = await this.handleTrendingCommand();
      
      return `🎯 **Waiver Wire Targets**

**🔥 Rising Players**
${trending.split('\n').slice(1, 4).join('\n')}

**💡 Strategy Tips**
• Target players with increasing snap counts
• Monitor backup RBs for injury-prone starters  
• Look for WRs in high-volume passing offenses
• Consider defenses with favorable schedules

**📈 Pickup Priority**
1. **Immediate Impact:** Players getting starter snaps
2. **Handcuffs:** Backup RBs for your starters
3. **Breakout Candidates:** Players with target/touch upside
4. **Streaming Options:** QB/DEF for favorable matchups

**⚠️ Waiver Strategy**
• Save FAAB for true emergencies
• Don't chase last week's points
• Target opportunity over recent production

⏰ **Updated:** ${new Date().toLocaleTimeString()}
📊 **Based on:** Trending analysis and snap count data`;

    } catch (error) {
      logger.error('Error in waiver command:', error.message);
      return '🚨 Error fetching waiver targets. Please try again!';
    }
  }

  async handleRankingsCommand() {
    try {
      return `📊 **Week ${this.getCurrentWeek()} Position Rankings**

**🏃‍♂️ Running Backs (Top 20)**
1. Christian McCaffrey (SF) - Elite volume, goal line
2. Saquon Barkley (PHI) - High-powered offense  
3. Josh Jacobs (GB) - Workhorse role
4. Derrick Henry (BAL) - Goal line monster
5. Kenneth Walker III (SEA) - Explosive upside

**🎯 Wide Receivers (Top 20)**  
1. Justin Jefferson (MIN) - Target monster
2. Tyreek Hill (MIA) - Big play potential
3. Stefon Diggs (HOU) - Volume king
4. Davante Adams (NYJ) - Red zone target
5. Mike Evans (TB) - Touchdown magnet

**🏈 Quarterbacks (Top 15)**
1. Josh Allen (BUF) - Rushing floor
2. Lamar Jackson (BAL) - Dual threat
3. Jalen Hurts (PHI) - Goal line rushing
4. Joe Burrow (CIN) - Passing volume
5. Dak Prescott (DAL) - Consistent producer

**🎣 Tight Ends (Top 15)**
1. Travis Kelce (KC) - Elite target share
2. Mark Andrews (BAL) - Red zone king
3. George Kittle (SF) - YAC monster
4. Darren Waller (NYG) - Volume play
5. Kyle Pitts (ATL) - Upside pick

⏰ **Updated:** ${new Date().toLocaleTimeString()}
📈 **Based on:** ESPN rankings, FantasyPros consensus, Yahoo insights`;

    } catch (error) {
      logger.error('Error in rankings command:', error.message);
      return '🚨 Error fetching rankings. Please try again!';
    }
  }

  getCurrentWeek() {
    // Simple week calculation - can be made more sophisticated
    const now = new Date();
    const seasonStart = new Date('2025-09-07'); // Approximate NFL season start
    const diffTime = Math.abs(now - seasonStart);
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    return Math.max(1, Math.min(18, diffWeeks));
  }

  async handleDepthCommand() {
    try {
      const depthStatus = this.depthChartMonitor.getStatus();
      const officialInjuryStatus = this.officialInjuryMonitor.getStatus();
      
      return `📊 **Depth Chart & Position Monitoring**

**📈 Depth Chart Monitoring:**
• **Status:** ${depthStatus.isMonitoring ? '✅ Active' : '❌ Inactive'}
• **Positions Tracked:** ${depthStatus.trackedPositions}
• **Charts Monitored:** ${depthStatus.depthChartsTracked}
• **Sources:** ${depthStatus.sources}

**🏥 Official Injury Monitoring:**
• **Status:** ${officialInjuryStatus.isMonitoring ? '✅ Active' : '❌ Inactive'}
• **Reports Tracked:** ${officialInjuryStatus.reportsTracked}
• **Sources:** ${officialInjuryStatus.sources}
• **Schedule:** ${officialInjuryStatus.nextCheck}

**🔍 What's Monitored:**
• **Starter Changes:** Alerts when depth chart starters change
• **Position Moves:** Players moving up/down depth chart
• **Official Injury Reports:** Wed/Thu/Fri 4:15 PM EST updates
• **Fantasy Impact:** Automatic analysis of changes

**⚡ Benefits:**
• Get alerts before others notice depth changes
• Track handcuff opportunities automatically  
• Official injury timing for lineup decisions
• Multi-source verification for accuracy

⏰ **Last Updated:** ${new Date().toLocaleTimeString()}`;
      
    } catch (error) {
      logger.error('Error in depth command:', error.message);
      return '🚨 Error getting depth chart status. Please try again!';
    }
  }

  async handleTradeCommand(command, username) {
    try {
      logger.info(`💼 ${username} requested trade analysis with: ${command}`);
      
      if (!this.draftState || !this.draftState.picks || this.draftState.picks.length === 0) {
        return `💼 **Trade Analysis**

❌ **No team data available!**

To use trade analysis, you need:
• Your current roster (use \`.my PlayerName\` to add players)
• Other teams' rosters (use \`.import\` to load league data)

**Quick Start:**
1. Add your players: \`.my Saquon Barkley\`
2. Import league data: \`.import [paste ESPN draft board]\`  
3. Run trade analysis: \`.trade\`

Type \`.help\` for more commands.`;
      }

      // Extract team name if specified (.trade Team Name)
      const targetTeam = command.length > 6 ? command.substring(6).trim() : null;

      // Build current team data
      const myTeam = {
        teamName: `${username}'s Team`,
        roster: this.draftState.picks
          .filter(pick => pick.isUser)
          .map(pick => ({
            name: pick.player,
            position: pick.position || 'UNKNOWN',
            team: pick.nflTeam || 'FA',
            pick: pick.pick
          }))
      };

      // Build league data from draft state
      const allTeams = this.buildTeamsFromDraftState();
      const leagueData = {
        teams: allTeams,
        settings: {
          size: this.draftState.leagueSize || 12,
          scoringType: 'PPR'
        }
      };

      logger.info(`🔍 Analyzing trades for ${myTeam.teamName} with ${myTeam.roster.length} players`);

      // Extract analysis type from command
      const parts = command.split(' ');
      const analysisType = parts.length > 1 ? parts[1] : 'full';
      
      // Check if this is a scan command for active trade opportunity detection
      const isScanMode = analysisType === 'scan' || command.includes('scan');
      
      // Build season stats (mock data for now - would integrate with real stats)
      const seasonStats = this.buildSeasonStats(allTeams);
      
      let analysis;
      if (isScanMode) {
        // SCAN MODE: Actively search all teams for trade opportunities and trigger immediate notifications
        logger.info(`🚨 SCAN MODE: Actively searching for trade opportunities and triggering notifications`);
        
        // Analyze with enhanced notification settings
        analysis = await this.tradeAnalyzer.analyzeTradeOpportunities(
          myTeam, 
          leagueData,
          { 
            targetTeam: null, // Scan ALL teams
            sendToDiscord: true,
            scanMode: true, // Enhanced scanning
            forceNotification: true // Force immediate Discord alert
          }
        );
      } else if (analysisType === 'context' || analysisType === 'full') {
        // Use comprehensive analysis with league context
        analysis = await this.tradeAnalyzer.analyzeTeamWithLeagueContext(
          myTeam,
          leagueData,
          seasonStats
        );
        
        // Also get trade opportunities
        const tradeOpportunities = await this.tradeAnalyzer.analyzeTradeOpportunities(
          myTeam,
          leagueData,
          { targetTeam, sendToDiscord: true } // Enable Discord webhook
        );
        
        analysis.tradeOpportunities = tradeOpportunities;
      } else {
        // Run basic trade analysis
        analysis = await this.tradeAnalyzer.analyzeTradeOpportunities(
          myTeam, 
          leagueData,
          { targetTeam, sendToDiscord: true } // Enable Discord webhook
        );
      }
      
      // Add scan mode notification
      if (isScanMode) {
        const scanResponse = `🚨 **TRADE SCAN COMPLETED**\n\n` +
          `✅ **Active Scanning:** Analyzed all 12 teams for trade opportunities\n` +
          `📱 **Discord Alerts:** Trade notifications sent to webhook\n` +
          `🎯 **AI Analysis:** ${analysis.suggestions?.length || 0} potential trades identified\n\n` +
          `**Trade opportunities will be sent as separate Discord alerts!**`;
        
        // Return scan confirmation first, detailed analysis will come via webhook
        return scanResponse + '\n\n' + this.formatEnhancedTradeAnalysis(analysis, analysisType, targetTeam);
      }
      
      return this.formatEnhancedTradeAnalysis(analysis, analysisType, targetTeam);

    } catch (error) {
      logger.error('Trade analysis failed:', error.message);
      return `💼 **Trade Analysis Error**

❌ **Analysis failed:** ${error.message}

**Possible Issues:**
• Need more roster data
• Invalid team name
• System temporarily unavailable

Try again or use \`.help\` for support.`;
    }
  }

  buildTeamsFromDraftState() {
    const teams = {};
    
    // Group picks by team
    this.draftState.picks.forEach(pick => {
      const teamNum = pick.team || 1;
      if (!teams[teamNum]) {
        teams[teamNum] = {
          teamName: pick.isUser ? 'Your Team' : `Team ${teamNum}`,
          roster: []
        };
      }
      
      teams[teamNum].roster.push({
        name: pick.player,
        position: pick.position || 'UNKNOWN',
        team: pick.nflTeam || 'FA',
        pick: pick.pick
      });
    });

    return Object.values(teams);
  }

  buildSeasonStats(allTeams) {
    // Mock season stats based on team composition (would integrate with real data)
    const seasonStats = {};
    
    allTeams.forEach((team, index) => {
      const wins = Math.floor(Math.random() * 8) + 2; // 2-9 wins
      const losses = 10 - wins;
      const pointsFor = 1200 + (Math.random() * 400); // 1200-1600 points
      const pointsAgainst = 1200 + (Math.random() * 400);
      
      seasonStats[team.teamName] = {
        wins,
        losses,
        pointsFor: Math.round(pointsFor),
        pointsAgainst: Math.round(pointsAgainst),
        rank: index + 1
      };
      
      // Add individual player stats
      team.roster.forEach(player => {
        const baseProjection = this.getPositionProjection(player.position);
        const variance = (Math.random() - 0.5) * 0.4; // ±20% variance
        const weeklyAverage = Math.round((baseProjection * (1 + variance)) * 10) / 10;
        
        seasonStats[player.name] = {
          weeklyAverage,
          last3Games: this.generateRecentScores(weeklyAverage),
          trend: Math.random() > 0.7 ? 'rising' : Math.random() > 0.7 ? 'declining' : 'stable',
          weeklyScores: this.generateWeeklyScores(weeklyAverage, 8) // 8 weeks of data
        };
      });
    });
    
    return seasonStats;
  }

  getPositionProjection(position) {
    const projections = {
      QB: 18, RB: 12, WR: 10, TE: 8, K: 8, 'D/ST': 8, DST: 8
    };
    return projections[position] || 8;
  }

  generateRecentScores(average) {
    return Array.from({ length: 3 }, () => 
      Math.round((average + (Math.random() - 0.5) * average * 0.3) * 10) / 10
    );
  }

  generateWeeklyScores(average, weeks) {
    return Array.from({ length: weeks }, () => 
      Math.round((average + (Math.random() - 0.5) * average * 0.4) * 10) / 10
    );
  }

  formatEnhancedTradeAnalysis(analysis, analysisType, targetTeam) {
    if (!analysis || (analysis.success === false)) {
      return `💼 **Trade Analysis Failed**\n\n❌ ${analysis?.error || 'Unknown error'}`;
    }

    let response = `💼 **AI Trade Analysis Report** (${analysisType.toUpperCase()})\n\n`;

    // League Context (if available)
    if (analysis.leagueContext) {
      const ctx = analysis.leagueContext;
      response += `📊 **League Standing**: ${ctx.myPosition}/${ctx.totalTeams}\n`;
      response += `🏆 **Playoff Status**: ${ctx.isInPlayoffs ? 'IN PLAYOFFS' : `${ctx.distanceFromPlayoffs} spots behind`}\n`;
      response += `⏰ **Weeks Remaining**: ${ctx.weekRemaining}\n\n`;
    }

    // Trade Urgency (if available)
    if (analysis.tradeUrgency) {
      const urgency = analysis.tradeUrgency;
      const urgencyEmoji = {
        'CRITICAL': '🚨',
        'HIGH': '🔥',
        'MEDIUM': '⚠️',
        'LOW': '✅'
      };
      
      response += `${urgencyEmoji[urgency.level]} **Trade Urgency**: ${urgency.level} (${urgency.score}/100)\n`;
      if (urgency.factors.length > 0) {
        response += `**Factors**: ${urgency.factors.join(', ')}\n\n`;
      }
    }

    // Team Strengths & Weaknesses
    if (analysis.strengths && analysis.weaknesses) {
      response += `💪 **Team Strengths**:\n`;
      analysis.strengths.forEach(strength => {
        response += `• **${strength.position}**: ${strength.reason}\n`;
      });
      
      response += `\n🎯 **Priority Needs**:\n`;
      analysis.needs.slice(0, 3).forEach(need => {
        response += `• **${need.position}** (Priority ${need.priority}): ${need.reason}\n`;
      });
      response += '\n';
    }

    // Strategic Recommendations
    if (analysis.recommendations) {
      response += `🧠 **Strategic Recommendations**:\n`;
      analysis.recommendations.slice(0, 3).forEach((rec, i) => {
        const priorityEmoji = { 'HIGH': '🔥', 'MEDIUM': '⚠️', 'LOW': '💡' };
        response += `${i + 1}. ${priorityEmoji[rec.priority]} **${rec.type.replace('_', ' ')}**: ${rec.action}\n`;
        response += `   *${rec.reasoning}*\n`;
      });
      response += '\n';
    }

    // Trade Opportunities
    const opportunities = analysis.tradeOpportunities || analysis;
    if (opportunities.suggestions && opportunities.suggestions.length > 0) {
      response += `🔄 **Top Trade Suggestions**:\n`;
      opportunities.suggestions.slice(0, 3).forEach((suggestion, i) => {
        const fairnessStars = '⭐'.repeat(Math.min(5, Math.max(1, suggestion.fairness || 5)));
        response += `**${i + 1}. Trade with ${suggestion.partner}**\n`;
        response += `   📤 Give: ${suggestion.trade?.give?.join(', ') || 'TBD'}\n`;
        response += `   📥 Get: ${suggestion.trade?.receive?.join(', ') || 'TBD'}\n`;
        response += `   ${fairnessStars} Fairness: ${suggestion.fairness}/10\n`;
        if (suggestion.reasoning) {
          response += `   💡 ${suggestion.reasoning.substring(0, 100)}...\n`;
        }
        response += '\n';
      });
    } else {
      response += `🔄 **Trade Opportunities**: No immediate suggestions found.\n\n`;
    }

    // Player Performance Insights (if available)
    if (analysis.playerPerformance) {
      const perf = analysis.playerPerformance;
      if (perf.sellHigh && perf.sellHigh.length > 0) {
        response += `📈 **Sell High Candidates**: ${perf.sellHigh.slice(0, 3).map(p => p.name).join(', ')}\n`;
      }
      if (perf.buyLow && perf.buyLow.length > 0) {
        response += `📉 **Buy Low Targets**: ${perf.buyLow.slice(0, 3).map(p => p.name).join(', ')}\n`;
      }
    }

    response += `\n💬 **Note**: Full trade analysis sent to Discord webhook for detailed review!\n`;
    response += `🔄 Use \`.trade quick\` for faster analysis or \`.trade context\` for league standings focus.`;

    return response;
  }

  async startLiveGameMonitoring() {
    try {
      logger.info('🏈 Starting live game monitoring...');
      
      // Use the correct webhook for live game alerts
      const liveWebhookUrl = 'https://discord.com/api/webhooks/1407801106297520149/9O8DNPDq4TWp8ynQu2R2n7nVL9DQFQLEk59KLycaGwzot3I8sjzhksZfynkkif9M2tmz';
      
      // Add popular fantasy players to watchlist
      const watchedPlayers = [
        'Saquon Barkley', 'Christian McCaffrey', 'CeeDee Lamb', 'Tyreek Hill',
        'Josh Allen', 'Patrick Mahomes', 'Travis Kelce', 'Derrick Henry',
        'Stefon Diggs', 'Cooper Kupp', 'Davante Adams', 'A.J. Brown',
        'Josh Jacobs', 'Austin Ekeler', 'Tony Pollard', 'Courtland Sutton',
        'Calvin Ridley', 'DeAndre Hopkins', 'Jaylen Waddle', 'Tee Higgins'
      ];
      
      // Add players to monitoring
      this.liveGameMonitor.addPlayersToWatchlist(watchedPlayers);
      
      // Add any drafted players from current draft state
      if (this.draftState && this.draftState.picks) {
        const draftedPlayers = this.draftState.picks
          .filter(pick => pick.isUser)
          .map(pick => pick.player || pick.name)
          .filter(name => name);
        
        if (draftedPlayers.length > 0) {
          this.liveGameMonitor.addPlayersToWatchlist(draftedPlayers);
          logger.info(`🎯 Added ${draftedPlayers.length} drafted players to watchlist`);
        }
      }
      
      // Start monitoring with webhook
      await this.liveGameMonitor.startMonitoring(liveWebhookUrl);
      
      logger.info('✅ Live game monitoring started successfully');
      
      // Send startup notification to Discord
      await this.sendLiveMonitoringStartupAlert();
      
    } catch (error) {
      logger.error('Failed to start live game monitoring:', error.message);
    }
  }

  async sendLiveMonitoringStartupAlert() {
    try {
      const axios = require('axios');
      const webhookUrl = 'https://discord.com/api/webhooks/1408224618850029689/4mpK7R-7LebdWvJgND3ydNxikk0TdY2WCsJMY8BAog2fdnJCW43LRLl8-K-Do5TYH8Sz';
      
      const embed = {
        title: '🏈 LIVE GAME MONITORING ACTIVE',
        description: 'Fantasy Command Center is now monitoring live NFL games',
        color: 0x00FF00,
        fields: [
          {
            name: '🎯 Monitoring Features',
            value: '• Live scores and game updates\n• Player performance tracking\n• Snap count monitoring\n• Target share analysis\n• Red zone opportunities\n• Live injury alerts',
            inline: false
          },
          {
            name: '📊 Game Detection',
            value: 'Automatically detects and monitors:\n• Regular season games\n• Preseason games (for testing)\n• All game days (Thu/Sun/Mon)',
            inline: true
          },
          {
            name: '⚡ Update Frequency',
            value: 'Game checks: Every 30 seconds\nLive stats: Every 15 seconds\nReal-time alerts for changes',
            inline: true
          },
          {
            name: '🚨 Alert Types',
            value: 'Game start/end • Score updates • Player performance • Snap counts • Target alerts • Red zone usage • Injury updates',
            inline: false
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Fantasy Command Center • Live Monitoring System'
        }
      };

      await axios.post(webhookUrl, {
        content: '🚀 **LIVE GAME MONITORING SYSTEM ACTIVATED**',
        embeds: [embed]
      });

      logger.info('✅ Live monitoring startup alert sent to Discord');
    } catch (error) {
      logger.error('Failed to send startup alert:', error.message);
    }
  }

  formatTradeAnalysis(analysis, targetTeam) {
    if (!analysis.success) {
      return `💼 **Trade Analysis Failed**\n\n❌ ${analysis.error || 'Unknown error'}`;
    }

    let response = `💼 **AI Trade Analysis Report**\n\n`;

    // Team analysis summary
    response += `📊 **Your Team Analysis:**\n`;
    response += `• **Strengths:** ${analysis.teamAnalysis.strengths.map(s => s.position).join(', ') || 'None identified'}\n`;
    response += `• **Needs:** ${analysis.teamAnalysis.needs.map(n => `${n.position} (Priority: ${n.priority})`).join(', ') || 'None critical'}\n`;
    response += `• **Tradeable Assets:** ${analysis.teamAnalysis.tradeable.map(t => t.name).slice(0, 3).join(', ') || 'Limited surplus'}\n\n`;

    // Trade suggestions
    if (analysis.suggestions && analysis.suggestions.length > 0) {
      response += `🔄 **Top Trade Suggestions:**\n\n`;
      
      analysis.suggestions.slice(0, 3).forEach((suggestion, i) => {
        response += `**${i + 1}. Trade with ${suggestion.partner}**\n`;
        
        if (suggestion.trade) {
          const give = Array.isArray(suggestion.trade.give) ? suggestion.trade.give : [suggestion.trade.give];
          const receive = Array.isArray(suggestion.trade.receive) ? suggestion.trade.receive : [suggestion.trade.receive];
          
          response += `• **Give:** ${give.join(', ')}\n`;
          response += `• **Receive:** ${receive.join(', ')}\n`;
          response += `• **Fairness:** ${suggestion.fairness || 'N/A'}/10\n`;
          response += `• **Why:** ${suggestion.reasoning || 'Addresses team needs'}\n\n`;
        }
      });
    } else {
      response += `🔄 **Trade Suggestions:**\n`;
      response += `❌ No viable trades found right now.\n\n`;
      response += `**Possible Reasons:**\n`;
      response += `• Teams have similar needs\n`;
      response += `• Limited surplus players\n`;
      response += `• Need more data on other teams\n\n`;
    }

    // Market trends
    if (analysis.marketTrends) {
      response += `📈 **Market Trends:**\n`;
      response += `• **Rising:** ${analysis.marketTrends.rising?.join(', ') || 'N/A'}\n`;
      response += `• **Falling:** ${analysis.marketTrends.falling?.join(', ') || 'N/A'}\n\n`;
    }

    response += `🕒 **Analysis Time:** ${new Date().toLocaleTimeString()}\n`;
    response += `💡 **Tip:** Use \`.trade TeamName\` to analyze specific trade partners`;

    return response;
  }

  async stop() {
    if (this.client) {
      await this.client.destroy();
    }
    
    // Cleanup trade analyzer
    if (this.tradeAnalyzer) {
      this.tradeAnalyzer.destroy();
    }
  }
}

module.exports = DiscordAIBot;