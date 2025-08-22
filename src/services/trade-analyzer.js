/**
 * AI Trade Suggestion System
 * Analyzes team needs and suggests optimal trades
 */
const createLogger = require('../utils/logger');
const { Validator, ValidationError } = require('../utils/validation');
const ImprovedClaudeAI = require('../api/improved-claude-ai');
const ESPN_2025_DRAFT_GUIDE = require('../data/espn-2025-draft-guide');
const TradeWebhook = require('./trade-webhook');

const logger = createLogger();

class TradeAnalyzer {
  constructor() {
    this.claude = new ImprovedClaudeAI();
    this.tradeHistory = [];
    this.marketValues = new Map();
    this.lastMarketUpdate = null;
    this.webhook = new TradeWebhook();
  }

  /**
   * Analyze potential trades for a team
   */
  async analyzeTradeOpportunities(teamData, leagueData, options = {}) {
    try {
      this.validateInputs(teamData, leagueData);
      
      logger.info('🔄 Analyzing trade opportunities', { 
        team: teamData.teamName,
        rosterSize: teamData.roster?.length || 0
      });

      // Get current market values
      await this.updateMarketValues();

      // Analyze team strengths and weaknesses
      const teamAnalysis = this.analyzeTeamComposition(teamData);
      
      // Find potential trade partners
      const tradePartners = this.identifyTradePartners(teamData, leagueData, teamAnalysis);
      
      // Generate AI-powered trade suggestions
      const suggestions = await this.generateTradeSuggestions(
        teamData, 
        tradePartners, 
        teamAnalysis,
        options
      );

      // Rank and filter suggestions
      const rankedSuggestions = this.rankTradeSuggestions(suggestions, teamAnalysis);

      const result = {
        success: true,
        teamAnalysis,
        suggestions: rankedSuggestions,
        marketTrends: this.getMarketTrends(),
        timestamp: new Date().toISOString()
      };

      // Send analysis to Discord webhook if enabled
      if (options.sendToDiscord !== false) {
        try {
          await this.webhook.sendTradeAnalysis(teamData.teamName, result);
          if (rankedSuggestions.length > 0) {
            await this.webhook.sendTradeSuggestions(teamData.teamName, rankedSuggestions);
          }
        } catch (error) {
          logger.warn('Failed to send trade analysis to Discord:', error.message);
        }
      }

      return result;

    } catch (error) {
      logger.error('Trade analysis failed:', error.message);
      throw new Error(`Trade analysis error: ${error.message}`);
    }
  }

  /**
   * Validate inputs
   */
  validateInputs(teamData, leagueData) {
    Validator.validateObject(teamData, 'teamData', {
      teamName: (value) => Validator.validateString(value, 'teamName', { required: true }),
      roster: (value) => Validator.validateArray(value, 'roster', { minLength: 1 })
    });

    Validator.validateObject(leagueData, 'leagueData', {
      teams: (value) => Validator.validateArray(value, 'teams', { minLength: 2 }),
      settings: (value) => Validator.validateObject(value, 'settings')
    });
  }

  /**
   * Analyze team composition for strengths/weaknesses
   */
  analyzeTeamComposition(teamData) {
    const roster = teamData.roster || [];
    const analysis = {
      positions: { QB: [], RB: [], WR: [], TE: [], K: [], DST: [] },
      strengths: [],
      weaknesses: [],
      tradeable: [],
      needs: [],
      depthChart: {}
    };

    // Categorize players by position
    roster.forEach(player => {
      const pos = player.position || 'UNKNOWN';
      if (analysis.positions[pos]) {
        analysis.positions[pos].push({
          ...player,
          marketValue: this.getPlayerMarketValue(player),
          tier: this.getPlayerTier(player),
          age: this.getPlayerAge(player),
          injury: this.getInjuryRisk(player)
        });
      }
    });

    // Analyze each position
    for (const [position, players] of Object.entries(analysis.positions)) {
      const positionAnalysis = this.analyzePosition(position, players);
      analysis.depthChart[position] = positionAnalysis;

      if (positionAnalysis.strength === 'high') {
        analysis.strengths.push({
          position,
          reason: positionAnalysis.reason,
          tradeableAssets: positionAnalysis.surplus
        });
      } else if (positionAnalysis.strength === 'low') {
        analysis.weaknesses.push({
          position,
          reason: positionAnalysis.reason,
          need: positionAnalysis.need
        });
      }
    }

    // Identify tradeable assets (surplus at strong positions)
    analysis.tradeable = this.identifyTradeableAssets(analysis);
    
    // Identify needs (weaknesses to address)
    analysis.needs = this.identifyNeeds(analysis);

    return analysis;
  }

