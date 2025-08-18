const ESPNClient = require('../api/espn-client');
const ClaudeAI = require('../api/claude-ai');
const FantasyKnowledgeEnhancer = require('../knowledge/fantasy-enhancer');
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

class LiveDraftAnalyzer {
  constructor() {
    this.espnClient = new ESPNClient();
    this.claude = new ClaudeAI();
    this.knowledgeEnhancer = new FantasyKnowledgeEnhancer();
    this.activeDrafts = new Map(); // Track active draft sessions
  }

  async startDraftSession(leagueId, userId) {
    try {
      // Get current draft state
      const draftData = await this.getDraftState(leagueId);
      
      if (!draftData || !draftData.draftDetail) {
        return {
          success: false,
          message: "No active draft found for this league. Make sure your draft is in progress!"
        };
      }

      // Store draft session
      this.activeDrafts.set(userId, {
        leagueId,
        draftData,
        startTime: new Date(),
        lastUpdate: new Date()
      });

      return {
        success: true,
        message: `✅ Connected to live draft! League: ${draftData.settings?.name || 'Unknown'}`,
        draftInfo: this.formatDraftInfo(draftData)
      };

    } catch (error) {
      logger.error('Failed to start draft session:', error);
      return {
        success: false,
        message: "❌ Could not connect to ESPN draft. Check your league ID and make sure the draft is active."
      };
    }
  }

  async getDraftState(leagueId = null) {
    try {
      // Use provided leagueId or default from config
      const targetLeagueId = leagueId || this.espnClient.leagueId;
      
      const draftData = await this.espnClient.makeRequest('?view=mDraftDetail&view=mTeam&view=mRoster');
      return draftData;
    } catch (error) {
      logger.error('Failed to get draft state:', error);
      throw error;
    }
  }

  async getNextPickAdvice(userId, userTeamId = 2) {
    try {
      const session = this.activeDrafts.get(userId);
      if (!session) {
        return {
          error: "No active draft session. Use `!coach draft connect` first!"
        };
      }

      // Get fresh draft data
      const currentDraftData = await this.getDraftState(session.leagueId);
      
      if (!currentDraftData?.draftDetail) {
        return {
          error: "Draft not active or accessible."
        };
      }

      // Update session
      session.draftData = currentDraftData;
      session.lastUpdate = new Date();

      // Analyze current draft state
      const analysis = await this.analyzeDraftSituation(currentDraftData, userTeamId);
      
      return analysis;

    } catch (error) {
      logger.error('Failed to get next pick advice:', error);
      return {
        error: "Failed to analyze draft. Try `!coach draft refresh` to reconnect."
      };
    }
  }

  async analyzeDraftSituation(draftData, userTeamId = 2) {
    try {
      // Extract key draft information
      const picks = draftData.draftDetail.picks || [];
      const teams = draftData.teams || [];
      const settings = draftData.settings || {};
      
      const userTeam = teams.find(team => team.id === userTeamId);
      const totalPicks = picks.length;
      const currentRound = Math.ceil((totalPicks + 1) / teams.length);
      
      // Determine if it's user's turn
      const nextPickOrder = (totalPicks % teams.length) + 1;
      const isUsersTurn = this.isUsersTurn(draftData.draftDetail, userTeamId);
      
      // Get user's current roster
      const userPicks = picks.filter(pick => pick.teamId === userTeamId);
      
      // Get available players (this is complex - ESPN doesn't always provide this)
      const availablePlayers = await this.getAvailableTopPlayers(picks);
      
      // Build context for AI analysis
      const draftContext = {
        currentPick: {
          overall: totalPicks + 1,
          round: currentRound,
          pickInRound: nextPickOrder
        },
        myTeam: {
          id: userTeamId,
          name: userTeam?.location + ' ' + userTeam?.nickname || 'Your Team',
          roster: this.formatUserRoster(userPicks)
        },
        availablePlayers: availablePlayers,
        recentPicks: picks.slice(-10), // Last 10 picks
        leagueSettings: {
          size: teams.length,
          scoringType: settings.scoringSettings?.scoringType || 'Standard',
          draftRounds: settings.draftSettings?.rounds || 16,
          rosterPositions: this.getRosterPositions(settings)
        },
        otherTeams: this.analyzeOtherTeamNeeds(teams, picks),
        picksUntilNext: this.calculatePicksUntilNext(totalPicks, teams.length, userTeamId),
        isYourTurn: isUsersTurn
      };

      // Get enhanced context from knowledge base
      const knowledgeResults = await this.knowledgeEnhancer.searchKnowledge("draft strategy ESPN 2025 projections");
      draftContext.knowledgeBase = knowledgeResults.slice(0, 3);

      // Generate AI recommendation
      const aiRecommendation = await this.claude.analyzeDraftSituation(draftContext);
      
      return {
        success: true,
        isYourTurn: isUsersTurn,
        draftPosition: draftContext.currentPick,
        myTeam: draftContext.myTeam,
        recommendations: aiRecommendation.recommendations || [],
        steals: aiRecommendation.steals || [],
        threats: aiRecommendation.threats || [],
        strategy: aiRecommendation.strategy || {},
        availableTopPlayers: availablePlayers.slice(0, 10)
      };

    } catch (error) {
      logger.error('Failed to analyze draft situation:', error);
      throw error;
    }
  }

