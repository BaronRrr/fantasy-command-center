const axios = require('axios');
const config = require('../../config');
const winston = require('winston');
const { discordChannels, channelRouter, alertTemplates } = require('../../config/discord-channels');

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class DiscordNotifier {
  constructor() {
    this.webhookURL = config.notifications.discord.webhookURL;
    this.colors = config.notifications.discord.colors;
    this.urgencyLevels = config.notifications.discord.urgencyLevels;
    
    // Multi-channel webhook URLs
    this.webhooks = {
      draftCentral: process.env.DISCORD_DRAFT_WEBHOOK,
      aiAnalysis: process.env.DISCORD_AI_WEBHOOK,
      scoutingReports: process.env.DISCORD_SCOUTING_WEBHOOK,
      playerNews: process.env.DISCORD_NEWS_WEBHOOK,
      leagueIntelligence: process.env.DISCORD_INTEL_WEBHOOK,
      matchupAnalysis: process.env.DISCORD_MATCHUP_WEBHOOK,
      emergencyAlerts: process.env.DISCORD_EMERGENCY_WEBHOOK,
      draftRecap: process.env.DISCORD_RECAP_WEBHOOK
    };
    
    this.axiosInstance = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async sendNotification(notification) {
    // Use multi-channel routing if available
    if (notification.type && notification.urgency) {
      return await this.sendMultiChannelAlert(notification);
    }

    // Fallback to default webhook
    if (!this.webhookURL) {
      logger.warn('Discord webhook URL not configured - skipping notification');
      return false;
    }

    try {
      const embed = this.createEmbed(notification);
      const payload = {
        content: notification.mention ? '@here' : null,
        embeds: [embed]
      };

      const response = await this.axiosInstance.post(this.webhookURL, payload);
      
      if (response.status === 204) {
        logger.debug('Discord notification sent successfully');
        return true;
      } else {
        logger.warn(`Discord API returned unexpected status: ${response.status}`);
        return false;
      }
    } catch (error) {
      logger.error('Failed to send Discord notification:', error.message);
      return false;
    }
  }

  async sendMultiChannelAlert(alert) {
    try {
      // Validate emergency injury alerts to prevent spam
      if (alert.type === 'EMERGENCY_INJURY') {
        if (!alert.data?.playerName || alert.data.playerName === 'STAR PLAYER' || 
            alert.description === 'No details available') {
          logger.warn('Blocking incomplete emergency injury alert:', alert);
          return { success: false, reason: 'Incomplete emergency alert blocked' };
        }
      }
      
      const routes = channelRouter.routeAlert(alert.type, alert.urgency, alert.data);
      const results = [];

      for (const route of routes) {
        const webhookUrl = this.webhooks[route.channel];
        
        if (!webhookUrl) {
          logger.warn(`No webhook configured for channel: ${route.channel}`);
          continue;
        }

        const embed = this.createEnhancedEmbed(alert, route.config);
        const payload = {
          content: alert.urgency === 'CRITICAL' ? '@here' : null,
          embeds: [embed]
        };

        try {
          const response = await this.axiosInstance.post(webhookUrl, payload);
          
          if (response.status === 204) {
            logger.info(`Alert sent to #${route.config.name}: ${alert.type}`);
            results.push({ channel: route.channel, success: true });
          } else {
            logger.warn(`Failed to send to #${route.config.name}: ${response.status}`);
            results.push({ channel: route.channel, success: false });
          }
        } catch (channelError) {
          logger.error(`Error sending to #${route.config.name}:`, channelError.message);
          results.push({ channel: route.channel, success: false, error: channelError.message });
        }

        // Small delay to avoid rate limiting
        await this.delay(100);
      }

      return results;
    } catch (error) {
      logger.error('Failed to send multi-channel alert:', error.message);
      return false;
    }
  }

  createEnhancedEmbed(alert, channelConfig) {
    const template = alertTemplates[channelConfig.name]?.[alert.type];
    const urgency = alert.urgency || 'INFO';
    const color = channelConfig.color || this.colors[urgency] || this.colors.INFO;

    let title = template?.title || `${channelConfig.emoji} ${alert.type}`;
    let description = template?.template || alert.message || this.generateDefaultMessage(alert.type, alert.data);

    // Replace template variables
    if (alert.data && template?.template) {
      description = this.replaceTemplateVariables(template.template, alert.data);
      title = this.replaceTemplateVariables(title, alert.data);
    }

    const embed = {
      title: title,
      description: description,
      color: color,
      timestamp: new Date().toISOString(),
      footer: {
        text: `${channelConfig.name} | Fantasy Command Center`,
        icon_url: "https://cdn.discordapp.com/emojis/1234567890123456789.png"
      }
    };

    // Add fields for structured data
    if (alert.data && typeof alert.data === 'object') {
      embed.fields = this.createEmbedFields(alert.data, alert.type);
    }

    return embed;
  }

  replaceTemplateVariables(template, data) {
    let result = template;
    
    // Replace {variable} patterns with data values
    const variables = template.match(/\{([^}]+)\}/g);
    if (variables) {
      variables.forEach(variable => {
        const key = variable.slice(1, -1); // Remove { }
        const value = this.getNestedValue(data, key) || variable;
        result = result.replace(variable, value);
      });
    }
    
    return result;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  createEmbedFields(data, alertType) {
    const fields = [];

    // Custom fields based on alert type
    switch (alertType) {
      case 'AI_RECOMMENDATIONS':
        if (data.topRecommendations) {
          fields.push({
            name: '🎯 Top Picks',
            value: Array.isArray(data.topRecommendations) 
              ? data.topRecommendations.slice(0, 3).join('\n')
              : data.topRecommendations,
            inline: false
          });
        }
        break;

      case 'MY_TURN':
        if (data.pickNumber) {
          fields.push({
            name: 'Pick Info',
            value: `Pick #${data.pickNumber}`,
            inline: true
          });
        }
        if (data.timeRemaining) {
          fields.push({
            name: 'Time Left',
            value: `${data.timeRemaining}s`,
            inline: true
          });
        }
        break;

      case 'INJURY_UPDATE':
        if (data.playerName) {
          fields.push({
            name: 'Player',
            value: data.playerName,
            inline: true
          });
        }
        if (data.injuryStatus) {
          fields.push({
            name: 'Status',
            value: data.injuryStatus,
            inline: true
          });
        }
        break;

      case 'WEATHER_ALERT':
        if (data.conditions) {
          fields.push({
            name: 'Conditions',
            value: data.conditions,
            inline: true
          });
        }
        if (data.impact) {
          fields.push({
            name: 'Fantasy Impact',
            value: data.impact,
            inline: false
          });
        }
        break;
    }

    return fields;
  }

  createEmbed(notification) {
    const urgency = notification.urgency || 'INFO';
    const color = this.colors[urgency] || this.colors.INFO;
    
    const embed = {
      title: this.getTitle(notification),
      description: notification.description || '',
      color: color,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Fantasy Command Center'
      }
    };

    // Add fields if available
    if (notification.fields && Array.isArray(notification.fields)) {
      embed.fields = notification.fields;
    }

    return embed;
  }

  getTitle(notification) {
    if (notification.title) return notification.title;
    
    const urgencyEmojis = {
      CRITICAL: '🚨',
      HIGH: '⚠️',
      MEDIUM: '📢',
      INFO: 'ℹ️'
    };
    
    const emoji = urgencyEmojis[notification.urgency] || '📢';
    return `${emoji} ${notification.type || 'Notification'}`;
  }

  generateDefaultMessage(alertType, data) {
    switch (alertType) {
      case 'MY_TURN':
        const pickOptions = data?.pickOptions || [
          { name: 'Josh Jacobs (RB, LV)', reason: 'Elite volume floor, 320+ touches projected, RB8 ceiling' },
          { name: 'DeVonta Smith (WR, PHI)', reason: '140+ targets, elite separation metrics, WR2 upside' },
          { name: 'George Kittle (TE, SF)', reason: 'Only TE with WR1 upside, red zone monster, positional advantage' }
        ];
        
        const optionsText = pickOptions.slice(0,3).map((opt, i) => 
          `${i+1}. **${opt.name}**\n   🔍 ${opt.reason}`
        ).join('\n\n');
        
        return `🚨 **YOUR DRAFT PICK IS NOW!**\n\n⏰ **Pick #${data?.pickNumber || 'Unknown'}** - Round ${data?.round || '?'}, Pick ${data?.pickInRound || '?'}\n⏱️ **Time Remaining:** ${data?.timeRemaining || '90'} seconds\n\n🎯 **TOP 3 RECOMMENDATIONS:**\n\n${optionsText}\n\n📊 **Team Needs:** ${this.expandAcronyms(data?.teamNeeds) || 'Multiple positions available'}\n\n**⚡ DECIDE QUICKLY! TIMER IS RUNNING! ⚡**`;

      case 'AI_RECOMMENDATIONS':
        const recs = data?.recommendations || ['Josh Jacobs (RB, LV)', 'DeVonta Smith (WR, PHI)', 'George Kittle (TE, SF)'];
        return `🤖 **AI DRAFT ANALYSIS COMPLETE**\n\n🎯 **TOP RECOMMENDATIONS:**\n${recs.slice(0,3).map((r, i) => `${i+1}. ${r}`).join('\n')}\n\n📈 **TEAM NEEDS:** ${data?.teamNeeds || 'RB depth, WR2, TE upgrade'}\n🧠 **STRATEGY:** ${data?.strategy || 'Target value in next 2 picks'}`;

      case 'INJURY_UPDATE':
        return `🏥 **INJURY ALERT**\n\n👤 **Player:** ${data?.playerName || 'Unknown Player'}\n⚕️ **Status:** ${data?.injuryStatus || 'Injury reported'}\n📊 **Fantasy Impact:** ${data?.fantasyImpact || 'Monitor situation closely'}\n📰 **Source:** ${data?.source || 'Breaking news'}\n\n🎯 **Action:** ${data?.recommendedAction || 'Consider backup options'}`;

      case 'WEATHER_ALERT':
        return `🌦️ **GAME DAY WEATHER ALERT**\n\n🏈 **Game:** ${data?.gameInfo || 'NFL Game'}\n🌡️ **Conditions:** ${data?.conditions || 'Adverse weather expected'}\n⚠️ **Impact:** ${data?.impact || 'May affect game performance'}\n🎯 **Fantasy Advice:** ${data?.fantasyAdvice || 'Adjust lineups accordingly'}`;

      case 'TRADE_OPPORTUNITY':
        return `🔄 **TRADE OPPORTUNITY DETECTED**\n\n👤 **Target Team:** ${data?.teamName || 'League Opponent'}\n📈 **They Need:** ${data?.theirNeeds || 'Multiple positions'}\n📉 **They Have:** ${data?.theirSurplus || 'Excess depth'}\n💰 **Your Leverage:** ${data?.yourLeverage || 'Strong trade assets'}\n💡 **Suggested Deal:** ${data?.tradeIdea || 'Explore mutual benefit trade'}`;

      case 'HIDDEN_GEM':
        return `💎 **HIDDEN GEM DISCOVERED**\n\n👤 **Player:** ${data?.playerName || 'Sleeper Pick'} (${data?.position || 'Pos'}, ${data?.team || 'Team'})\n📊 **Current ADP:** ${data?.currentADP || 'Late round'}\n📈 **True Value:** ${data?.projectedValue || 'Much higher'}\n🔍 **Why:** ${data?.reasoning || 'Undervalued opportunity'}\n🎯 **Draft Window:** ${data?.draftWindow || 'Act soon'}`;

      case 'LINEUP_OPTIMIZATION':
        return `⚔️ **WEEK ${data?.weekNumber || 'X'} LINEUP OPTIMIZATION**\n\n🔄 **Recommended Changes:** ${data?.changeCount || 'Several'}\n📈 **Projected Gain:** +${data?.projectedPoints || '5.2'} points\n🎯 **Confidence:** ${data?.confidence || '85'}%\n\n**Start/Sit adjustments for maximum points!**`;

      case 'EMERGENCY_INJURY':
        // Handle detailed FAAB strategy if provided
        const faabDetails = data?.faabSuggestion || 'Budget $20-30 for immediate replacement';
        const waiverTargets = data?.waiverTargets || 'Check available replacements on waiver wire';
        const dropCandidates = data?.dropCandidates || 'Bench players with limited upside';
        
        return `🚨 **EMERGENCY: ${data?.playerName || 'STAR PLAYER'} RULED OUT**\n\n⏰ **Breaking:** ${data?.hoursBeforeGames || '2'} hours before games\n🎯 **Waiver Targets:** ${waiverTargets}\n💰 **FAAB:** ${faabDetails}\n\n🚨 **DROP CANDIDATES:**\n${dropCandidates}\n\n⚡ **Claim Deadline:** ${data?.deadline || 'Sunday 12:00 PM EST'}`;

      case 'DRAFT_COMPLETE':
        return `🏆 **DRAFT ANALYSIS: GRADE ${data?.grade || 'A-'}**\n\n🤖 **AI Followed:** ${data?.aiFollowRate || '87'}%\n💎 **Steals Found:** ${data?.steals?.length || '3'} value picks\n📈 **Championship Odds:** ${data?.championshipOdds || '23'}%\n\n**Elite draft execution!**`;

      default:
        return `📢 **${alertType.replace(/_/g, ' ')}**\n\nDetailed analysis and recommendations available.\n\n🎯 Fantasy Command Center is monitoring your league for optimal decisions.`;
    }
  }

  expandAcronyms(text) {
    if (!text) return text;
    
    const acronyms = {
      'RB': 'Running Back',
      'WR': 'Wide Receiver', 
      'QB': 'Quarterback',
      'TE': 'Tight End',
      'K': 'Kicker',
      'DST': 'Defense/Special Teams',
      'WR1': 'Wide Receiver 1 (Primary)',
      'WR2': 'Wide Receiver 2 (Secondary)',
      'WR3': 'Wide Receiver 3 (Depth)',
      'RB1': 'Running Back 1 (Primary)',
      'RB2': 'Running Back 2 (Secondary)', 
      'RB3': 'Running Back 3 (Depth)',
      'TE1': 'Tight End 1 (Elite)',
      'QB1': 'Quarterback 1 (Elite)',
      'PPR': 'Points Per Reception',
      'ADP': 'Average Draft Position',
      'FAAB': 'Free Agent Acquisition Budget',
      'IR': 'Injured Reserve',
      'PUP': 'Physically Unable to Perform',
      'RBBC': 'Running Back By Committee'
    };
    
    let result = text;
    Object.entries(acronyms).forEach(([acronym, fullForm]) => {
      const regex = new RegExp(`\\b${acronym}\\b`, 'g');
      result = result.replace(regex, `${acronym} (${fullForm})`);
    });
    
    // Handle special cases
    result = result.replace(/Handcuffs/g, 'Handcuffs (Backup players for your starters)');
    result = result.replace(/lottery tickets/g, 'lottery tickets (high-upside late-round picks)');
    
    return result;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience methods for different alert types
  async sendDraftAlert(alert) {
    return await this.sendMultiChannelAlert({
      type: alert.type,
      urgency: alert.urgency,
      data: alert.data,
      message: alert.message
    });
  }

  async sendPlayerNewsAlert(playerName, newsData) {
    return await this.sendMultiChannelAlert({
      type: 'INJURY_UPDATE',
      urgency: newsData.urgency || 'MEDIUM',
      data: {
        playerName: playerName,
        injuryStatus: newsData.status,
        fantasyImpact: newsData.impact,
        source: newsData.source
      }
    });
  }

  async sendWeatherAlert(gameInfo, weatherData) {
    return await this.sendMultiChannelAlert({
      type: 'WEATHER_ALERT',
      urgency: weatherData.severity === 'SEVERE' ? 'HIGH' : 'MEDIUM',
      data: {
        gameInfo: gameInfo,
        conditions: weatherData.conditions,
        impact: weatherData.impact,
        fantasyAdvice: weatherData.fantasyAdvice
      }
    });
  }

  async sendAIAnalysis(analysisData) {
    return await this.sendMultiChannelAlert({
      type: 'AI_RECOMMENDATIONS',
      urgency: 'HIGH',
      data: {
        recommendations: analysisData.recommendations,
        topRecommendation: analysisData.topPick,
        teamNeeds: analysisData.teamNeeds,
        strategy: analysisData.strategy
      }
    });
  }

  // Test method to send sample alerts to all configured channels
  async testAllChannels() {
    const testAlerts = [
      {
        type: 'MY_TURN',
        urgency: 'CRITICAL',
        data: {
          pickNumber: 15,
          timeRemaining: 90,
          topRecommendation: 'Josh Jacobs (RB, LV)'
        }
      },
      {
        type: 'AI_RECOMMENDATIONS', 
        urgency: 'HIGH',
        data: {
          topRecommendations: ['Josh Jacobs (RB)', 'DeVonta Smith (WR)', 'George Kittle (TE)'],
          teamNeeds: 'RB depth, WR2',
          strategy: 'Target RB in next 2 picks'
        }
      },
      {
        type: 'INJURY_UPDATE',
        urgency: 'HIGH', 
        data: {
          playerName: 'Christian McCaffrey',
          injuryStatus: 'Questionable - Ankle',
          fantasyImpact: 'Monitor practice reports',
          source: 'ESPN'
        }
      }
    ];

    const results = [];
    for (const alert of testAlerts) {
      const result = await this.sendMultiChannelAlert(alert);
      results.push({ alert: alert.type, result });
      await this.delay(1000); // 1 second between tests
    }

    return results;
  }
}

module.exports = DiscordNotifier;
