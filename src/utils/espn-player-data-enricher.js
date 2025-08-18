const axios = require('axios');
const fs = require('fs');
const path = require('path');

class ESPNPlayerDataEnricher {
  constructor() {
    this.espnFantasyBase = 'https://fantasy.espn.com/apis/v3/games/ffl/seasons/2025';
    this.espnProjectionsBase = 'https://fantasy.espn.com/football/players/projections';
    this.enrichedPlayers = new Map();
    
    this.scoringPeriods = [0, 1, 2, 3, 4, 5]; // Different weeks/periods
    this.viewTypes = [
      'kona_player_info',
      'players_wl', 
      'mDraftDetail',
      'mRoster',
      'mTeam'
    ];
  }

  async enrichAllPlayers() {
    console.log('📊 Enriching players with ESPN data (stats, projections, ADP, news)...');
    
    try {
      // Load existing player names
      const playersPath = path.join(__dirname, '../../data/nfl-players-complete.json');
      const existingPlayers = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
      console.log(`📋 Found ${existingPlayers.length} existing players to enrich`);

      // Method 1: ESPN Fantasy API with detailed views
      await this.fetchESPNPlayerDetails();
      
      // Method 2: ESPN Projections data
      await this.fetchESPNProjections();
      
      // Method 3: ESPN ADP and Rankings
      await this.fetchESPNRankings();
      
      // Method 4: ESPN News and Updates
      await this.fetchESPNNews();
      
      // Merge with existing players
      const enrichedPlayerList = this.mergeWithExisting(existingPlayers);
      
      // Save enriched database
      await this.saveEnrichedDatabase(enrichedPlayerList);
      
      console.log(`✅ Player enrichment complete! ${enrichedPlayerList.length} players with ESPN data`);
      return enrichedPlayerList;
      
    } catch (error) {
      console.error('❌ Error enriching players:', error);
      throw error;
    }
  }

