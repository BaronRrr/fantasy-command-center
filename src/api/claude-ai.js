const axios = require('axios');
const config = require('../../config');
const winston = require('winston');

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

class ClaudeAI {
  constructor() {
    this.apiKey = config.ai.claude.apiKey;
    this.model = config.ai.claude.model;
    this.maxTokens = config.ai.claude.maxTokens;
    this.temperature = config.ai.claude.temperature;
    this.baseURL = 'https://api.anthropic.com/v1/messages';
    
    this.axiosInstance = axios.create({
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      }
    });
  }

  async makeRequest(messages, systemPrompt = null) {
    try {
      const payload = {
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: messages
      };

      if (systemPrompt) {
        payload.system = systemPrompt;
      }

      logger.debug('Making Claude AI request');
      const response = await this.axiosInstance.post(this.baseURL, payload);
      
      if (response.status === 200 && response.data.content?.[0]?.text) {
        logger.debug('Claude AI request successful');
        return response.data.content[0].text;
      } else {
        throw new Error('Invalid response from Claude AI');
      }
    } catch (error) {
      logger.error('Claude AI request failed:', error.message);
      if (error.response) {
        logger.error('Response status:', error.response.status);
        logger.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  async analyzeDraftSituation(draftContext) {
    const systemPrompt = `You are an expert fantasy football analyst with comprehensive knowledge of player values, team needs, and draft strategy. Your analysis should be data-driven, actionable, and provide specific urgency levels for recommendations.

Current date: ${new Date().toLocaleDateString()}
Season: 2025 NFL Fantasy Football`;

    const userMessage = this.buildDraftAnalysisPrompt(draftContext);

    try {
      const messages = [
        {
          role: 'user',
          content: userMessage
        }
      ];

      const response = await this.makeRequest(messages, systemPrompt);
      return this.parseDraftRecommendations(response);
    } catch (error) {
      logger.error('Failed to analyze draft situation:', error.message);
      throw error;
    }
  }

  buildDraftAnalysisPrompt(context) {
    const {
      currentPick,
      myTeam,
      availablePlayers,
      recentPicks,
      leagueSettings,
      otherTeams,
      picksUntilNext,
      knowledgeBase,
      draftComparisons,
      strategyGuidance
    } = context;

    return `Analyze this specific draft situation and provide immediate actionable recommendations:

DRAFT CONTEXT:
- League: ${leagueSettings.size}-team ${leagueSettings.scoringType}
- Current Pick: ${currentPick.overall} overall (Round ${currentPick.round}, Pick ${currentPick.pickInRound})
- Picks until my next turn: ${picksUntilNext}
- Draft rounds: ${leagueSettings.draftRounds}

MY CURRENT TEAM:
${this.formatRoster(myTeam.roster)}

POSITION NEEDS ANALYSIS:
${this.analyzePositionNeeds(myTeam.roster, leagueSettings)}

TOP AVAILABLE PLAYERS (with enhanced data):
${this.formatAvailablePlayers(availablePlayers.slice(0, 20))}

RECENT DRAFT ACTIVITY:
${this.formatRecentPicks(recentPicks)}

OTHER TEAMS' NEEDS:
${this.formatTeamNeeds(otherTeams)}

ENHANCED CONTEXT FROM KNOWLEDGE BASE:
${this.formatKnowledgeContext(knowledgeBase, draftComparisons, strategyGuidance)}

ANALYSIS REQUIREMENTS:
1. Identify the TOP 3 players I should target right now
2. Calculate urgency level for each (CRITICAL/HIGH/MEDIUM/LOW)
3. Provide specific reasoning considering:
   - Player value vs. current ADP
   - My team's positional needs
   - Likelihood of player being available at my next pick
   - Injury status and recovery timeline
   - 2025 team situation changes
   - Schedule strength for fantasy playoffs
   - Historical performance trends

4. Identify any "steal" opportunities (players available below their true value)
5. Alert me to players likely to be taken before my next pick
6. Suggest positional strategy for the next 2-3 rounds

Format your response as JSON with this structure:
{
  "recommendations": [
    {
      "player": "Player Name",
      "position": "POS",
      "team": "TEAM",
      "urgency": "CRITICAL/HIGH/MEDIUM/LOW",
      "reasoning": "Detailed explanation",
      "valueRating": 1-10,
      "riskLevel": "LOW/MEDIUM/HIGH"
    }
  ],
  "steals": [
    {
      "player": "Player Name",
      "normalADP": "Round X",
      "currentAvailability": "Available now",
      "reasoning": "Why this is a steal"
    }
  ],
  "threats": [
    {
      "player": "Player Name",
      "likelihood": "HIGH/MEDIUM/LOW",
      "reasoning": "Why they might be taken"
    }
  ],
  "strategy": {
    "nextRound": "Recommended position focus",
    "reasoning": "Strategic explanation"
  }
}

Be specific, urgent, and actionable. This is live draft analysis that needs immediate decisions.`;
  }

  formatKnowledgeContext(knowledgeBase, draftComparisons, strategyGuidance) {
    let context = '';
    
    if (strategyGuidance && strategyGuidance.roundGuidance) {
      context += `ROUND ${strategyGuidance.currentRound} STRATEGY GUIDANCE:\n`;
      context += `- Focus: ${strategyGuidance.roundGuidance.focus}\n`;
      context += `- Target Positions: ${strategyGuidance.roundGuidance.positions.join(', ')}\n`;
      context += `- Avoid: ${strategyGuidance.roundGuidance.avoid}\n`;
      context += `- Strategy: ${strategyGuidance.roundGuidance.strategy}\n\n`;
    }
    
    if (draftComparisons && Object.keys(draftComparisons).length > 0) {
      context += `DRAFT COMPARISON DATA:\n`;
      Object.entries(draftComparisons).forEach(([player, data]) => {
        const valueText = data.avgValue > 0 ? `+${data.avgValue.toFixed(1)} (value)` : 
                         data.avgValue < 0 ? `${data.avgValue.toFixed(1)} (reach)` : 'exact ADP';
        context += `- ${player}: Avg pick ${data.avgPick.toFixed(1)}, Value: ${valueText} (${data.totalDrafts} drafts)\n`;
      });
      context += '\n';
    }
    
    if (knowledgeBase && knowledgeBase.length > 0) {
      context += `RELEVANT STRATEGY ARTICLES:\n`;
      knowledgeBase.forEach((article, index) => {
        context += `${index + 1}. ${article.title} (${article.source})\n`;
        context += `   ${article.content.substring(0, 200)}...\n\n`;
      });
    }
    
    return context || 'No additional context available';
  }

  formatRoster(roster) {
    if (!roster || roster.length === 0) {
      return "No players drafted yet";
    }

    const positions = {};
    roster.forEach(player => {
      if (!positions[player.position]) {
        positions[player.position] = [];
      }
      positions[player.position].push(player.name);
    });

    return Object.entries(positions)
      .map(([pos, players]) => `${pos}: ${players.join(', ')}`)
      .join('\n');
  }

  analyzePositionNeeds(roster, leagueSettings) {
    const requiredPositions = leagueSettings.rosterPositions;
    const currentPositions = {};
    
    if (roster) {
      roster.forEach(player => {
        currentPositions[player.position] = (currentPositions[player.position] || 0) + 1;
      });
    }

    const needs = [];
    Object.entries(requiredPositions).forEach(([pos, required]) => {
      const current = currentPositions[pos] || 0;
      const need = Math.max(0, required - current);
      if (need > 0) {
        needs.push(`${pos}: Need ${need} more`);
      }
    });

    return needs.length > 0 ? needs.join('\n') : 'All positions filled for starters';
  }

  formatAvailablePlayers(players) {
    return players.map(player => 
      `${player.name} (${player.position}, ${player.team}) - ` +
      `Proj: ${player.projectedPoints || 'N/A'}, ` +
      `ADP: ${player.adp || 'N/A'}, ` +
      `Injury: ${player.injuryStatus || 'Healthy'}`
    ).join('\n');
  }

  formatRecentPicks(picks) {
    if (!picks || picks.length === 0) {
      return "No recent picks available";
    }

    return picks.slice(0, 10).map(pick => 
      `Pick ${pick.overallPickNumber}: ${pick.playerName} (${pick.position}) to ${pick.teamName}`
    ).join('\n');
  }

  formatTeamNeeds(teams) {
    if (!teams || teams.length === 0) {
      return "Team needs analysis not available";
    }

    return teams.map(team => {
      const needs = this.analyzeTeamNeeds(team.roster);
      return `${team.name}: ${needs}`;
    }).join('\n');
  }

  analyzeTeamNeeds(roster) {
    const positions = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
    
    if (roster) {
      roster.forEach(player => {
        if (positions.hasOwnProperty(player.position)) {
          positions[player.position]++;
        }
      });
    }

    const needs = [];
    if (positions.QB === 0) needs.push('QB');
    if (positions.RB < 2) needs.push('RB');
    if (positions.WR < 2) needs.push('WR');
    if (positions.TE === 0) needs.push('TE');
    if (positions.K === 0) needs.push('K');
    if (positions.DST === 0) needs.push('DST');

    return needs.length > 0 ? needs.join(', ') : 'No immediate needs';
  }

  parseDraftRecommendations(response) {
    try {
      return JSON.parse(response);
    } catch (error) {
      logger.error('Failed to parse Claude AI response as JSON:', error.message);
      
      return {
        recommendations: [{
          player: "Analysis Error",
          position: "N/A",
          team: "N/A",
          urgency: "MEDIUM",
          reasoning: "Could not parse AI response properly. Please check manually.",
          valueRating: 5,
          riskLevel: "MEDIUM"
        }],
        steals: [],
        threats: [],
        strategy: {
          nextRound: "Best Player Available",
          reasoning: "Analysis failed, recommend conservative approach"
        },
        rawResponse: response
      };
    }
  }

  async analyzeWeeklyLineup(lineupContext) {
    const systemPrompt = `You are an expert fantasy football analyst specializing in weekly lineup optimization. Consider matchups, weather, injuries, and recent form.`;

    const userMessage = `Analyze this weekly lineup decision:

WEEK: ${lineupContext.week}
LEAGUE: ${lineupContext.leagueSettings.scoringType}

MY ROSTER:
${this.formatWeeklyRoster(lineupContext.roster)}

AVAILABLE PLAYERS:
${this.formatAvailablePlayers(lineupContext.availablePlayers)}

MATCHUP ANALYSIS:
${this.formatMatchups(lineupContext.matchups)}

WEATHER CONDITIONS:
${this.formatWeather(lineupContext.weather)}

Provide start/sit recommendations with confidence levels and reasoning.`;

    try {
      const messages = [{ role: 'user', content: userMessage }];
      const response = await this.makeRequest(messages, systemPrompt);
      return this.parseLineupRecommendations(response);
    } catch (error) {
      logger.error('Failed to analyze weekly lineup:', error.message);
      throw error;
    }
  }

  formatWeeklyRoster(roster) {
    return roster.map(player => 
      `${player.name} (${player.position}) vs ${player.opponent} - ${player.status || 'Active'}`
    ).join('\n');
  }

  formatMatchups(matchups) {
    return matchups.map(matchup => 
      `${matchup.team} vs ${matchup.opponent}: ${matchup.analysis}`
    ).join('\n');
  }

  formatWeather(weather) {
    if (!weather || weather.length === 0) {
      return "No weather concerns";
    }
    
    return weather.map(game => 
      `${game.teams}: ${game.conditions} - ${game.impact || 'Minimal impact'}`
    ).join('\n');
  }

  parseLineupRecommendations(response) {
    try {
      return JSON.parse(response);
    } catch (error) {
      logger.error('Failed to parse lineup recommendations:', error.message);
      return {
        recommendations: [],
        reasoning: response
      };
    }
  }

  async analyzeTradeOpportunity(tradeContext) {
    const systemPrompt = `You are an expert fantasy football trade analyst. Evaluate trade fairness, team fit, and long-term value.`;

    const userMessage = `Analyze this trade opportunity:

PROPOSED TRADE:
Giving: ${tradeContext.giving.map(p => `${p.name} (${p.position})`).join(', ')}
Receiving: ${tradeContext.receiving.map(p => `${p.name} (${p.position})`).join(', ')}

MY CURRENT ROSTER:
${this.formatRoster(tradeContext.myRoster)}

THEIR CURRENT ROSTER:
${this.formatRoster(tradeContext.theirRoster)}

LEAGUE SETTINGS:
${tradeContext.leagueSettings.scoringType}, Week ${tradeContext.currentWeek}

Evaluate fairness, team fit, and provide recommendation.`;

    try {
      const messages = [{ role: 'user', content: userMessage }];
      const response = await this.makeRequest(messages, systemPrompt);
      return this.parseTradeAnalysis(response);
    } catch (error) {
      logger.error('Failed to analyze trade:', error.message);
      throw error;
    }
  }

  parseTradeAnalysis(response) {
    try {
      return JSON.parse(response);
    } catch (error) {
      return {
        recommendation: 'NEUTRAL',
        reasoning: response,
        fairnessScore: 5
      };
    }
  }

  async healthCheck() {
    try {
      const messages = [{
        role: 'user',
        content: 'Respond with "OK" if you are functioning properly.'
      }];

      const response = await this.makeRequest(messages);
      return { 
        status: response.includes('OK') ? 'connected' : 'degraded',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = ClaudeAI;