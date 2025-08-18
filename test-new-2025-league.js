const axios = require('axios');

async function testNew2025League() {
  console.log('🆕 TESTING NEW 2025 LEAGUE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const leagueId = '356030745';
  const season = '2025';
  
  console.log(`📊 League ID: ${leagueId}`);
  console.log(`📅 Season: ${season}`);
  console.log(`🕐 Created: Just now`);
  
  // Try different ESPN API endpoints and configurations
  const testUrls = [
    // Basic league info
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}`,
    
    // With team view
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=mTeam`,
    
    // Public access attempt
    `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/leagues/${leagueId}`,
    
    // Alternative API path
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/${leagueId}?seasonId=${season}`,
  ];
  
  for (let i = 0; i < testUrls.length; i++) {
    const url = testUrls[i];
    console.log(`\n${i + 1}️⃣ Testing endpoint ${i + 1}:`);
    console.log(`🔗 ${url.replace(leagueId, 'XXX')}`);
    
    try {
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Fantasy-Command-Center/1.0.0',
          'X-Fantasy-Source': 'kona',
          'X-Fantasy-Platform': 'kona-PROD-1d4f6f3c-fb73-4b80-acb4-25d72e2e0944'
        },
        timeout: 15000
      });
      
      console.log(`✅ SUCCESS! Status: ${response.status}`);
      
      const data = response.data;
      
      // Parse league info
      if (data.settings || data.scoringSettings) {
        console.log(`📊 League Name: "${data.settings?.name || 'New League'}"`);
        console.log(`👥 League Size: ${data.settings?.size || 'Unknown'}`);
        console.log(`🏆 League Type: ${data.settings?.isPublic ? 'Public' : 'Private'}`);
        console.log(`📅 Draft Date: ${data.settings?.draftSettings?.date || 'Not scheduled'}`);
      }
      
      // Check teams
      if (data.teams) {
        console.log(`\n👥 TEAMS FOUND: ${data.teams.length}`);
        data.teams.forEach(team => {
          const teamName = `${team.location || ''} ${team.nickname || 'Team ' + team.id}`.trim();
          console.log(`   ${team.id}: ${teamName || 'Unnamed Team'}`);
        });
        
        // Check if team 1 exists
        const yourTeam = data.teams.find(t => t.id == 1);
        if (yourTeam) {
          console.log(`\n🎯 YOUR TEAM (ID: 1):`);
          console.log(`   Name: ${yourTeam.location || ''} ${yourTeam.nickname || 'Team 1'}`);
          console.log(`   Owner: ${yourTeam.primaryOwner || 'You'}`);
        }
      }
      
      // Check draft status
      if (data.draftDetail || (data.settings && data.settings.draftSettings)) {
        const draft = data.draftDetail || data.settings.draftSettings;
        console.log(`\n📋 DRAFT STATUS:`);
        console.log(`   Completed: ${draft.drafted || draft.complete ? 'Yes' : 'No'}`);
        console.log(`   Type: ${draft.type || 'Standard'}`);
        console.log(`   Date: ${draft.date || 'Not scheduled'}`);
      }
      
      return { success: true, data, endpoint: i + 1 };
      
    } catch (error) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      
      if (status === 401) {
        console.log(`🔒 PRIVATE: Needs authentication`);
      } else if (status === 404) {
        console.log(`❌ NOT FOUND: League may not exist yet`);
      } else if (status === 403) {
        console.log(`🚫 FORBIDDEN: No access permissions`);
      } else {
        console.log(`❌ ERROR: ${status || 'Network'} - ${message}`);
      }
    }
  }
  
  console.log('\n🔍 LEAGUE STATUS ANALYSIS:');
  console.log('\nPossible reasons for access issues:');
  console.log('1. 🕐 New league needs time to propagate (wait 5-10 minutes)');
  console.log('2. 🔒 League set to private by default (needs cookies)');
  console.log('3. 👥 League not fully configured yet');
  console.log('4. 📅 2025 season not fully active in ESPN API');
  
  console.log('\n✅ SOLUTIONS:');
  console.log('1. Wait 10 minutes and try again');
  console.log('2. Check league privacy settings in ESPN');
  console.log('3. Make sure league is fully set up');
  console.log('4. Get fresh ESPN cookies from browser');
  
  return { success: false };
}

async function main() {
  try {
    const result = await testNew2025League();
    
    if (result.success) {
      console.log('\n🎉 LEAGUE ACCESS CONFIRMED!');
      console.log(`✅ Working endpoint: #${result.endpoint}`);
      console.log('🚀 Ready to start monitoring your draft!');
      
      console.log('\n🎯 NEXT COMMANDS:');
      console.log('npm run draft     # Start draft monitoring');
      console.log('npm run discord   # Start Discord AI bot');
    } else {
      console.log('\n⏳ NEW LEAGUE SETUP:');
      console.log('Since you just created this league:');
      console.log('1. Wait 10-15 minutes for ESPN to fully activate it');
      console.log('2. Make sure teams are added and league is configured');
      console.log('3. Check if league is set to public or private');
      console.log('4. Try the test again: node test-new-2025-league.js');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = testNew2025League;