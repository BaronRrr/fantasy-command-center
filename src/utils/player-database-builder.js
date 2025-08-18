const axios = require('axios');
const fs = require('fs');
const path = require('path');

class PlayerDatabaseBuilder {
  constructor() {
    this.espnBaseURL = 'http://site.api.espn.com/apis/site/v2/sports/football/nfl';
    this.fantasyBaseURL = 'https://fantasy.espn.com/apis/v3/games/ffl/seasons/2025';
    this.players = new Map();
    
    this.positionMap = {
      1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST'
    };
    
    this.teamMap = {
      1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET',
      9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN',
      17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC',
      25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WSH', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU'
    };
  }

  async buildCompleteDatabase() {
    console.log('🏈 Building comprehensive NFL player database...');
    
    try {
      // Method 1: Get fantasy relevant players from ESPN Fantasy API
      await this.fetchFantasyPlayers();
      
      // Method 2: Get all NFL team rosters
      await this.fetchNFLRosters();
      
      // Method 3: Add some manual top players to ensure coverage
      this.addTopFantasyPlayers();
      
      // Save to file
      await this.saveDatabase();
      
      console.log(`✅ Database built with ${this.players.size} players`);
      return Array.from(this.players.values());
      
    } catch (error) {
      console.error('❌ Error building player database:', error);
      throw error;
    }
  }

  async fetchFantasyPlayers() {
    console.log('📊 Fetching fantasy relevant players...');
    
    try {
      // ESPN Fantasy Football player universe (top ~400 fantasy relevant players)
      const url = `${this.fantasyBaseURL}/players?scoringPeriodId=0`;
      const response = await axios.get(url, { timeout: 10000 });
      
      if (response.data && response.data.players) {
        response.data.players.forEach(playerData => {
          const player = this.parseESPNPlayer(playerData);
          if (player) {
            this.players.set(player.name.toLowerCase(), player);
          }
        });
        
        console.log(`✅ Added ${response.data.players.length} fantasy players`);
      }
    } catch (error) {
      console.log('⚠️ Fantasy API failed, continuing with other sources...');
    }
  }

  async fetchNFLRosters() {
    console.log('🏟️ Fetching NFL team rosters...');
    
    try {
      // Get all 32 NFL teams
      const teamsUrl = `${this.espnBaseURL}/teams`;
      const teamsResponse = await axios.get(teamsUrl, { timeout: 10000 });
      
      if (teamsResponse.data && teamsResponse.data.sports && teamsResponse.data.sports[0].leagues) {
        const teams = teamsResponse.data.sports[0].leagues[0].teams;
        
        for (const teamData of teams) {
          await this.fetchTeamRoster(teamData.team);
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    } catch (error) {
      console.log('⚠️ NFL rosters API failed, continuing...');
    }
  }

  async fetchTeamRoster(team) {
    try {
      const rosterUrl = `${this.espnBaseURL}/teams/${team.id}/roster`;
      const response = await axios.get(rosterUrl, { timeout: 5000 });
      
      if (response.data && response.data.athletes) {
        response.data.athletes.forEach(athleteData => {
          const player = this.parseNFLPlayer(athleteData, team.abbreviation);
          if (player) {
            this.players.set(player.name.toLowerCase(), player);
          }
        });
      }
    } catch (error) {
      // Individual team failures are expected, continue
    }
  }

  parseESPNPlayer(playerData) {
    try {
      const player = playerData.player;
      if (!player || !player.fullName) return null;
      
      return {
        name: player.fullName,
        position: this.positionMap[player.defaultPositionId] || 'FLEX',
        team: this.teamMap[player.proTeamId] || 'FA',
        source: 'espn-fantasy',
        id: player.id
      };
    } catch (error) {
      return null;
    }
  }

  parseNFLPlayer(athleteData, teamAbbr) {
    try {
      const athlete = athleteData.athlete || athleteData;
      if (!athlete || !athlete.displayName) return null;
      
      // Get position from athlete data
      let position = 'FLEX';
      if (athlete.position && athlete.position.abbreviation) {
        position = athlete.position.abbreviation;
      }
      
      return {
        name: athlete.displayName,
        position: position,
        team: teamAbbr,
        source: 'nfl-roster',
        id: athlete.id
      };
    } catch (error) {
      return null;
    }
  }

  addTopFantasyPlayers() {
    // Ensure we have the most important fantasy players
    const topPlayers = [
      { name: 'Christian McCaffrey', position: 'RB', team: 'SF' },
      { name: 'Justin Jefferson', position: 'WR', team: 'MIN' },
      { name: 'Tyreek Hill', position: 'WR', team: 'MIA' },
      { name: 'Cooper Kupp', position: 'WR', team: 'LAR' },
      { name: 'Travis Kelce', position: 'TE', team: 'KC' },
      { name: 'Davante Adams', position: 'WR', team: 'LV' },
      { name: 'Josh Allen', position: 'QB', team: 'BUF' },
      { name: 'Stefon Diggs', position: 'WR', team: 'HOU' },
      { name: 'Amon-Ra St. Brown', position: 'WR', team: 'DET' },
      { name: 'Bijan Robinson', position: 'RB', team: 'ATL' },
      { name: 'CeeDee Lamb', position: 'WR', team: 'DAL' },
      { name: 'Puka Nacua', position: 'WR', team: 'LAR' },
      { name: 'A.J. Brown', position: 'WR', team: 'PHI' },
      { name: 'Jaylen Waddle', position: 'WR', team: 'MIA' },
      { name: 'Lamar Jackson', position: 'QB', team: 'BAL' },
      { name: 'Patrick Mahomes', position: 'QB', team: 'KC' },
      { name: 'Joe Burrow', position: 'QB', team: 'CIN' },
      { name: 'Brock Purdy', position: 'QB', team: 'SF' },
      { name: 'David Montgomery', position: 'RB', team: 'DET' },
      { name: 'Rhamondre Stevenson', position: 'RB', team: 'NE' }
    ];

    topPlayers.forEach(player => {
      this.players.set(player.name.toLowerCase(), {
        ...player,
        source: 'manual-top'
      });
    });

    console.log(`✅ Added ${topPlayers.length} guaranteed top players`);
  }

  async saveDatabase() {
    const playersArray = Array.from(this.players.values());
    const outputPath = path.join(__dirname, '../../data/nfl-players-complete.json');
    
    // Sort by name for easier browsing
    playersArray.sort((a, b) => a.name.localeCompare(b.name));
    
    fs.writeFileSync(outputPath, JSON.stringify(playersArray, null, 2));
    console.log(`💾 Saved ${playersArray.length} players to ${outputPath}`);
  }

  // Helper method to update database
  static async updateDatabase() {
    const builder = new PlayerDatabaseBuilder();
    return await builder.buildCompleteDatabase();
  }
}

module.exports = PlayerDatabaseBuilder;

// If run directly, build the database
if (require.main === module) {
  PlayerDatabaseBuilder.updateDatabase()
    .then(() => console.log('🎉 Player database update complete!'))
    .catch(error => console.error('❌ Database update failed:', error));
}