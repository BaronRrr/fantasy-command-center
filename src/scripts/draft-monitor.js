const axios = require('axios');
const config = require('../../config');
const DiscordNotifier = require('../notifications/discord-notifier');
const ClaudeAI = require('../api/claude-ai');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class DraftMonitor {
  constructor() {
    this.leagueId = config.espn.leagueId || '356030745';
    this.seasonId = config.espn.seasonId || '2025';
    this.yourTeamId = 2;
    this.isMonitoring = false;
    this.lastPickCount = 0;
    this.picks = [];
    
    // Initialize services
    this.discord = config.discord.webhookUrl ? new DiscordNotifier() : null;
    this.ai = config.ai.claude.apiKey ? new ClaudeAI() : null;
    
    // ESPN API setup
    this.espnAPI = {
      baseURL: 'https://fantasy.espn.com/apis/v3/games/ffl/seasons',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Fantasy-Command-Center/1.0.0'
      }
    };
  }

  async startMonitoring() {
    if (this.isMonitoring) {
      logger.info('Draft monitoring already running');
      return;
    }

    this.isMonitoring = true;
    
    console.log('\n🚀 FANTASY DRAFT MONITOR STARTING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 League ID: ${this.leagueId}`);
    console.log(`👤 Your Team: ${this.yourTeamId}`);
    console.log(`⏱️  Monitoring every ${config.draft.monitorInterval/1000} seconds`);
    console.log(`🤖 AI Recommendations: ${config.draft.aiRecommendationEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`💬 Discord Alerts: ${this.discord ? 'ENABLED' : 'DISABLED'}`);
    
    // Send initial connection notification
    await this.sendConnectionNotification();
    
    // Initial draft check
    await this.checkDraftStatus();
    
    // Start monitoring loop
    this.monitoringInterval = setInterval(() => {
      this.checkDraftStatus().catch(error => {
        logger.error('Draft monitoring error:', error.message);
      });
    }, config.draft.monitorInterval);
    
    logger.info('🎯 Draft monitoring active! Watching for picks...');
    
    // Keep process alive
    process.on('SIGINT', () => {
      this.stopMonitoring();
      process.exit(0);
    });
  }

  async sendConnectionNotification() {
    const message = {
      title: '🚀 Draft Monitor Connected!',
      description: `Connected to League ${this.leagueId}\nMonitoring Team ${this.yourTeamId}\nReady for draft picks!`,
      color: 0x00FF00,
      timestamp: new Date().toISOString()
    };

    if (this.discord) {
      await this.discord.sendNotification(message, 'draft-central');
    }

    console.log('✅ Connection notification sent to Discord');
  }

  async checkDraftStatus() {
    try {
      const draftData = await this.getDraftData();
      
      if (!draftData) {
        logger.debug('No draft data available yet');
        return;
      }

      const picks = draftData.picks || [];
      const currentPickCount = picks.length;

      // Check for new picks
      if (currentPickCount > this.lastPickCount) {
        const newPicks = picks.slice(this.lastPickCount);
        
        for (const pick of newPicks) {
          await this.processPick(pick);
        }
        
        this.lastPickCount = currentPickCount;
        this.picks = picks;
      }

      // Show status every 30 seconds
      if (Date.now() % 30000 < config.draft.monitorInterval) {
        logger.info(`📊 Monitoring... Picks made: ${currentPickCount}`);
      }

    } catch (error) {
      logger.error('Failed to check draft status:', error.message);
    }
  }

  async getDraftData() {
    const url = `${this.espnAPI.baseURL}/${this.seasonId}/leagues/${this.leagueId}?view=mDraftDetail`;
    
    try {
      const response = await axios.get(url, {
        headers: this.espnAPI.headers,
        timeout: 10000
      });

      return response.data.draftDetail;
    } catch (error) {
      if (error.response?.status === 401) {
        logger.warn('Draft requires authentication - some features may be limited');
      }
      throw error;
    }
  }

  async processPick(pick) {
    const player = pick.playerPoolEntry?.player;
    const isYourPick = pick.teamId == this.yourTeamId;
    
    if (!player) {
      logger.warn('Pick data incomplete:', pick);
      return;
    }

    const pickInfo = {
      round: pick.roundId,
      pickNumber: pick.roundPickNumber,
      overall: pick.overall,
      player: {
        name: player.fullName,
        position: this.getPositionName(player.defaultPositionId),
        team: this.getTeamName(player.proTeamId)
      },
      team: pick.teamId,
      isYour: isYourPick
    };

    // Log the pick
    const pickText = `Round ${pickInfo.round}, Pick ${pickInfo.pickNumber}: ${pickInfo.player.name} (${pickInfo.player.position}, ${pickInfo.player.team})`;
    
    if (isYourPick) {
      console.log(`\n🎯 YOUR PICK! ${pickText}`);
    } else {
      console.log(`📊 Team ${pickInfo.team}: ${pickText}`);
    }

    // Send Discord notification
    await this.sendPickNotification(pickInfo);

    // Generate AI recommendation if it's your pick
    if (isYourPick && this.ai && config.draft.aiRecommendationEnabled) {
      await this.generatePickAnalysis(pickInfo);
    }
  }

  async sendPickNotification(pickInfo) {
    if (!this.discord) return;

    const isYourPick = pickInfo.isYour;
    const player = pickInfo.player;
    
    const notification = {
      title: isYourPick ? '🎯 YOUR DRAFT PICK!' : '📊 Draft Pick Alert',
      description: `**Round ${pickInfo.round}, Pick ${pickInfo.pickNumber}**\n${player.name}\n${player.position} - ${player.team}`,
      color: isYourPick ? 0xFF6B35 : 0x4A90E2,
      fields: [
        {
          name: 'Team',
          value: isYourPick ? 'YOUR TEAM' : `Team ${pickInfo.team}`,
          inline: true
        },
        {
          name: 'Overall Pick',
          value: `#${pickInfo.overall}`,
          inline: true
        }
      ],
      timestamp: new Date().toISOString()
    };

    const channel = isYourPick ? 'draft-central' : 'draft-central';
    await this.discord.sendNotification(notification, channel);
  }

  async generatePickAnalysis(pickInfo) {
    if (!this.ai) return;

    try {
      const analysisPrompt = `Analyze this fantasy football draft pick:
      
Pick: ${pickInfo.player.name} (${pickInfo.player.position}, ${pickInfo.player.team})
Round: ${pickInfo.round}
Overall Pick: ${pickInfo.overall}

Provide a brief analysis (2-3 sentences) covering:
1. Value assessment for this round
2. How this fits into draft strategy
3. What position to target next

Keep it concise and actionable.`;

      const analysis = await this.ai.makeRequest([{
        role: 'user',
        content: analysisPrompt
      }], 'You are a fantasy football draft expert. Provide concise, actionable draft analysis.');

      const analysisText = analysis.content?.[0]?.text || 'Analysis unavailable';
      
      // Send AI analysis to Discord
      if (this.discord) {
        const aiNotification = {
          title: '🤖 AI Draft Analysis',
          description: analysisText,
          color: 0x9B59B6,
          timestamp: new Date().toISOString()
        };

        await this.discord.sendNotification(aiNotification, 'ai-analysis');
      }

      console.log('\n🤖 AI ANALYSIS:');
      console.log(analysisText);

    } catch (error) {
      logger.error('Failed to generate AI analysis:', error.message);
    }
  }

  getPositionName(positionId) {
    const positions = {
      1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST'
    };
    return positions[positionId] || 'FLEX';
  }

  getTeamName(teamId) {
    const teams = {
      1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET',
      9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN',
      17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC',
      25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WSH', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU'
    };
    return teams[teamId] || 'FA';
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    logger.info('🛑 Draft monitoring stopped');
  }
}

async function main() {
  console.log('🏈 FANTASY FOOTBALL DRAFT MONITOR');
  console.log('Starting draft monitoring system...\n');

  const monitor = new DraftMonitor();
  
  try {
    await monitor.startMonitoring();
  } catch (error) {
    console.error('❌ Failed to start draft monitoring:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DraftMonitor;