  async getAvailableTopPlayers(picks) {
    // This is a simplified version - in a real implementation, you'd need
    // a comprehensive player database or ESPN's available players endpoint
    
    const draftedPlayers = new Set(picks.map(pick => 
      pick.playerPoolEntry?.player?.fullName || 'Unknown'
    ));

    // Get top 200 players from knowledge base / projections
    const topPlayers = await this.getTopPlayerProjections();
    
    return topPlayers.filter(player => !draftedPlayers.has(player.name));
  }

  async getTopPlayerProjections() {
    // Simplified top players list - in production, this would come from ESPN API or database
    return [
      { name: 'Christian McCaffrey', position: 'RB', team: 'SF', adp: 1.1, projectedPoints: 380 },
      { name: 'Justin Jefferson', position: 'WR', team: 'MIN', adp: 1.2, projectedPoints: 355 },
      { name: 'Tyreek Hill', position: 'WR', team: 'MIA', adp: 1.3, projectedPoints: 340 },
      { name: 'Cooper Kupp', position: 'WR', team: 'LAR', adp: 1.4, projectedPoints: 335 },
      { name: 'Travis Kelce', position: 'TE', team: 'KC', adp: 1.5, projectedPoints: 320 },
      { name: 'Davante Adams', position: 'WR', team: 'LV', adp: 1.6, projectedPoints: 315 },
      { name: 'Josh Allen', position: 'QB', team: 'BUF', adp: 2.1, projectedPoints: 380 },
      { name: 'Stefon Diggs', position: 'WR', team: 'HOU', adp: 2.2, projectedPoints: 310 },
      { name: 'Amon-Ra St. Brown', position: 'WR', team: 'DET', adp: 2.3, projectedPoints: 305 },
      { name: 'Bijan Robinson', position: 'RB', team: 'ATL', adp: 2.4, projectedPoints: 300 }
    ];
  }

  isUsersTurn(draftDetail, userTeamId) {
    // Check if it's currently the user's turn to pick
    const picks = draftDetail.picks || [];
    const totalPicks = picks.length;
    
    // Simple calculation - would need more sophisticated logic for snake drafts
    const nextTeamId = (totalPicks % draftDetail.draftOrder?.length) + 1;
    return nextTeamId === userTeamId;
  }

  formatUserRoster(userPicks) {
    return userPicks.map(pick => ({
      name: pick.playerPoolEntry?.player?.fullName || 'Unknown',
      position: this.getPositionName(pick.playerPoolEntry?.player?.defaultPositionId),
      round: pick.roundId,
      pick: pick.roundPickNumber
    }));
  }

  formatDraftInfo(draftData) {
    const settings = draftData.settings || {};
    const teams = draftData.teams || [];
    
    return {
      leagueName: settings.name || 'Unknown League',
      size: teams.length,
      rounds: settings.draftSettings?.rounds || 16,
      scoringType: settings.scoringSettings?.scoringType || 'Standard',
      draftType: settings.draftSettings?.type || 'Snake'
    };
  }

  getPositionName(positionId) {
    const positions = {
      1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST'
    };
    return positions[positionId] || 'FLEX';
  }

  getRosterPositions(settings) {
    // Default roster positions - would come from league settings
    return {
      QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1
    };
  }

  analyzeOtherTeamNeeds(teams, picks) {
    return teams.map(team => {
      const teamPicks = picks.filter(pick => pick.teamId === team.id);
      const positions = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
      
      teamPicks.forEach(pick => {
        const pos = this.getPositionName(pick.playerPoolEntry?.player?.defaultPositionId);
        if (positions.hasOwnProperty(pos)) {
          positions[pos]++;
        }
      });

      const needs = [];
      if (positions.QB === 0) needs.push('QB');
      if (positions.RB < 2) needs.push('RB');
      if (positions.WR < 2) needs.push('WR');
      if (positions.TE === 0) needs.push('TE');

      return {
        id: team.id,
        name: `${team.location || ''} ${team.nickname || 'Team ' + team.id}`.trim(),
        needs: needs.join(', ') || 'Depth'
      };
    });
  }

  calculatePicksUntilNext(totalPicks, teamCount, userTeamId) {
    // Simplified - assumes snake draft
    const currentRound = Math.ceil((totalPicks + 1) / teamCount);
    const currentPosition = (totalPicks % teamCount) + 1;
    
    if (currentPosition === userTeamId) {
      return 0; // It's your turn
    }
    
    // Calculate picks until your next turn (simplified)
    return teamCount - Math.abs(currentPosition - userTeamId);
  }

  stopDraftSession(userId) {
    this.activeDrafts.delete(userId);
    return "✅ Draft session ended. Thanks for using Fantasy AI Coach!";
  }
}

module.exports = LiveDraftAnalyzer;