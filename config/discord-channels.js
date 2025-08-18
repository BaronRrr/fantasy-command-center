// Multi-Channel Discord Configuration for Fantasy Command Center

const discordChannels = {
  // CRITICAL - Time sensitive draft decisions only
  draftCentral: {
    name: "draft-central",
    webhook: process.env.DISCORD_DRAFT_WEBHOOK,
    emoji: "🚨",
    color: 0xFF0000, // Red
    urgencyLevels: ["CRITICAL"],
    alertTypes: [
      "MY_TURN",
      "TURN_APPROACHING", 
      "TARGET_TAKEN",
      "STEAL_URGENT"
    ],
    description: "Time-sensitive draft alerts only"
  },

  // DETAILED - Comprehensive AI analysis and recommendations  
  aiAnalysis: {
    name: "ai-analysis", 
    webhook: process.env.DISCORD_AI_WEBHOOK,
    emoji: "🤖",
    color: 0x0099FF, // Blue
    urgencyLevels: ["HIGH", "MEDIUM"],
    alertTypes: [
      "AI_RECOMMENDATIONS",
      "DRAFT_ANALYSIS", 
      "TEAM_NEEDS",
      "STRATEGY_UPDATE"
    ],
    description: "Detailed AI recommendations and analysis"
  },

  // SCOUTING - Hidden gems, sleepers, breakout candidates
  scoutingReports: {
    name: "scouting-reports",
    webhook: process.env.DISCORD_SCOUTING_WEBHOOK, 
    emoji: "🔬",
    color: 0x9932CC, // Purple
    urgencyLevels: ["MEDIUM", "INFO"],
    alertTypes: [
      "HIDDEN_GEM",
      "BREAKOUT_CANDIDATE", 
      "SLEEPER_ALERT",
      "VALUE_OPPORTUNITY",
      "ADP_ANOMALY"
    ],
    description: "Hidden gems and scouting intelligence"
  },

  // NEWS - Live player updates, injuries, trades
  playerNews: {
    name: "player-news",
    webhook: process.env.DISCORD_NEWS_WEBHOOK,
    emoji: "📰", 
    color: 0xFF8C00, // Orange
    urgencyLevels: ["HIGH", "MEDIUM", "INFO"],
    alertTypes: [
      "INJURY_UPDATE",
      "TRADE_NEWS", 
      "DEPTH_CHART_CHANGE",
      "WEATHER_ALERT",
      "COACHING_CHANGE",
      "SUSPENSION_NEWS"
    ],
    description: "Live player and NFL news updates"
  },

  // INTEL - League opponent analysis and trade opportunities
  leagueIntelligence: {
    name: "league-intelligence", 
    webhook: process.env.DISCORD_INTEL_WEBHOOK,
    emoji: "🕵️",
    color: 0x32CD32, // Green
    urgencyLevels: ["HIGH", "MEDIUM", "INFO"],
    alertTypes: [
      "LEAGUE_SETUP",
      "PRE_DRAFT_INTEL",
      "TRADE_OPPORTUNITY",
      "OPPONENT_ANALYSIS",
      "LEAGUE_TRENDS", 
      "WAIVER_OPPORTUNITY",
      "TEAM_WEAKNESS",
      "DRAFT_PATTERN",
      "DRAFT_ORDER_ANALYSIS",
      "HISTORICAL_PATTERNS",
      "OWNER_TENDENCIES"
    ],
    description: "League intelligence and opponent analysis - active before, during, and after draft",
    activePhases: ["PRE_DRAFT", "DRAFT", "SEASON"]
  },

  // MATCHUPS - Weekly lineup optimization
  matchupAnalysis: {
    name: "matchup-analysis",
    webhook: process.env.DISCORD_MATCHUP_WEBHOOK,
    emoji: "⚔️", 
    color: 0xFFD700, // Gold
    urgencyLevels: ["HIGH", "MEDIUM"],
    alertTypes: [
      "LINEUP_OPTIMIZATION",
      "START_SIT_ADVICE",
      "WEATHER_IMPACT", 
      "MATCHUP_ADVANTAGE",
      "WEEK_PREVIEW",
      "PLAYOFF_PLANNING"
    ],
    description: "Weekly matchup analysis and lineup optimization"
  },

  // EMERGENCY - Crisis management and urgent decisions
  emergencyAlerts: {
    name: "emergency-alerts",
    webhook: process.env.DISCORD_EMERGENCY_WEBHOOK,
    emoji: "🚨",
    color: 0xDC143C, // Crimson
    urgencyLevels: ["CRITICAL"],
    alertTypes: [
      "EMERGENCY_INJURY",
      "LAST_MINUTE_NEWS",
      "WAIVER_URGENT",
      "TRADE_DEADLINE", 
      "PLAYOFF_CRUCIAL",
      "SYSTEM_ALERT"
    ],
    description: "Emergency alerts requiring immediate attention"
  },

  // RECAP - Post-draft and weekly summaries
  draftRecap: {
    name: "draft-recap",
    webhook: process.env.DISCORD_RECAP_WEBHOOK, 
    emoji: "📊",
    color: 0x708090, // Slate Gray
    urgencyLevels: ["INFO"],
    alertTypes: [
      "DRAFT_COMPLETE",
      "WEEKLY_RECAP",
      "PERFORMANCE_ANALYSIS",
      "SEASON_SUMMARY", 
      "CHAMPIONSHIP_ODDS",
      "GRADE_REPORT"
    ],
    description: "Draft recaps and performance analysis"
  }
};