  async fetchESPNPlayerDetails() {
    console.log('🔍 Fetching detailed ESPN player information...');
    
    for (const view of this.viewTypes) {
      for (const period of this.scoringPeriods) {
        try {
          const url = `${this.espnFantasyBase}/players?scoringPeriodId=${period}&view=${view}`;
          console.log(`📡 Fetching: ${view} for period ${period}`);
          
          const response = await axios.get(url, {
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; ESPNScraper/1.0)',
              'Accept': 'application/json'
            }
          });

          if (response.data && response.data.players) {
            response.data.players.forEach(playerData => {
              const enrichedPlayer = this.parseESPNPlayerData(playerData);
              if (enrichedPlayer) {
                const key = enrichedPlayer.name.toLowerCase();
                
                // Merge with existing data
                if (this.enrichedPlayers.has(key)) {
                  this.enrichedPlayers.set(key, {
                    ...this.enrichedPlayers.get(key),
                    ...enrichedPlayer
                  });
                } else {
                  this.enrichedPlayers.set(key, enrichedPlayer);
                }
              }
            });
            
            console.log(`✅ Processed ${response.data.players.length} players from ${view}-${period}`);
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
          
        } catch (error) {
          console.log(`⚠️ Failed to fetch ${view}-${period}, continuing...`);
        }
      }
    }
  }

  parseESPNPlayerData(playerData) {
    try {
      const player = playerData.player;
      if (!player || !player.fullName) return null;

      const enrichedData = {
        name: player.fullName.trim(),
        espnId: player.id,
        
        // Basic info
        position: this.getPositionName(player.defaultPositionId),
        proTeam: this.getTeamName(player.proTeamId),
        
        // ESPN specific data
        eligibleSlots: player.eligibleSlots || [],
        ownership: player.ownership || {},
        
        // Stats and projections
        stats: {},
        projections: {},
        
        // Rankings and ADP
        rankings: {},
        adp: null,
        
        // News and injury
        injuryStatus: player.injuryStatus || 'ACTIVE',
        news: []
      };

      // Extract stats if available
      if (player.stats) {
        player.stats.forEach(statPeriod => {
          const period = statPeriod.scoringPeriodId || 'season';
          enrichedData.stats[period] = {
            appliedStats: statPeriod.appliedStats || {},
            stats: statPeriod.stats || {},
            projectedStats: statPeriod.projectedStats || {}
          };
        });
      }

      // Extract ownership data
      if (playerData.ownership) {
        enrichedData.ownership = {
          percentOwned: playerData.ownership.percentOwned || 0,
          percentStarted: playerData.ownership.percentStarted || 0,
          percentChange: playerData.ownership.percentChange || 0
        };
      }

      // Extract player ratings
      if (player.ratings) {
        enrichedData.ratings = player.ratings;
      }

      // Extract draft rankings
      if (player.draftRanksByRankType) {
        enrichedData.draftRankings = player.draftRanksByRankType;
      }

      // Extract season outlook
      if (player.seasonOutlook) {
        enrichedData.seasonOutlook = player.seasonOutlook;
      }

      return enrichedData;

    } catch (error) {
      return null;
    }
  }

  async fetchESPNProjections() {
    console.log('📈 Fetching ESPN player projections...');
    
    try {
      // Try different projection endpoints
      const projectionEndpoints = [
        '/players?view=kona_player_info&scoringPeriodId=0',
        '/players?view=players_wl&scoringPeriodId=0',
        '/leagueHistory/0?seasonId=2025&view=mDraftDetail'
      ];

      for (const endpoint of projectionEndpoints) {
        try {
          const url = `${this.espnFantasyBase}${endpoint}`;
          const response = await axios.get(url, { timeout: 15000 });
          
          if (response.data) {
            // Process projection data
            this.processProjectionData(response.data);
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.log(`⚠️ Projection endpoint failed: ${endpoint}`);
        }
      }
    } catch (error) {
      console.log('⚠️ ESPN projections fetch failed, continuing...');
    }
  }

  processProjectionData(data) {
    if (data.players) {
      data.players.forEach(playerData => {
        if (playerData.player && playerData.player.fullName) {
          const key = playerData.player.fullName.toLowerCase();
          
          if (this.enrichedPlayers.has(key)) {
            const existing = this.enrichedPlayers.get(key);
            
            // Add projection-specific data
            if (playerData.player.stats) {
              existing.weeklyProjections = playerData.player.stats;
            }
            
            if (playerData.ratings) {
              existing.fantasyRatings = playerData.ratings;
            }
          }
        }
      });
    }
  }

  async fetchESPNRankings() {
    console.log('🏆 Fetching ESPN rankings and ADP data...');
    
    try {
      // Rankings endpoint
      const rankingsUrl = `${this.espnFantasyBase}/segments/0/leagues/0?view=kona_player_info`;
      const response = await axios.get(rankingsUrl, { timeout: 15000 });
      
      if (response.data && response.data.players) {
        response.data.players.forEach(playerData => {
          if (playerData.player && playerData.player.fullName) {
            const key = playerData.player.fullName.toLowerCase();
            
            if (this.enrichedPlayers.has(key)) {
              const existing = this.enrichedPlayers.get(key);
              
              // Add ranking data
              if (playerData.player.draftRanksByRankType) {
                existing.rankings = playerData.player.draftRanksByRankType;
              }
              
              // Add ADP if available
              if (playerData.player.averageDraftPosition) {
                existing.adp = playerData.player.averageDraftPosition;
              }
            }
          }
        });
      }
    } catch (error) {
      console.log('⚠️ ESPN rankings fetch failed, continuing...');
    }
  }

  async fetchESPNNews() {
    console.log('📰 Fetching ESPN player news and updates...');
    
    try {
      // News endpoint
      const newsUrl = `${this.espnFantasyBase}/players/news`;
      const response = await axios.get(newsUrl, { timeout: 15000 });
      
      if (response.data && response.data.players) {
        response.data.players.forEach(playerData => {
          if (playerData.player && playerData.player.fullName) {
            const key = playerData.player.fullName.toLowerCase();
            
            if (this.enrichedPlayers.has(key)) {
              const existing = this.enrichedPlayers.get(key);
              
              // Add news data
              if (playerData.news) {
                existing.news = playerData.news;
              }
              
              // Add injury updates
              if (playerData.player.injuryStatus) {
                existing.injuryStatus = playerData.player.injuryStatus;
              }
            }
          }
        });
      }
    } catch (error) {
      console.log('⚠️ ESPN news fetch failed, continuing...');
    }
  }

  mergeWithExisting(existingPlayers) {
    console.log('🔄 Merging ESPN data with existing player database...');
    
    const mergedPlayers = existingPlayers.map(player => {
      const key = player.name.toLowerCase();
      const espnData = this.enrichedPlayers.get(key);
      
      if (espnData) {
        return {
          ...player,
          ...espnData,
          // Preserve original source info
          originalSource: player.source,
          enrichedWithESPN: true,
          lastUpdated: new Date().toISOString()
        };
      } else {
        return {
          ...player,
          enrichedWithESPN: false
        };
      }
    });

    const enrichedCount = mergedPlayers.filter(p => p.enrichedWithESPN).length;
    console.log(`✅ Enriched ${enrichedCount} players with ESPN data`);
    
    return mergedPlayers;
  }

  async saveEnrichedDatabase(players) {
    const outputPath = path.join(__dirname, '../../data/nfl-players-enriched.json');
    fs.writeFileSync(outputPath, JSON.stringify(players, null, 2));
    console.log(`💾 Saved enriched database to ${outputPath}`);
    
    // Also save a summary for quick reference
    const summary = players.map(p => ({
      name: p.name,
      position: p.position,
      team: p.team || p.proTeam,
      espnId: p.espnId,
      adp: p.adp,
      injuryStatus: p.injuryStatus,
      enriched: p.enrichedWithESPN
    }));
    
    const summaryPath = path.join(__dirname, '../../data/players-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`📋 Saved player summary to ${summaryPath}`);
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

  static async enrichDatabase() {
    const enricher = new ESPNPlayerDataEnricher();
    return await enricher.enrichAllPlayers();
  }
}

module.exports = ESPNPlayerDataEnricher;

// If run directly, enrich the database
if (require.main === module) {
  ESPNPlayerDataEnricher.enrichDatabase()
    .then(players => console.log(`🎉 Player enrichment complete! ${players.length} players with ESPN data`))
    .catch(error => console.error('❌ Enrichment failed:', error));
}