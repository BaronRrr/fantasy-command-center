const axios = require('axios');
const fs = require('fs');
const path = require('path');

class CurrentPlayerFetcher {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.outputFile = path.join(this.dataDir, 'current-players-2025.json');
  }

  async fetchCurrentRosterData() {
    try {
      console.log('🔄 Fetching current 2025 NFL roster data...');
      
      // Try multiple sources for current player data
      const playerData = await this.fetchFromMultipleSources();
      
      // Calculate ages based on current date
      const enrichedData = this.calculateCurrentAges(playerData);
      
      // Save to file
      await this.savePlayerData(enrichedData);
      
      console.log(`✅ Updated player database saved to ${this.outputFile}`);
      console.log(`📊 Total players: ${enrichedData.length}`);
      
      return enrichedData;
      
    } catch (error) {
      console.error('❌ Failed to fetch current player data:', error.message);
      throw error;
    }
  }

  async fetchFromMultipleSources() {
    const players = [];
    
    // Source 1: Try ESPN API for current rosters
    try {
      console.log('📡 Attempting ESPN API...');
      const espnPlayers = await this.fetchESPNPlayers();
      players.push(...espnPlayers);
      console.log(`✅ ESPN: ${espnPlayers.length} players`);
    } catch (error) {
      console.log(`⚠️ ESPN API failed: ${error.message}`);
    }

    // Source 2: NFL.com API (if available)
    try {
      console.log('📡 Attempting NFL.com data...');
      const nflPlayers = await this.fetchNFLPlayers();
      players.push(...nflPlayers);
      console.log(`✅ NFL.com: ${nflPlayers.length} players`);
    } catch (error) {
      console.log(`⚠️ NFL.com failed: ${error.message}`);
    }

    // Source 3: Fallback to manual key player updates
    if (players.length === 0) {
      console.log('📝 Using manual key player updates...');
      players.push(...this.getKeyPlayerUpdates());
    }

    return this.deduplicatePlayers(players);
  }

  async fetchESPNPlayers() {
    // ESPN Fantasy API endpoint for 2025 season
    const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams';
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Fantasy-Command-Center/1.0.0'
      }
    });

    const players = [];
    
    if (response.data && response.data.sports && response.data.sports[0].leagues) {
      const teams = response.data.sports[0].leagues[0].teams;
      
      for (const teamData of teams) {
        const team = teamData.team;
        
        // For each team, we'd need to fetch individual roster
        // This is a simplified version - in practice you'd need team-specific endpoints
        console.log(`Processing ${team.displayName}...`);
      }
    }

    return players;
  }

  async fetchNFLPlayers() {
    // Placeholder for NFL.com API
    // Would need actual NFL API endpoints
    return [];
  }

  getKeyPlayerUpdates() {
    // Manual updates for key fantasy players with correct 2025 info
    return [
      {
        name: 'Christian McCaffrey',
        team: 'SF',
        position: 'RB',
        birthDate: '1996-06-07', // Correct birth date
        age: this.calculateAge('1996-06-07'),
        status: 'Active'
      },
      {
        name: 'Josh Allen',
        team: 'BUF',
        position: 'QB',
        birthDate: '1996-05-21',
        age: this.calculateAge('1996-05-21'),
        status: 'Active'
      },
      {
        name: 'Justin Jefferson',
        team: 'MIN',
        position: 'WR',
        birthDate: '1999-06-16',
        age: this.calculateAge('1999-06-16'),
        status: 'Active'
      },
      {
        name: 'Tyreek Hill',
        team: 'MIA',
        position: 'WR',
        birthDate: '1994-03-01',
        age: this.calculateAge('1994-03-01'),
        status: 'Active'
      },
      {
        name: 'Stefon Diggs',
        team: 'HOU', // Updated team
        position: 'WR',
        birthDate: '1993-11-29',
        age: this.calculateAge('1993-11-29'),
        status: 'Active'
      },
      {
        name: 'Saquon Barkley',
        team: 'PHI', // Updated team
        position: 'RB',
        birthDate: '1997-02-09',
        age: this.calculateAge('1997-02-09'),
        status: 'Active'
      },
      {
        name: 'Derrick Henry',
        team: 'BAL', // Updated team
        position: 'RB',
        birthDate: '1994-01-04',
        age: this.calculateAge('1994-01-04'),
        status: 'Active'
      },
      {
        name: 'Travis Kelce',
        team: 'KC',
        position: 'TE',
        birthDate: '1989-10-05',
        age: this.calculateAge('1989-10-05'),
        status: 'Active'
      },
      {
        name: 'Davante Adams',
        team: 'NYJ', // Updated team
        position: 'WR',
        birthDate: '1992-12-24',
        age: this.calculateAge('1992-12-24'),
        status: 'Active'
      },
      // Add more key players as needed
    ];
  }

  calculateAge(birthDate) {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  calculateCurrentAges(players) {
    return players.map(player => {
      if (player.birthDate) {
        player.age = this.calculateAge(player.birthDate);
      }
      return player;
    });
  }

  deduplicatePlayers(players) {
    const seen = new Set();
    return players.filter(player => {
      const key = `${player.name}-${player.team}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async savePlayerData(players) {
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    const data = {
      lastUpdated: new Date().toISOString(),
      players: players,
      source: 'mixed-api-manual',
      count: players.length
    };

    fs.writeFileSync(this.outputFile, JSON.stringify(data, null, 2));
  }
}

// Run if called directly
if (require.main === module) {
  const fetcher = new CurrentPlayerFetcher();
  fetcher.fetchCurrentRosterData()
    .then(() => console.log('✅ Player data update complete'))
    .catch(error => console.error('❌ Update failed:', error));
}

module.exports = CurrentPlayerFetcher;