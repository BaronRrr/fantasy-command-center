const axios = require('axios');

async function test2024League() {
  console.log('🔍 TESTING 2024 SEASON ACCESS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const leagueId = '356030745';
  const seasons = ['2024', '2025'];
  
  for (const season of seasons) {
    console.log(`\n📅 Testing Season ${season}:`);
    
    try {
      // Test public access first
      const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}`;
      
      console.log(`🔗 ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Fantasy-Command-Center/1.0.0'
        },
        timeout: 10000
      });
      
      const league = response.data;
      
      console.log(`✅ ${season} League found!`);
      console.log(`📊 Name: "${league.settings?.name || 'Unknown'}"`);
      console.log(`👥 Size: ${league.settings?.size || 'Unknown'} teams`);
      console.log(`🏆 Status: ${league.status?.currentMatchupPeriod ? 'Active' : 'Inactive'}`);
      
      // Test team access
      if (league.teams) {
        const team1 = league.teams.find(t => t.id == 1);
        if (team1) {
          console.log(`👤 Team 1: "${team1.location || ''} ${team1.nickname || 'Team 1'}"`);
          console.log(`📈 Record: ${team1.record?.overall?.wins || 0}-${team1.record?.overall?.losses || 0}`);
        }
      }
      
      // If we get here, this season works!
      return { season, league, success: true };
      
    } catch (error) {
      if (error.response?.status === 401) {
        console.log(`🔒 ${season}: Private league (needs authentication)`);
      } else if (error.response?.status === 404) {
        console.log(`❌ ${season}: League not found`);
      } else {
        console.log(`❌ ${season}: Error - ${error.message}`);
      }
    }
  }
  
  console.log('\n💡 RESULTS:');
  console.log('If no seasons worked, the league might be:');
  console.log('• Private (needs ESPN cookies)');
  console.log('• Not yet created for 2025');
  console.log('• Different league ID needed');
  
  return { success: false };
}

async function testPublicMode() {
  console.log('\n🌐 TESTING PUBLIC LEAGUE ACCESS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Try a known public league for testing
  const publicLeagueId = '356030745';
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2024/segments/0/leagues/${publicLeagueId}?view=mTeam&view=mRoster`;
  
  console.log('🔗 Testing with more data views...');
  
  try {
    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Fantasy-Command-Center/1.0.0'
      }
    });
    
    console.log('✅ Extended data access successful!');
    return response.data;
    
  } catch (error) {
    console.log(`❌ Extended access failed: ${error.response?.status || error.message}`);
    return null;
  }
}

async function main() {
  try {
    const result = await test2024League();
    
    if (!result.success) {
      await testPublicMode();
    }
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. If league is private, get fresh ESPN cookies');
    console.log('2. If league is 2024, update config to use 2024');
    console.log('3. If league is public, should work without cookies');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = test2024League;