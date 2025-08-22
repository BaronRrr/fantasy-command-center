/**
 * Test Live Game Monitoring RIGHT NOW
 */

const axios = require('axios');

async function testLiveGamesNow() {
  console.log('🔍 CHECKING FOR LIVE GAMES RIGHT NOW...\n');
  
  try {
    // Check ESPN API directly
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Fantasy-Command-Center/1.0.0'
      }
    });

    const games = response.data.events || [];
    console.log(`📊 ESPN API returned ${games.length} games total\n`);
    
    if (games.length === 0) {
      console.log('❌ No games found in API response');
      return;
    }

    let liveGamesFound = 0;
    
    games.forEach((game, index) => {
      const homeTeam = game.competitions[0]?.competitors?.find(c => c.homeAway === 'home')?.team?.abbreviation || 'TBD';
      const awayTeam = game.competitions[0]?.competitors?.find(c => c.homeAway === 'away')?.team?.abbreviation || 'TBD';
      const status = game.status?.type?.name || 'Unknown';
      const statusId = game.status?.type?.id || 'unknown';
      const homeScore = game.competitions[0]?.competitors?.find(c => c.homeAway === 'home')?.score || '0';
      const awayScore = game.competitions[0]?.competitors?.find(c => c.homeAway === 'away')?.score || '0';
      const quarter = game.status?.period || 1;
      const clock = game.status?.displayClock || '';
      
      // Check if live
      const isLive = [
        'STATUS_IN_PROGRESS', 
        'STATUS_HALFTIME',
        'STATUS_END_OF_PERIOD',
        'STATUS_DELAYED'
      ].includes(statusId) || status.toLowerCase().includes('live') || status.toLowerCase().includes('progress');
      
      console.log(`${index + 1}. ${awayTeam} @ ${homeTeam}`);
      console.log(`   Status: ${status} (ID: ${statusId})`);
      console.log(`   Score: ${awayTeam} ${awayScore} - ${homeTeam} ${homeScore}`);
      console.log(`   Game Info: Q${quarter} - ${clock}`);
      console.log(`   LIVE STATUS: ${isLive ? '🔴 YES - LIVE GAME!' : '❌ Not live'}`);
      
      if (isLive) {
        liveGamesFound++;
        console.log(`   🚨 THIS GAME SHOULD TRIGGER ALERTS!`);
      }
      console.log('');
    });

    console.log(`\n🔴 LIVE GAMES DETECTED: ${liveGamesFound}`);
    
    if (liveGamesFound > 0) {
      console.log('\n🚨 THERE ARE LIVE GAMES - TESTING DISCORD WEBHOOK...');
      await testDiscordWebhook(liveGamesFound);
    } else {
      console.log('\n❓ No live games detected. This might be why you\'re not getting alerts.');
    }

  } catch (error) {
    console.error('❌ Error checking live games:', error.message);
  }
}

async function testDiscordWebhook(liveGameCount) {
  try {
    const webhookUrl = 'https://discord.com/api/webhooks/1408224618850029689/4mpK7R-7LebdWvJgND3ydNxikk0TdY2WCsJMY8BAog2fdnJCW43LRLl8-K-Do5TYH8Sz';
    
    const embed = {
      title: '🧪 LIVE GAME MONITORING TEST',
      description: `Testing live game detection - ${liveGameCount} live games found`,
      color: 0xFF0000,
      fields: [
        {
          name: '🔴 Live Games Detected',
          value: liveGameCount.toString(),
          inline: true
        },
        {
          name: '⏰ Test Time',
          value: new Date().toLocaleTimeString(),
          inline: true
        },
        {
          name: '📊 Status',
          value: 'If you see this, the webhook is working!',
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Live Game Monitor • Connection Test'
      }
    };

    const result = await axios.post(webhookUrl, {
      content: '🚨 **LIVE GAME TEST** - Manual check detected live games!',
      embeds: [embed]
    });

    console.log('✅ Discord webhook test sent successfully!');
    console.log('📱 Check your Discord channel for the test message.');
    
  } catch (error) {
    console.error('❌ Discord webhook test failed:', error.message);
  }
}

// Run the test immediately
testLiveGamesNow().then(() => {
  console.log('\n🏁 Live game test completed.');
}).catch(error => {
  console.error('💥 Test failed:', error);
});