  /**
   * Analyze individual position strength
   */
  analyzePosition(position, players) {
    const starters = this.getStarterRequirements(position);
    const benchDepth = this.getBenchRequirements(position);
    
    const tier1Players = players.filter(p => p.tier === 1);
    const tier2Players = players.filter(p => p.tier === 2);
    const tier3Players = players.filter(p => p.tier === 3);

    let strength = 'medium';
    let reason = '';
    let surplus = [];
    let need = null;

    if (players.length < starters.min) {
      strength = 'low';
      reason = `Only ${players.length} ${position}(s), need ${starters.min - players.length} more starters`;
      need = { type: 'starter', count: starters.min - players.length };
    } else if (tier1Players.length >= 2 && players.length > starters.ideal + benchDepth) {
      strength = 'high';
      reason = `Deep at ${position} with multiple elite players`;
      surplus = players.slice(starters.ideal + 1); // Everything beyond ideal starters + 1 bench
    } else if (tier1Players.length === 0 && tier2Players.length < starters.min) {
      strength = 'low';
      reason = `Weak ${position} depth, no elite options`;
      need = { type: 'upgrade', tier: 1 };
    } else if (players.length === starters.min && tier2Players.length === 0) {
      strength = 'low';
      reason = `No ${position} depth behind starters`;
      need = { type: 'depth', count: 1 };
    }

    return {
      strength,
      reason,
      surplus,
      need,
      starters: players.slice(0, starters.ideal),
      bench: players.slice(starters.ideal),
      tier1: tier1Players.length,
      tier2: tier2Players.length,
      tier3: tier3Players.length
    };
  }

  /**
   * Get starter requirements by position
   */
  getStarterRequirements(position) {
    const requirements = {
      QB: { min: 1, ideal: 1 },
      RB: { min: 2, ideal: 2 },
      WR: { min: 2, ideal: 3 },
      TE: { min: 1, ideal: 1 },
      K: { min: 1, ideal: 1 },
      DST: { min: 1, ideal: 1 }
    };
    return requirements[position] || { min: 1, ideal: 1 };
  }

  /**
   * Get bench depth requirements
   */
  getBenchRequirements(position) {
    const benchNeeds = {
      QB: 1, RB: 2, WR: 2, TE: 1, K: 0, DST: 0
    };
    return benchNeeds[position] || 1;
  }

