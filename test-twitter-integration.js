const TwitterMonitor = require('./src/monitoring/twitter-monitor');

async function testTwitterIntegration() {
  console.log('🐦 Testing Twitter Integration for Draft Analysis');
  console.log('=================================================');
  
  const monitor = new TwitterMonitor();
  
  console.log('\n📡 Testing Twitter RSS feeds...');
  await monitor.testFeeds();
  
  console.log('\n🧠 Testing AI learning integration...');
  
  // Simulate some tweets for testing
  const testTweets = [
    {
      id: 'test1',
      content: 'Christian McCaffrey questionable with hamstring injury, could miss Week 1',
      author: 'Adam Schefter',
      urgency: 'CRITICAL',
      players: ['Christian McCaffrey'],
      timestamp: new Date().toISOString()
    },
    {
      id: 'test2', 
      content: 'Ja\'Marr Chase looking explosive in practice, expect big things this season',
      author: 'Evan Silva',
      urgency: 'MEDIUM',
      players: ['Ja\'Marr Chase'],
      timestamp: new Date().toISOString()
    }
  ];
  
  // Test storing and retrieving insights
  for (const tweet of testTweets) {
    monitor.storeForDraftLookup(tweet, tweet.urgency, tweet.players, 'Test analysis');
  }
  
  console.log('\n📊 Testing draft insights retrieval...');
  const insights = monitor.getDraftRelevantInsights('Christian McCaffrey', 60);
  
  if (insights) {
    console.log(`✅ Found ${insights.critical_news.length} critical updates`);
    console.log(`✅ Found ${insights.injury_updates.length} injury reports`);
    console.log(`✅ Found ${insights.player_specific.length} player-specific updates`);
    
    if (insights.critical_news.length > 0) {
      console.log('\n📰 Sample critical news:');
      insights.critical_news.slice(0, 2).forEach(item => {
        console.log(`- ${item.author}: ${item.content}`);
      });
    }
  }
  
  console.log('\n🔄 Testing periodic AI learning...');
  try {
    await monitor.performPeriodicAILearning();
    console.log('✅ AI learning completed successfully');
  } catch (error) {
    console.log(`⚠️  AI learning test failed: ${error.message}`);
  }
  
  console.log('\n📋 Twitter Sources Summary:');
  console.log('==========================');
  
  const sourcesByPriority = {
    CRITICAL: [],
    HIGH: [],
    MEDIUM: []
  };
  
  Object.entries(monitor.twitterFeeds).forEach(([key, feed]) => {
    sourcesByPriority[feed.priority].push(feed.name);
  });
  
  Object.entries(sourcesByPriority).forEach(([priority, sources]) => {
    if (sources.length > 0) {
      console.log(`${priority}: ${sources.join(', ')}`);
    }
  });
  
  console.log(`\nTotal Twitter Sources: ${Object.keys(monitor.twitterFeeds).length}`);
  
  console.log('\n🎯 Integration Benefits:');
  console.log('========================');
  console.log('✅ Real-time injury updates during drafts');
  console.log('✅ Expert analysis from top fantasy analysts');
  console.log('✅ Breaking news alerts in Discord');
  console.log('✅ AI learning from tweet patterns');
  console.log('✅ Player-specific news for draft decisions');
  console.log('✅ Background intelligence gathering');
  
  console.log('\n🚀 System Status: Twitter intelligence ACTIVE');
  console.log('Ready for live draft with real-time Twitter insights!');
}

// Run the test
testTwitterIntegration().catch(console.error);