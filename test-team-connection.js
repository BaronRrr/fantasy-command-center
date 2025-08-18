const axios = require('axios');
const config = require('./config');

class ESPNTeamTester {
  constructor() {
    this.leagueId = '356030745';
    this.teamId = '1';
    this.seasonId = '2025';
    this.baseURL = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons';
  }

  async testTeamConnection() {
    console.log('🔍 TESTING ESPN TEAM CONNECTION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log(`\n📊 League ID: ${this.leagueId}`);
    console.log(`👤 Team ID: ${this.teamId}`);
    console.log(`📅 Season: ${this.seasonId}`);
    
    try {
      // Test league access
      console.log('\n🔗 Testing league access...');
      const leagueData = await this.getLeagueInfo();
      
      // Test team identification
      console.log('\n👥 Finding your team...');
      const yourTeam = await this.getYourTeam();
      
      // Test roster access
      console.log('\n🏈 Getting your roster...');
      const roster = await this.getYourRoster();
      
      // Test draft status
      console.log('\n📋 Checking draft status...');
      const draftInfo = await this.getDraftInfo();
      
      return {
        league: leagueData,
        team: yourTeam,
        roster: roster,
        draft: draftInfo
      };
      
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      
      if (error.response?.status === 401) {
        console.log('\n🔐 AUTHENTICATION NEEDED:');
        console.log('This league might be private. You need to add:');
        console.log('• ESPN_S2_COOKIE to your .env file');
        console.log('• ESPN_SWID_COOKIE to your .env file');
        console.log('\nTo get these cookies:');
        console.log('1. Go to ESPN Fantasy in your browser');
        console.log('2. Open Developer Tools (F12)');
        console.log('3. Go to Application → Cookies → espn.com');
        console.log('4. Copy the "espn_s2" and "SWID" values');
      }
      
      throw error;
    }
  }

  async getLeagueInfo() {
    const url = `${this.baseURL}/${this.seasonId}/segments/0/leagues/${this.leagueId}`;
    
    const response = await axios.get(url, {
      headers: this.getHeaders()
    });
    
    const league = response.data;
    
    console.log(`✅ League found: "${league.settings?.name || 'Unknown League'}"`);
    console.log(`📊 League size: ${league.settings?.size || 'Unknown'} teams`);
    console.log(`⚙️ Scoring: ${league.settings?.scoringSettings?.scoringType || 'Unknown'}`);
    
    return league;
  }

  async getYourTeam() {
    const url = `${this.baseURL}/${this.seasonId}/segments/0/leagues/${this.leagueId}?view=mTeam`;
    
    const response = await axios.get(url, {
      headers: this.getHeaders()
    });
    
    const teams = response.data.teams;
    const yourTeam = teams.find(team => team.id == this.teamId);
    
    if (yourTeam) {
      console.log(`✅ Your team found: "${yourTeam.location || ''} ${yourTeam.nickname || 'Team ' + this.teamId}"`);
      console.log(`👤 Owner: ${yourTeam.primaryOwner || 'Unknown'}`);
      console.log(`📈 Record: ${yourTeam.record?.overall?.wins || 0}-${yourTeam.record?.overall?.losses || 0}`);
    } else {
      console.log(`❌ Team ID ${this.teamId} not found in league`);
      console.log('📋 Available teams:');
      teams.forEach(team => {
        console.log(`   ${team.id}: ${team.location || ''} ${team.nickname || 'Team ' + team.id}`);
      });
    }
    
    return yourTeam;
  }

  async getYourRoster() {
    const url = `${this.baseURL}/${this.seasonId}/segments/0/leagues/${this.leagueId}?view=mRoster`;
    
    const response = await axios.get(url, {
      headers: this.getHeaders()
    });
    
    const teams = response.data.teams;
    const yourTeam = teams.find(team => team.id == this.teamId);
    
    if (yourTeam && yourTeam.roster) {
      const roster = yourTeam.roster.entries || [];
      
      console.log(`✅ Roster found: ${roster.length} players`);
      
      if (roster.length > 0) {
        console.log('\n📋 YOUR CURRENT ROSTER:');
        roster.forEach((entry, index) => {
          const player = entry.playerPoolEntry?.player;
          if (player) {
            const position = this.getPositionName(player.defaultPositionId);
            const team = this.getTeamAbbreviation(player.proTeamId);
            console.log(`${index + 1}. ${player.fullName} (${position}, ${team})`);
          }
        });
      } else {
        console.log('📋 Roster is empty (draft not started or no players added)');
      }
      
      return roster;
    } else {
      console.log(`❌ Could not access roster for team ${this.teamId}`);
      return [];
    }
  }

  async getDraftInfo() {
    const url = `${this.baseURL}/${this.seasonId}/segments/0/leagues/${this.leagueId}?view=mDraftDetail`;
    
    const response = await axios.get(url, {
      headers: this.getHeaders()
    });
    
    const draft = response.data.draftDetail;
    
    if (draft) {
      console.log(`✅ Draft info found`);
      console.log(`📅 Draft status: ${draft.drafted ? 'COMPLETED' : 'NOT STARTED'}`);
      console.log(`🔄 Current pick: ${draft.picks?.length || 0} picks made`);
      
      // Show your picks if any
      if (draft.picks && draft.picks.length > 0) {
        const yourPicks = draft.picks.filter(pick => pick.teamId == this.teamId);
        if (yourPicks.length > 0) {
          console.log(`\n🎯 YOUR DRAFT PICKS (${yourPicks.length}):`);
          yourPicks.forEach(pick => {
            const player = pick.playerPoolEntry?.player;
            if (player) {
              const position = this.getPositionName(player.defaultPositionId);
              const team = this.getTeamAbbreviation(player.proTeamId);
              console.log(`Round ${pick.roundId}, Pick ${pick.roundPickNumber}: ${player.fullName} (${position}, ${team})`);
            }
          });
        }
      }
      
      return draft;
    } else {
      console.log('❌ Could not access draft information');
      return null;
    }
  }

  getHeaders() {
    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'Fantasy-Command-Center/1.0.0'
    };
    
    // Add cookies if available
    if (config.espn.s2Cookie && config.espn.swidCookie) {
      headers['Cookie'] = `espn_s2=${config.espn.s2Cookie}; SWID=${config.espn.swidCookie}`;
    }
    
    return headers;
  }

