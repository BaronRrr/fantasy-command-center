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

class ESPNClient {
  constructor() {
    this.leagueId = config.espn.leagueId;
    this.seasonId = config.espn.seasonId;
    this.s2Cookie = config.espn.s2Cookie;
    this.swidCookie = config.espn.swidCookie;
    this.baseURL = `${config.espn.baseURL}/${this.seasonId}/segments/0/leagues/${this.leagueId}`;
    this.endpoints = config.espn.endpoints;
    
    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Fantasy-Command-Center/1.0.0'
      }
    });

    if (this.s2Cookie && this.swidCookie) {
      this.axiosInstance.defaults.headers.Cookie = `espn_s2=${this.s2Cookie}; SWID=${this.swidCookie}`;
    }
  }

  async makeRequest(endpoint, params = {}) {
    try {
      const url = `${this.baseURL}${endpoint}`;
      logger.debug(`Making ESPN API request to: ${url}`);
      
      const response = await this.axiosInstance.get(url, { params });
      
      if (response.status === 200) {
        logger.debug('ESPN API request successful');
        return response.data;
      } else {
        throw new Error(`ESPN API returned status ${response.status}`);
      }
    } catch (error) {
      logger.error('ESPN API request failed:', error.message);
      if (error.response) {
        logger.error('Response status:', error.response.status);
        logger.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  async getLeagueInfo() {
    try {
      const data = await this.makeRequest(this.endpoints.settings);
      return {
        id: data.id,
        name: data.settings?.name || 'Unknown League',
        size: data.settings?.size || 12,
        scoringType: this.getScoringType(data.settings?.scoringSettings),
        draftSettings: data.settings?.draftSettings,
        rosterSettings: data.settings?.rosterSettings,
        tradeSettings: data.settings?.tradeSettings,
        currentMatchupPeriod: data.scoringPeriodId,
        status: data.status
      };
    } catch (error) {
      logger.error('Failed to get league info:', error.message);
      throw error;
    }
  }

  async getDraftInfo() {
    try {
      const data = await this.makeRequest(this.endpoints.draft);
      
      if (!data.draftDetail) {
        throw new Error('No draft information available - draft may not be scheduled yet');
      }

      return {
        drafted: data.draftDetail.drafted || false,
        inProgress: data.draftDetail.inProgress || false,
        picks: data.draftDetail.picks || [],
        currentPick: this.getCurrentPick(data.draftDetail.picks),
        draftOrder: this.getDraftOrder(data.teams, data.draftDetail),
        totalPicks: (data.settings?.size || 12) * (data.settings?.draftSettings?.rounds || 16)
      };
    } catch (error) {
      logger.error('Failed to get draft info:', error.message);
      throw error;
    }
  }

  async getRosters() {
    try {
      const data = await this.makeRequest(this.endpoints.rosters);
      
      return data.teams?.map(team => ({
        id: team.id,
        name: team.location + ' ' + team.nickname,
        owner: team.owners?.[0] || 'Unknown',
        roster: this.parseRoster(team.roster),
        stats: team.record
      })) || [];
    } catch (error) {
      logger.error('Failed to get rosters:', error.message);
      throw error;
    }
  }

  async getPlayers(count = 500) {
    try {
      const params = {
        scoringPeriodId: 0,
        view: 'kona_player_info'
      };
      
      const data = await this.makeRequest('', params);
      
      return data.players?.map(playerData => ({
        id: playerData.player.id,
        name: playerData.player.fullName,
        position: this.getPositionName(playerData.player.defaultPositionId),
        team: this.getTeamAbbr(playerData.player.proTeamId),
        injuryStatus: playerData.player.injuryStatus,
        projections: playerData.player.stats?.find(stat => stat.statSourceId === 1),
        ownership: {
          percentOwned: playerData.player.ownership?.percentOwned || 0,
          percentStarted: playerData.player.ownership?.percentStarted || 0
        },
        eligibleSlots: playerData.player.eligibleSlots?.map(slot => this.getSlotName(slot))
      })) || [];
    } catch (error) {
      logger.error('Failed to get players:', error.message);
      throw error;
    }
  }

  async getMatchups(week = null) {
    try {
      const params = week ? { scoringPeriodId: week } : {};
      const data = await this.makeRequest(this.endpoints.matchups, params);
      
      return data.schedule?.map(matchup => ({
        id: matchup.id,
        week: matchup.matchupPeriodId,
        home: {
          teamId: matchup.home?.teamId,
          score: matchup.home?.totalPoints,
          lineup: this.parseLineup(matchup.home?.rosterForCurrentScoringPeriod)
        },
        away: {
          teamId: matchup.away?.teamId,
          score: matchup.away?.totalPoints,
          lineup: this.parseLineup(matchup.away?.rosterForCurrentScoringPeriod)
        },
        winner: matchup.winner
      })) || [];
    } catch (error) {
      logger.error('Failed to get matchups:', error.message);
      throw error;
    }
  }

  async getTransactions(count = 50) {
    try {
      const data = await this.makeRequest(this.endpoints.transactions);
      
      return data.transactions?.slice(0, count).map(transaction => ({
        id: transaction.id,
        type: this.getTransactionType(transaction.type),
        date: new Date(transaction.processDate),
        team: transaction.memberId,
        players: transaction.items?.map(item => ({
          playerId: item.playerId,
          type: item.type === 'ADD' ? 'added' : 'dropped',
          fromTeam: item.fromTeamId,
          toTeam: item.toTeamId
        }))
      })) || [];
    } catch (error) {
      logger.error('Failed to get transactions:', error.message);
      throw error;
    }
  }

  getCurrentPick(picks) {
    if (!picks || picks.length === 0) return null;
    
    const sortedPicks = picks.sort((a, b) => a.overallPickNumber - b.overallPickNumber);
    const lastPick = sortedPicks[sortedPicks.length - 1];
    
    return {
      overall: lastPick.overallPickNumber + 1,
      round: Math.ceil((lastPick.overallPickNumber + 1) / (config.league.size || 12)),
      pickInRound: ((lastPick.overallPickNumber) % (config.league.size || 12)) + 1
    };
  }

  getDraftOrder(teams, draftDetail) {
    if (!teams || !draftDetail?.draftOrder) return [];
    
    return draftDetail.draftOrder.map((teamId, index) => {
      const team = teams.find(t => t.id === teamId);
      return {
        pickPosition: index + 1,
        teamId: teamId,
        teamName: team ? `${team.location} ${team.nickname}` : `Team ${teamId}`,
        owner: team?.owners?.[0] || 'Unknown'
      };
    });
  }

  parseRoster(roster) {
    if (!roster?.entries) return [];
    
    return roster.entries.map(entry => ({
      playerId: entry.playerId,
      slot: this.getSlotName(entry.lineupSlotId),
      player: entry.playerPoolEntry?.player ? {
        name: entry.playerPoolEntry.player.fullName,
        position: this.getPositionName(entry.playerPoolEntry.player.defaultPositionId),
        team: this.getTeamAbbr(entry.playerPoolEntry.player.proTeamId)
      } : null
    }));
  }

  parseLineup(lineup) {
    if (!lineup?.entries) return [];
    return this.parseRoster({ entries: lineup.entries });
  }

  getScoringType(scoringSettings) {
    if (!scoringSettings) return 'Standard';
    
    const receptionPoints = scoringSettings.find(setting => setting.statId === 53)?.points || 0;
    
    if (receptionPoints === 1) return 'PPR';
    if (receptionPoints === 0.5) return 'Half-PPR';
    return 'Standard';
  }

  getPositionName(positionId) {
    const positions = {
      1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DST'
    };
    return positions[positionId] || 'UNKNOWN';
  }

  getSlotName(slotId) {
    const slots = {
      0: 'QB', 2: 'RB', 4: 'WR', 6: 'TE', 17: 'K', 16: 'DST',
      20: 'BENCH', 21: 'IR', 23: 'FLEX'
    };
    return slots[slotId] || 'UNKNOWN';
  }

  getTeamAbbr(teamId) {
    const teams = {
      1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET',
      9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN',
      17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC',
      25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WSH', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU'
    };
    return teams[teamId] || 'FA';
  }

  getTransactionType(typeId) {
    const types = {
      178: 'WAIVER_ADD',
      179: 'WAIVER_DROP', 
      180: 'TRADE',
      181: 'FREE_AGENT_ADD',
      182: 'FREE_AGENT_DROP'
    };
    return types[typeId] || 'UNKNOWN';
  }

  async healthCheck() {
    try {
      await this.getLeagueInfo();
      return { status: 'connected', timestamp: new Date().toISOString() };
    } catch (error) {
      return { 
        status: 'error', 
        error: error.message, 
        timestamp: new Date().toISOString() 
      };
    }
  }
}

module.exports = ESPNClient;