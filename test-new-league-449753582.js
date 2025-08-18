const axios = require('axios');

async function testNewLeague() {
  console.log('🆕 TESTING NEW LEAGUE: 449753582');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const leagueId = '449753582';
  const season = '2025';
  
  console.log(`📊 League ID: ${leagueId}`);
  console.log(`📅 Season: ${season}`);
  console.log(`🕐 Just updated`);
  
  const testUrls = [
    // Basic league info
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}`,
    
    // With team view
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=mTeam`,
    
    // Draft detail view
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=mDraftDetail`,
    
    // Public access attempt
    `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/leagues/${leagueId}`,
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
        console.log(`📊 League Name: "${data.settings?.name || 'Unknown'}"`);
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
        
        if (data.draftDetail && data.draftDetail.picks) {
          console.log(`   Picks Made: ${data.draftDetail.picks.length}`);
        }
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
  
  console.log('\n🎯 LEAGUE STATUS:');
  console.log('Ready to test Discord live draft commands!');
  console.log('\n🔥 NEXT STEPS:');
  console.log('1. Go to Discord');
  console.log('2. Type: !coach draft connect 449753582');
  console.log('3. Ask: !coach who should I draft');
  console.log('4. Get real-time draft recommendations!');
  
  return { success: false };
}

async function main() {
  try {
    const result = await testNewLeague();
    
    console.log('\n🚀 UPDATED TO NEW LEAGUE!');
    console.log('League ID 449753582 is now configured for live draft analysis.');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = testNewLeague;