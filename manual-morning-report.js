const DiscordNotifier = require('./src/notifications/discord-notifier');
const NewsArticleFetcher = require('./src/news-article-fetcher');
const SimpleTrendingAnalyzer = require('./src/services/simple-trending');

async function sendManualMorningReport() {
  try {
    console.log('🌅 Generating manual morning fantasy intelligence report...');
    
    const discordNotifier = new DiscordNotifier();
    const newsArticleFetcher = new NewsArticleFetcher();
    const trendingAnalyzer = new SimpleTrendingAnalyzer();
    
    // Get latest news
    const latestNews = await newsArticleFetcher.getLatestArticles();
    const newsItems = latestNews.slice(0, 3);
    
    // Get trending players
    const trendingData = await trendingAnalyzer.getTrendingPlayers();
    
    const embed = {
      title: '🌅 Manual Morning Fantasy Intelligence Report',
      description: `Good morning! Here's your fantasy football intelligence briefing for ${new Date().toLocaleDateString()}.`,
      color: 0x00FF00,
      fields: [],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Fantasy Command Center • Manual Morning Report'
      }
    };

    // Add trending players
    if (trendingData && trendingData.length > 0) {
      const trendingText = trendingData.slice(0, 5).map(player => 
        `• **${player.player}** - ${player.reason || 'Trending on social media'}`
      ).join('\n');
      
      embed.fields.push({
        name: '📈 Trending Players',
        value: trendingText,
        inline: false
      });
    }

    // Add latest news
    if (newsItems.length > 0) {
      const newsText = newsItems.map(article => 
        `• **${article.title.substring(0, 60)}...**`
      ).join('\n');
      
      embed.fields.push({
        name: '📰 Latest News',
        value: newsText,
        inline: false
      });
    }

    // Add today's focus
    embed.fields.push({
      name: '🎯 Today\'s Focus',
      value: `• **Practice Reports**: Monitor injury designations (if Wed-Fri)\n• **News Monitoring**: Breaking injury/trade news\n• **Depth Charts**: Watch for starter changes\n• **Weekly Prep**: Waiver wire and lineup decisions`,
      inline: false
    });

    // Add monitoring status
    embed.fields.push({
      name: '🤖 Monitoring Status',
      value: `• **Practice Alerts**: ✅ Active (dedicated channel)\n• **News Feeds**: ✅ Monitoring 8 premium sources\n• **Trending Analysis**: ✅ Real-time Reddit/social media\n• **Injury Reports**: ✅ Official NFL.com tracking`,
      inline: false
    });

    // Add commands reminder
    embed.fields.push({
      name: '⚡ Quick Commands',
      value: `• \`.practice roster <players>\` - Monitor your team\n• \`.news\` - Latest articles\n• \`.trending\` - Hot players\n• \`.depth\` - Depth chart status\n• \`.help\` - All commands`,
      inline: false
    });

    await discordNotifier.sendEmbed(embed, 'INFO');
    console.log('✅ Manual morning report sent successfully!');
    
  } catch (error) {
    console.error('❌ Failed to send manual morning report:', error.message);
  }
}

// Send the report
sendManualMorningReport();