  /**
   * Identify tradeable assets
   */
  identifyTradeableAssets(analysis) {
    const tradeable = [];
    
    for (const strength of analysis.strengths) {
      if (strength.tradeableAssets && strength.tradeableAssets.length > 0) {
        strength.tradeableAssets.forEach(asset => {
          tradeable.push({
            ...asset,
            reason: `Surplus at ${strength.position}`,
            tradeValue: 'high'
          });
        });
      }
    }

    return tradeable.sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));
  }

  /**
   * Identify team needs
   */
  identifyNeeds(analysis) {
    return analysis.weaknesses.map(weakness => ({
      position: weakness.position,
      priority: this.calculateNeedPriority(weakness),
      type: weakness.need?.type || 'upgrade',
      requirement: weakness.need,
      reason: weakness.reason
    })).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calculate need priority (0-100)
   */
  calculateNeedPriority(weakness) {
    let priority = 50; // Base priority
    
    if (weakness.reason.includes('Only') && weakness.reason.includes('need')) {
      priority += 40; // Starter shortage is critical
    } else if (weakness.reason.includes('no elite')) {
      priority += 25; // Need upgrade
    } else if (weakness.reason.includes('No') && weakness.reason.includes('depth')) {
      priority += 15; // Need bench depth
    }

    // Position importance modifier
    const positionImportance = {
      QB: 1.2, RB: 1.1, WR: 1.1, TE: 0.9, K: 0.5, DST: 0.5
    };
    
    priority *= (positionImportance[weakness.position] || 1);
    
    return Math.min(100, Math.round(priority));
  }

  /**
   * Identify potential trade partners
   */
  identifyTradePartners(myTeam, leagueData, myAnalysis) {
    const partners = [];
    
    for (const team of leagueData.teams) {
      if (team.teamName === myTeam.teamName) continue;
      
      const partnerAnalysis = this.analyzeTeamComposition(team);
      const compatibility = this.calculateTradeCompatibility(myAnalysis, partnerAnalysis);
      
      if (compatibility.score > 30) { // Threshold for viable trades
        partners.push({
          team,
          analysis: partnerAnalysis,
          compatibility,
          potentialTrades: compatibility.opportunities
        });
      }
    }

    return partners.sort((a, b) => b.compatibility.score - a.compatibility.score);
  }

  /**
   * Calculate trade compatibility between teams
   */
  calculateTradeCompatibility(myAnalysis, partnerAnalysis) {
    const opportunities = [];
    let score = 0;

    // Check if their strengths align with my needs
    for (const myNeed of myAnalysis.needs) {
      for (const theirStrength of partnerAnalysis.strengths) {
        if (myNeed.position === theirStrength.position) {
          opportunities.push({
            type: 'need_for_strength',
            myNeed,
            theirStrength,
            value: myNeed.priority + 20
          });
          score += myNeed.priority;
        }
      }
    }

    // Check if my strengths align with their needs
    for (const myStrength of myAnalysis.strengths) {
      for (const theirNeed of partnerAnalysis.needs) {
        if (myStrength.position === theirNeed.position) {
          opportunities.push({
            type: 'strength_for_need',
            myStrength,
            theirNeed,
            value: theirNeed.priority + 15
          });
          score += theirNeed.priority * 0.8; // Slightly lower value for giving
        }
      }
    }

    return {
      score: Math.round(score),
      opportunities: opportunities.sort((a, b) => b.value - a.value),
      mutualBenefit: opportunities.length >= 2
    };
  }

  /**
   * Generate AI-powered trade suggestions
   */
  async generateTradeSuggestions(myTeam, tradePartners, myAnalysis, options) {
    const suggestions = [];
    
    for (const partner of tradePartners.slice(0, 3)) { // Top 3 partners
      try {
        const aiSuggestion = await this.getAITradeSuggestion(
          myTeam, 
          partner.team, 
          myAnalysis, 
          partner.analysis,
          partner.compatibility
        );
        
        if (aiSuggestion && aiSuggestion.suggestions) {
          suggestions.push(...aiSuggestion.suggestions.map(suggestion => ({
            ...suggestion,
            partner: partner.team.teamName,
            compatibility: partner.compatibility.score,
            aiAnalysis: aiSuggestion.analysis
          })));
        }
      } catch (error) {
        logger.warn(`Failed to get AI suggestion for ${partner.team.teamName}:`, error.message);
      }
    }

    return suggestions;
  }

  /**
   * Get AI-powered trade suggestion
   */
  async getAITradeSuggestion(myTeam, partnerTeam, myAnalysis, partnerAnalysis, compatibility) {
    const systemPrompt = `You are an expert fantasy football trade analyst. Analyze team compositions and suggest realistic, mutually beneficial trades.

Guidelines:
- Consider positional needs and surplus
- Factor in player values and tier rankings
- Ensure trades are fair (within 10% value)
- Consider injury risks and age
- Suggest 1-3 realistic trade options
- Include reasoning for each suggestion

Current Date: ${new Date().toLocaleDateString()}
Season: 2025 NFL Fantasy Football`;

    const userMessage = `Analyze potential trades between these teams:

MY TEAM (${myTeam.teamName}):
${this.formatTeamAnalysis(myAnalysis)}

TRADE PARTNER (${partnerTeam.teamName}):
${this.formatTeamAnalysis(partnerAnalysis)}

TRADE COMPATIBILITY:
${this.formatCompatibility(compatibility)}

Suggest 1-3 realistic trades that would benefit both teams. For each trade:
1. Specify exact players involved
2. Explain the reasoning
3. Rate the fairness (1-10)
4. Note any risks

Format as JSON with structure:
{
  "suggestions": [
    {
      "trade": {
        "give": ["Player Name"],
        "receive": ["Player Name"]
      },
      "reasoning": "Why this trade works",
      "fairness": 8,
      "risks": ["Risk 1", "Risk 2"]
    }
  ],
  "analysis": "Overall trade outlook"
}`;

    try {
      const response = await this.claude.makeRequest([{
        role: 'user',
        content: userMessage
      }], systemPrompt);

      return this.parseTradeSuggestion(response);
    } catch (error) {
      logger.error('AI trade suggestion failed:', error.message);
      return null;
    }
  }

  /**
   * Format team analysis for AI
   */
  formatTeamAnalysis(analysis) {
    let formatted = 'ROSTER BY POSITION:\n';
    
    for (const [position, players] of Object.entries(analysis.positions)) {
      if (players.length > 0) {
        formatted += `${position}: ${players.map(p => 
          `${p.name} (Tier ${p.tier}, Value: ${p.marketValue || 'N/A'})`
        ).join(', ')}\n`;
      }
    }

    formatted += '\nSTRENGTHS:\n';
    analysis.strengths.forEach(strength => {
      formatted += `- ${strength.position}: ${strength.reason}\n`;
    });

    formatted += '\nNEEDS:\n';
    analysis.needs.forEach(need => {
      formatted += `- ${need.position} (Priority ${need.priority}): ${need.reason}\n`;
    });

    return formatted;
  }

  /**
   * Format compatibility for AI
   */
  formatCompatibility(compatibility) {
    let formatted = `Compatibility Score: ${compatibility.score}/100\n`;
    formatted += `Mutual Benefit Potential: ${compatibility.mutualBenefit ? 'Yes' : 'No'}\n\n`;
    
    formatted += 'TRADE OPPORTUNITIES:\n';
    compatibility.opportunities.forEach((opp, i) => {
      formatted += `${i + 1}. ${opp.type}: ${opp.myNeed?.position || opp.myStrength?.position} (Value: ${opp.value})\n`;
    });

    return formatted;
  }

  /**
   * Parse AI trade suggestion response
   */
  parseTradeSuggestion(response) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: parse structured text
      return this.parseTextSuggestion(response);
    } catch (error) {
      logger.warn('Failed to parse AI trade suggestion:', error.message);
      return {
        suggestions: [],
        analysis: response
      };
    }
  }

  /**
   * Parse text-based trade suggestion
   */
  parseTextSuggestion(response) {
    const suggestions = [];
    const lines = response.split('\n');
    let currentSuggestion = null;

    for (const line of lines) {
      if (line.match(/Trade \d+|Suggestion \d+/i)) {
        if (currentSuggestion) {
          suggestions.push(currentSuggestion);
        }
        currentSuggestion = {
          trade: { give: [], receive: [] },
          reasoning: '',
          fairness: 5,
          risks: []
        };
      } else if (currentSuggestion && line.includes('Give:')) {
        currentSuggestion.trade.give = this.extractPlayerNames(line);
      } else if (currentSuggestion && line.includes('Receive:')) {
        currentSuggestion.trade.receive = this.extractPlayerNames(line);
      } else if (currentSuggestion && line.trim()) {
        currentSuggestion.reasoning += line.trim() + ' ';
      }
    }

    if (currentSuggestion) {
      suggestions.push(currentSuggestion);
    }

    return {
      suggestions,
      analysis: response
    };
  }

  /**
   * Extract player names from text
   */
  extractPlayerNames(text) {
    // Simple extraction - look for capitalized names
    const namePattern = /([A-Z][a-z]+ [A-Z][a-z]+)/g;
    const matches = text.match(namePattern) || [];
    return matches.filter(name => name.length > 5 && !name.includes('Give') && !name.includes('Receive'));
  }

  /**
   * Rank trade suggestions by value
   */
  rankTradeSuggestions(suggestions, myAnalysis) {
    return suggestions
      .map(suggestion => ({
        ...suggestion,
        score: this.calculateTradeScore(suggestion, myAnalysis)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5 suggestions
  }

  /**
   * Calculate trade score
   */
  calculateTradeScore(suggestion, myAnalysis) {
    let score = suggestion.fairness || 5;
    
    // Boost score if addresses high priority needs
    if (suggestion.trade.receive) {
      for (const playerName of suggestion.trade.receive) {
        const player = this.findPlayerInAnalysis(playerName, myAnalysis);
        if (player) {
          const need = myAnalysis.needs.find(n => n.position === player.position);
          if (need) {
            score += need.priority * 0.1;
          }
        }
      }
    }

    // Reduce score for giving up too much value
    if (suggestion.trade.give && suggestion.trade.give.length > suggestion.trade.receive?.length) {
      score -= 1;
    }

    return Math.round(score * 10) / 10;
  }

  /**
   * Helper methods for player data
   */
  getPlayerMarketValue(player) {
    return this.marketValues.get(player.name) || this.estimateValue(player);
  }

  getPlayerTier(player) {
    // Simple tier estimation based on position and name recognition
    const tier1Names = ['McCaffrey', 'Jefferson', 'Chase', 'Barkley', 'Kelce'];
    const tier2Names = ['Henry', 'Adams', 'Brown', 'Jacobs', 'Hill'];
    
    if (tier1Names.some(name => player.name?.includes(name))) return 1;
    if (tier2Names.some(name => player.name?.includes(name))) return 2;
    return 3;
  }

  getPlayerAge(player) {
    // Placeholder - would integrate with player database
    return player.age || 26;
  }

  getInjuryRisk(player) {
    // Placeholder - would integrate with injury database
    return player.injuryRisk || 'low';
  }

  estimateValue(player) {
    const tierValues = { 1: 100, 2: 70, 3: 40 };
    return tierValues[this.getPlayerTier(player)] || 30;
  }

  findPlayerInAnalysis(playerName, analysis) {
    for (const players of Object.values(analysis.positions)) {
      const found = players.find(p => p.name?.includes(playerName) || playerName.includes(p.name));
      if (found) return found;
    }
    return null;
  }

  /**
   * Update market values from external sources
   */
  async updateMarketValues() {
    if (this.lastMarketUpdate && Date.now() - this.lastMarketUpdate < 24 * 60 * 60 * 1000) {
      return; // Updated within last 24 hours
    }

    // Placeholder for market value updates
    // Would integrate with FantasyPros, Yahoo, etc.
    this.lastMarketUpdate = Date.now();
  }

  /**
   * Get market trends
   */
  getMarketTrends() {
    return {
      rising: ['Young RBs', 'Elite TEs', 'Dual-threat QBs'],
      falling: ['Aging RBs', 'Injury-prone WRs', 'Kickers'],
      lastUpdated: this.lastMarketUpdate ? new Date(this.lastMarketUpdate).toISOString() : null
    };
  }

  /**
   * Comprehensive team analysis including league context
   */
  async analyzeTeamWithLeagueContext(teamData, leagueData, seasonStats = {}) {
    try {
      const baseAnalysis = this.analyzeTeamComposition(teamData);
      
      // Add league context analysis
      const leagueContext = this.analyzeLeagueContext(teamData, leagueData, seasonStats);
      const competitiveAnalysis = this.analyzeCompetitivePosition(teamData, leagueData, seasonStats);
      const playerPerformance = await this.analyzePlayerPerformance(teamData.roster, seasonStats);
      
      return {
        ...baseAnalysis,
        leagueContext,
        competitiveAnalysis,
        playerPerformance,
        tradeUrgency: this.calculateTradeUrgency(baseAnalysis, leagueContext, competitiveAnalysis),
        recommendations: this.generateStrategicRecommendations(baseAnalysis, leagueContext, competitiveAnalysis)
      };
    } catch (error) {
      logger.error('Comprehensive team analysis failed:', error.message);
      throw error;
    }
  }

  /**
   * Analyze league context (standings, matchups, etc.)
   */
  analyzeLeagueContext(myTeam, leagueData, seasonStats) {
    const standings = this.calculateStandings(leagueData, seasonStats);
    const myPosition = standings.findIndex(team => team.teamName === myTeam.teamName) + 1;
    const totalTeams = standings.length;
    
    const playoffSpots = Math.ceil(totalTeams / 2);
    const isInPlayoffs = myPosition <= playoffSpots;
    const distanceFromPlayoffs = isInPlayoffs ? 0 : myPosition - playoffSpots;
    
    return {
      standings,
      myPosition,
      totalTeams,
      playoffSpots,
      isInPlayoffs,
      distanceFromPlayoffs,
      weekRemaining: this.calculateWeeksRemaining(),
      urgencyLevel: this.calculateUrgencyLevel(myPosition, totalTeams, distanceFromPlayoffs)
    };
  }

  /**
   * Analyze competitive position vs other teams
   */
  analyzeCompetitivePosition(myTeam, leagueData, seasonStats) {
    const allTeams = leagueData.teams || [];
    const teamStrengths = allTeams.map(team => {
      const analysis = this.analyzeTeamComposition(team);
      return {
        teamName: team.teamName,
        overallStrength: this.calculateOverallStrength(analysis),
        positionStrengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        projectedScore: this.projectWeeklyScore(team, seasonStats)
      };
    });

    const myTeamStrength = teamStrengths.find(t => t.teamName === myTeam.teamName);
    const strongerTeams = teamStrengths.filter(t => t.overallStrength > myTeamStrength.overallStrength);
    const weakerTeams = teamStrengths.filter(t => t.overallStrength < myTeamStrength.overallStrength);

    return {
      myTeamStrength,
      strongerTeams: strongerTeams.sort((a, b) => b.overallStrength - a.overallStrength),
      weakerTeams: weakerTeams.sort((a, b) => b.overallStrength - a.overallStrength),
      competitiveGaps: this.identifyCompetitiveGaps(myTeamStrength, strongerTeams),
      exploitableWeaknesses: this.findExploitableWeaknesses(weakerTeams)
    };
  }

  /**
   * Analyze current player performance vs projections
   */
  async analyzePlayerPerformance(roster, seasonStats) {
    const performanceAnalysis = roster.map(player => {
      const stats = seasonStats[player.name] || {};
      const weeklyAvg = stats.weeklyAverage || 0;
      const projectedAvg = this.getPlayerProjection(player);
      const trend = stats.last3Games || [];
      
      return {
        name: player.name,
        position: player.position,
        weeklyAverage: weeklyAvg,
        projectedAverage: projectedAvg,
        outperforming: weeklyAvg > projectedAvg,
        variance: weeklyAvg - projectedAvg,
        trend: this.calculateTrend(trend),
        reliability: this.calculateReliability(stats),
        tradeValue: this.calculateCurrentTradeValue(player, stats)
      };
    });

    return {
      overperformers: performanceAnalysis.filter(p => p.outperforming),
      underperformers: performanceAnalysis.filter(p => !p.outperforming),
      rising: performanceAnalysis.filter(p => p.trend === 'rising'),
      declining: performanceAnalysis.filter(p => p.trend === 'declining'),
      sellHigh: performanceAnalysis.filter(p => p.outperforming && p.trend === 'declining'),
      buyLow: performanceAnalysis.filter(p => !p.outperforming && p.trend === 'rising')
    };
  }

  /**
   * Calculate trade urgency based on multiple factors
   */
  calculateTradeUrgency(teamAnalysis, leagueContext, competitiveAnalysis) {
    let urgency = 0;
    let factors = [];

    // Position in standings
    if (!leagueContext.isInPlayoffs) {
      urgency += (leagueContext.distanceFromPlayoffs * 10);
      factors.push(`${leagueContext.distanceFromPlayoffs} spots from playoffs`);
    }

    // Critical weaknesses
    const criticalNeeds = teamAnalysis.needs.filter(need => need.priority > 80);
    urgency += (criticalNeeds.length * 15);
    if (criticalNeeds.length > 0) {
      factors.push(`${criticalNeeds.length} critical position needs`);
    }

    // Weeks remaining
    const weeksLeft = this.calculateWeeksRemaining();
    if (weeksLeft <= 4) {
      urgency += 20;
      factors.push('Trade deadline approaching');
    }

    // Competitive gap
    const avgStrongerTeam = competitiveAnalysis.strongerTeams.reduce((sum, team) => 
      sum + team.overallStrength, 0) / competitiveAnalysis.strongerTeams.length;
    const competitiveGap = avgStrongerTeam - competitiveAnalysis.myTeamStrength.overallStrength;
    urgency += Math.min(30, competitiveGap * 5);
    if (competitiveGap > 2) {
      factors.push('Significant competitive gap exists');
    }

    return {
      score: Math.min(100, urgency),
      level: urgency > 70 ? 'CRITICAL' : urgency > 40 ? 'HIGH' : urgency > 20 ? 'MEDIUM' : 'LOW',
      factors
    };
  }

  /**
   * Generate strategic trade recommendations
   */
  generateStrategicRecommendations(teamAnalysis, leagueContext, competitiveAnalysis) {
    const recommendations = [];

    // Playoff push recommendations
    if (!leagueContext.isInPlayoffs && leagueContext.distanceFromPlayoffs <= 2) {
      recommendations.push({
        type: 'PLAYOFF_PUSH',
        priority: 'HIGH',
        action: 'Trade for immediate impact players',
        reasoning: 'Close to playoff spot, need immediate scoring boost',
        targets: teamAnalysis.needs.filter(need => need.priority > 70)
      });
    }

    // Sell high on overperformers
    if (competitiveAnalysis.myTeamStrength?.sellHigh?.length > 0) {
      recommendations.push({
        type: 'SELL_HIGH',
        priority: 'MEDIUM',
        action: 'Trade overperforming players before regression',
        reasoning: 'Maximize value from players performing above expectations',
        players: competitiveAnalysis.myTeamStrength.sellHigh.slice(0, 3)
      });
    }

    // Buy low opportunities
    const buyLowTargets = this.findBuyLowTargets(competitiveAnalysis.weakerTeams);
    if (buyLowTargets.length > 0) {
      recommendations.push({
        type: 'BUY_LOW',
        priority: 'MEDIUM',
        action: 'Target underperforming players with upside',
        reasoning: 'Acquire players below market value',
        targets: buyLowTargets.slice(0, 3)
      });
    }

    // Championship preparation
    if (leagueContext.myPosition <= 3) {
      recommendations.push({
        type: 'CHAMPIONSHIP_PREP',
        priority: 'HIGH',
        action: 'Optimize for playoff schedule and upside',
        reasoning: 'Strong position, focus on playoff matchups and ceiling',
        focus: ['Elite players with favorable playoff schedules', 'High-ceiling plays over safe floors']
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Helper methods for comprehensive analysis
   */
  calculateStandings(leagueData, seasonStats) {
    return (leagueData.teams || [])
      .map(team => ({
        teamName: team.teamName,
        wins: seasonStats[team.teamName]?.wins || 0,
        losses: seasonStats[team.teamName]?.losses || 0,
        pointsFor: seasonStats[team.teamName]?.pointsFor || 0,
        pointsAgainst: seasonStats[team.teamName]?.pointsAgainst || 0
      }))
      .sort((a, b) => {
        if (a.wins !== b.wins) return b.wins - a.wins;
        return b.pointsFor - a.pointsFor;
      });
  }

  calculateWeeksRemaining() {
    const currentWeek = new Date().getMonth() >= 8 ? Math.min(17, Math.floor((Date.now() - new Date(new Date().getFullYear(), 8, 1)) / (7 * 24 * 60 * 60 * 1000)) + 1) : 1;
    return Math.max(0, 14 - currentWeek); // Regular season ends week 14
  }

  calculateOverallStrength(analysis) {
    let strength = 50; // Base score
    
    // Add points for strengths
    strength += analysis.strengths.length * 10;
    
    // Subtract for weaknesses
    strength -= analysis.weaknesses.length * 8;
    
    // Factor in player tiers
    const totalTier1 = Object.values(analysis.positions).flat().filter(p => p.tier === 1).length;
    const totalTier2 = Object.values(analysis.positions).flat().filter(p => p.tier === 2).length;
    
    strength += totalTier1 * 5;
    strength += totalTier2 * 2;
    
    return Math.max(0, Math.min(100, strength));
  }

  getPlayerProjection(player) {
    const positionAverages = { QB: 18, RB: 12, WR: 10, TE: 8, K: 8, DST: 8 };
    const tierMultipliers = { 1: 1.4, 2: 1.1, 3: 0.9 };
    
    const baseProjection = positionAverages[player.position] || 8;
    const tierMultiplier = tierMultipliers[this.getPlayerTier(player)] || 1;
    
    return baseProjection * tierMultiplier;
  }

  calculateTrend(recentGames) {
    if (!recentGames || recentGames.length < 2) return 'stable';
    
    const recent = recentGames.slice(-3);
    const avg = recent.reduce((sum, game) => sum + game, 0) / recent.length;
    const older = recentGames.slice(0, -3);
    const oldAvg = older.length > 0 ? older.reduce((sum, game) => sum + game, 0) / older.length : avg;
    
    if (avg > oldAvg * 1.1) return 'rising';
    if (avg < oldAvg * 0.9) return 'declining';
    return 'stable';
  }

  calculateReliability(stats) {
    const scores = stats.weeklyScores || [];
    if (scores.length < 3) return 'unknown';
    
    const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    
    const reliability = 1 - (stdDev / avg);
    
    if (reliability > 0.8) return 'high';
    if (reliability > 0.6) return 'medium';
    return 'low';
  }

  calculateCurrentTradeValue(player, stats) {
    const baseValue = this.getPlayerMarketValue(player);
    const performanceMultiplier = (stats.weeklyAverage || 0) / this.getPlayerProjection(player);
    const trendMultiplier = stats.trend === 'rising' ? 1.1 : stats.trend === 'declining' ? 0.9 : 1;
    
    return Math.round(baseValue * performanceMultiplier * trendMultiplier);
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.claude) {
      this.claude.destroy();
    }
    this.tradeHistory = [];
    this.marketValues.clear();
  }
}

module.exports = TradeAnalyzer;