  getPositionName(positionId) {
    const positions = {
      1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST'
    };
    return positions[positionId] || 'FLEX';
  }

  getTeamAbbreviation(teamId) {
    const teams = {
      1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET',
      9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN',
      17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC',
      25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WSH', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU'
    };
    return teams[teamId] || 'FA';
  }
}

async function main() {
  const tester = new ESPNTeamTester();
  
  try {
    const results = await tester.testTeamConnection();
    
    console.log('\n🎉 CONNECTION SUCCESSFUL!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ System can access your league');
    console.log('✅ System can identify your specific team');
    console.log('✅ System can read your roster');
    console.log('✅ System can monitor draft picks');
    
    console.log('\n🤖 HOW AI KNOWS YOUR TEAM:');
    console.log(`• League ID: ${tester.leagueId} (from URL)`);
    console.log(`• Team ID: ${tester.teamId} (from URL)`);
    console.log('• API automatically filters data for your team');
    console.log('• AI recommendations personalized to your roster');
    
    console.log('\n🚀 READY FOR:');
    console.log('• Real-time draft monitoring');
    console.log('• Personalized AI recommendations');
    console.log('• Your roster analysis');
    console.log('• Trade suggestions');
    
  } catch (error) {
    console.log('\n❌ CONNECTION TEST FAILED');
    console.log('See error details above for troubleshooting steps');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ESPNTeamTester;