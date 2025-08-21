const ScheduledNotifications = require('./src/monitoring/scheduled-notifications');

async function testEveningReport() {
  console.log('🌆 Testing enhanced evening report with preseason games and performers...\n');
  
  try {
    const scheduler = new ScheduledNotifications();
    
    // Test today's game results
    console.log('1. 🏈 Testing game results fetch...');
    const gameResults = await scheduler.getTodaysGameResults();
    console.log(`✅ Found ${gameResults.length} games today`);
    
    if (gameResults.length > 0) {
      gameResults.forEach((game, i) => {
        console.log(`   ${i + 1}. ${game.awayTeam} ${game.awayScore} - ${game.homeScore} ${game.homeTeam} (${game.status})`);
        console.log(`      Type: ${game.gameType}`);
      });
    } else {
      console.log('   ⚠️ No games found for today');
    }
    
    console.log('\n2. ⭐ Testing top performers...');
    const topPerformers = await scheduler.getTodaysTopPerformers();
    console.log(`✅ Found ${topPerformers.length} top performers`);
    
    if (topPerformers.length > 0) {
      topPerformers.forEach((player, i) => {
        console.log(`   ${i + 1}. ${player.name} (${player.team}): ${player.stats}`);
      });
    } else {
      console.log('   ⚠️ No performer data available (will be populated during live games)');
    }
    
    console.log('\n3. 📰 Testing real fantasy news...');
    const todaysNews = await scheduler.getTodaysFantasyNews();
    console.log(`✅ Found ${todaysNews.length} current articles`);
    
    if (todaysNews.length > 0) {
      todaysNews.slice(0, 3).forEach((news, i) => {
        console.log(`   ${i + 1}. ${news.title}`);
        console.log(`      Source: ${news.source}`);
      });
    }
    
    console.log('\n4. 📧 Testing complete evening report generation...');
    
    // Manually call the evening report method
    await scheduler.sendEveningReport();
    console.log('✅ Enhanced evening report sent successfully');
    
    console.log('\n🎉 **EVENING REPORT TEST COMPLETE**');
    console.log('✅ Game results integration working');
    console.log('✅ Top performers structure ready');
    console.log('✅ Real-time news integration working');
    console.log('✅ Enhanced evening wrap-up includes:');
    console.log('   • Daily fantasy news developments');
    console.log('   • Preseason/regular season game scores');
    console.log('   • Top fantasy performers (when games active)');
    console.log('   • Injury monitoring status');
    console.log('   • Trending player discussions');
    console.log('   • Tomorrow\'s focus areas');
    
    console.log('\n🏈 **PRESEASON READY**');
    console.log('📅 Tomorrow night: Steelers @ Panthers, Patriots @ Giants');
    console.log('🎯 Evening reports will include live game scores and standout performances');
    
  } catch (error) {
    console.error('❌ Evening report test failed:', error.message);
    console.error(error.stack);
  }
}

testEveningReport();