// Channel routing logic
const channelRouter = {
  // Route alerts to appropriate channels based on type and urgency
  routeAlert(alertType, urgency, data) {
    const routes = [];
    
    Object.entries(discordChannels).forEach(([key, channel]) => {
      if (channel.alertTypes.includes(alertType) && 
          channel.urgencyLevels.includes(urgency)) {
        routes.push({
          channel: key,
          webhook: channel.webhook,
          config: channel
        });
      }
    });

    return routes;
  },

  // Get channel for specific alert type
  getChannelForAlert(alertType) {
    for (const [key, channel] of Object.entries(discordChannels)) {
      if (channel.alertTypes.includes(alertType)) {
        return { channel: key, config: channel };
      }
    }
    return null;
  },

  // Get all active channels
  getActiveChannels() {
    return Object.entries(discordChannels)
      .filter(([key, channel]) => channel.webhook)
      .map(([key, channel]) => ({ channel: key, config: channel }));
  }
};

// Enhanced alert templates for each channel
const alertTemplates = {
  draftCentral: {
    MY_TURN: {
      title: "🚨 YOUR PICK IS NOW!",
      template: "Pick {pickNumber} overall - {timeRemaining} seconds\n🎯 {topRecommendation}\n⏰ Decide quickly!"
    },
    TURN_APPROACHING: {
      title: "⏰ YOUR TURN APPROACHING", 
      template: "Pick {pickNumber} in {picksAway} selections\n🧠 AI analysis starting...\n📱 Get ready!"
    },
    STEAL_URGENT: {
      title: "💎 STEAL OPPORTUNITY - URGENT",
      template: "{playerName} available WAY below ADP!\n📈 Normal: Round {normalRound}\n📍 Available: NOW\n⚡ Act fast!"
    }
  },

  aiAnalysis: {
    AI_RECOMMENDATIONS: {
      title: "🤖 AI DRAFT ANALYSIS COMPLETE",
      template: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 TOP RECOMMENDATIONS:\n{recommendations}\n\n🔍 TEAM NEEDS:\n{teamNeeds}\n\n📊 STRATEGY:\n{strategy}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    }
  },

  scoutingReports: {
    HIDDEN_GEM: {
      title: "💎 HIDDEN GEM ALERT",
      template: "{playerName} ({position}, {team})\n📈 Current ADP: Round {currentADP}\n📊 Projected Value: Round {projectedValue}\n🔍 Why: {reasoning}\n🎯 Window: {draftWindow}"
    },
    BREAKOUT_CANDIDATE: {
      title: "🔮 BREAKOUT CANDIDATE",
      template: "{playerName} ({position}, {team})\n📊 Ownership: {ownership}% (under radar)\n🔍 Catalyst: {catalyst}\n📈 Ceiling: {ceiling}\n🎯 Target: Rounds {targetRounds}"
    }
  },

  playerNews: {
    INJURY_UPDATE: {
      title: "🏥 INJURY UPDATE",
      template: "{playerName} ({position}, {team})\n⏰ {timestamp}\n🔍 Status: {injuryStatus}\n📊 Impact: {fantasyImpact}\n🎯 Action: {recommendedAction}"
    },
    WEATHER_ALERT: {
      title: "🌦️ WEATHER ALERT",
      template: "{gameInfo}\n🌡️ Conditions: {conditions}\n⚠️ Impact: {impact}\n🔄 Pivot Options: {alternatives}"
    }
  },

  leagueIntelligence: {
    TRADE_OPPORTUNITY: {
      title: "🔄 TRADE OPPORTUNITY DETECTED", 
      template: "👤 {teamName}\n📈 They need: {theirNeeds}\n📉 They have excess: {theirSurplus}\n🎯 Your leverage: {yourLeverage}\n💬 Suggested: {tradeIdea}"
    },
    OPPONENT_ANALYSIS: {
      title: "🎯 TEAM ANALYSIS UPDATE",
      template: "👤 {teamName}\n📊 Pattern: {draftPattern}\n⚠️ Weakness: {weakness}\n🔍 Opportunity: {opportunity}\n💡 Strategy: {strategy}"
    }
  },

  matchupAnalysis: {
    LINEUP_OPTIMIZATION: {
      title: "🗓️ WEEK {weekNumber} LINEUP OPTIMIZATION",
      template: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔄 RECOMMENDED CHANGES ({changeCount}):\n\n{changes}\n\n📊 PROJECTED IMPACT: +{projectedPoints} points\n🎯 CONFIDENCE: {confidence}%\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    }
  },

  emergencyAlerts: {
    EMERGENCY_INJURY: {
      title: "🚨 CRITICAL: {playerName} RULED OUT",
      template: "⏰ {timestamp} ({hoursBeforeGames} hours before games)\n📊 Immediate action needed:\n\n🎯 WAIVER TARGETS:\n{waiverTargets}\n\n⏰ Claim deadline: {deadline}\n💰 FAAB: {faabSuggestion}"
    }
  },

  draftRecap: {
    DRAFT_COMPLETE: {
      title: "🏆 DRAFT COMPLETE - GRADE: {grade}",
      template: "📊 AI Recommendations Followed: {aiFollowRate}%\n\n💎 STEALS:\n{steals}\n\n📈 TEAM STRENGTHS:\n{strengths}\n\n🎯 CHAMPIONSHIP PROBABILITY: {championshipOdds}%"
    }
  }
};

module.exports = {
  discordChannels,
  channelRouter, 
  alertTemplates
};