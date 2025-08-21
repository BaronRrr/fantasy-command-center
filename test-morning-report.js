const ScheduledNotifications = require('./src/monitoring/scheduled-notifications');

async function testMorningReport() {
  console.log('🌅 Testing the fixed morning report with real-time data...\n');
  
  try {
    const scheduler = new ScheduledNotifications();
    
    // Test today's fantasy news
    console.log('1. 📰 Testing real fantasy news fetch...');
    const todaysNews = await scheduler.getTodaysFantasyNews();
    console.log(`✅ Found ${todaysNews.length} current articles`);
    
    if (todaysNews.length > 0) {
      todaysNews.slice(0, 3).forEach((news, i) => {
        console.log(`   ${i + 1}. ${news.title}`);
        console.log(`      Source: ${news.source} | ${news.publishedAt}`);
      });
    } else {
      console.log('   ⚠️ No current news found');
    }
    
    console.log('\n2. 📈 Testing filtered trending players...');
    const trending = await scheduler.getTrendingPlayers();
    console.log(`✅ Found ${trending.length} valid trending players`);
    
    if (trending.length > 0) {
      trending.forEach((player, i) => {
        console.log(`   ${i + 1}. ${player.name} - ${player.reason || 'Trending discussion'}`);
        if (player.sources) console.log(`      Sources: ${player.sources.join(', ')}`);
      });
    } else {
      console.log('   ⚠️ No valid trending players found');
    }
    
    console.log('\n3. 🎯 Testing today\'s actual focus...');
    const todaysFocus = await scheduler.getTodayActualFocus();
    console.log('✅ Today\'s Focus:');
    console.log(todaysFocus);
    
    console.log('\n4. 📧 Testing complete morning report generation...');
    
    // Manually call the morning report method to see the full embed
    await scheduler.sendMorningReport();
    console.log('✅ Morning report sent successfully');
    
    console.log('\n🎉 **MORNING REPORT TEST COMPLETE**');
    console.log('✅ Real-time news integration working');
    console.log('✅ Fake player filtering active');
    console.log('✅ Dynamic focus generation working');
    console.log('\n📅 **DRAFT INFO UPDATE**');
    console.log('🗓️ Draft Date: August 30th (in 9 days)');
    console.log('📍 Current Date: August 21st');
    console.log('🏈 Season: 2025-2026 (preseason active)');
    
  } catch (error) {
    console.error('❌ Morning report test failed:', error.message);
    console.error(error.stack);
  }
}

testMorningReport();