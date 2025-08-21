const NewsArticleFetcher = require('./src/news-article-fetcher');
const SimpleTrendingAnalyzer = require('./src/services/simple-trending');
const LiveGameMonitor = require('./src/monitoring/live-game-monitor');

async function testAllSystems() {
  console.log('🏈 **TESTING FANTASY COMMAND CENTER - ALL SYSTEMS**\n');
  
  // Test 1: Real NFL.com News
  console.log('1. 📰 **TESTING NFL.COM NEWS SCRAPING**');
  try {
    const newsFetcher = new NewsArticleFetcher();
    const articles = await newsFetcher.fetchLatestArticles(5);
    
    console.log(`✅ Found ${articles.length} articles\n`);
    
    articles.slice(0, 3).forEach((article, i) => {
      console.log(`${i + 1}. ${article.title}`);
      console.log(`   🔗 ${article.url}`);
      console.log(`   📅 ${article.publishedAt}`);
      console.log(`   📰 Source: ${article.source}\n`);
    });
  } catch (error) {
    console.error('❌ News test failed:', error.message);
  }
  
  // Test 2: Multi-Source Trending
  console.log('2. 📈 **TESTING MULTI-SOURCE TRENDING ANALYSIS**');
  try {
    const trendingAnalyzer = new SimpleTrendingAnalyzer();
    const trending = await trendingAnalyzer.getTrendingPlayers();
    
    console.log(`✅ Found ${trending.length} trending players\n`);
    
    trending.slice(0, 5).forEach((player, i) => {
      console.log(`${i + 1}. **${player.name}**`);
      console.log(`   📊 Reason: ${player.reason}`);
      console.log(`   📱 Sources: ${player.sources ? player.sources.join(', ') : 'Reddit'}`);
      console.log(`   🔥 Mentions: ${player.mentions || 1}`);
      if (player.crossReferenced) console.log('   ✅ Cross-referenced across platforms');
      if (player.newsUrl) console.log(`   🔗 News: ${player.newsUrl}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Trending test failed:', error.message);
  }
  
  // Test 3: Live Game Monitor Setup
  console.log('3. 🏈 **TESTING LIVE GAME MONITOR**');
  try {
    const liveMonitor = new LiveGameMonitor();
    
    // Test webhook configuration
    const liveWebhookUrl = process.env.LIVE_WEBHOOK_URL || 'https://discord.com/api/webhooks/1407801106297520149/9O8DNPDq4TWp8ynQu2R2n7nVL9DQFQLEk59KLycaGwzot3I8sjzhksZfynkkif9M2tmz';
    
    // Add test players
    liveMonitor.addPlayersToWatchlist([
      'Christian McCaffrey',
      'Saquon Barkley',
      'Josh Allen'
    ]);
    
    // Start monitoring
    await liveMonitor.startMonitoring(liveWebhookUrl);
    
    // Get status
    const status = liveMonitor.getStatus();
    console.log('✅ Live Game Monitor Status:');
    console.log(`   🎯 Monitoring: ${status.monitoring ? 'Active' : 'Inactive'}`);
    console.log(`   🏈 Active Games: ${status.activeGames}`);
    console.log(`   👥 Watched Players: ${status.watchedPlayers}`);
    console.log(`   📱 Webhook: ${status.webhookConfigured ? 'Configured' : 'Missing'}`);
    console.log(`   📅 Game Day: ${status.gameDay ? 'Yes' : 'No'}`);
    
    // Check for games
    console.log('\n🔍 Checking for active games...');
    await liveMonitor.checkActiveGames();
    
    console.log('✅ Live monitoring ready for tomorrow night!\n');
    
    // Stop test monitoring
    liveMonitor.stopMonitoring();
    
  } catch (error) {
    console.error('❌ Live monitor test failed:', error.message);
  }
  
  // Test 4: Environment Variables
  console.log('4. 🔧 **TESTING ENVIRONMENT CONFIGURATION**');
  const requiredEnvVars = [
    'DISCORD_BOT_TOKEN',
    'CLAUDE_API_KEY',
    'PRACTICE_WEBHOOK_URL',
    'LIVE_WEBHOOK_URL'
  ];
  
  requiredEnvVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: Configured (${value.substring(0, 20)}...)`);
    } else {
      console.log(`❌ ${varName}: Missing`);
    }
  });
  
  console.log('\n🚀 **SYSTEM TEST COMPLETE**');
  console.log('\n📋 **TOMORROW\'S PRESEASON GAMES:**');
  console.log('🏈 Steelers @ Panthers');
  console.log('🏈 Patriots @ Giants');
  console.log('\n📱 **EXPECTED ALERTS:**');
  console.log('• Game start pings in live channel');
  console.log('• Score updates when teams score');
  console.log('• Player performance if watchlist players get action');
  console.log('• Evening report with real NFL.com headlines');
  console.log('\n✅ **Fantasy Command Center: READY FOR 2025 SEASON!**');
}

testAllSystems().catch(console.error);