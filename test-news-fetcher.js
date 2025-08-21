const NewsArticleFetcher = require('./src/news-article-fetcher');

async function testNewsFetcher() {
  console.log('🔍 Testing news fetcher for real fantasy news...');
  
  try {
    const fetcher = new NewsArticleFetcher();
    const articles = await fetcher.fetchLatestArticles();
    
    console.log(`📰 Found ${articles.length} total articles`);
    
    // Check today's articles
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const todaysArticles = articles.filter(article => {
      if (!article.publishedAt) return false;
      const articleDate = new Date(article.publishedAt);
      return articleDate >= startOfDay;
    });
    
    console.log(`📅 Today's articles: ${todaysArticles.length}`);
    
    if (todaysArticles.length > 0) {
      console.log('\n📰 TODAY\'S REAL FANTASY NEWS:');
      todaysArticles.slice(0, 5).forEach((article, i) => {
        console.log(`${i + 1}. ${article.title}`);
        console.log(`   Published: ${article.publishedAt}`);
        console.log(`   Source: ${article.source || 'Unknown'}`);
        console.log('');
      });
    } else {
      console.log('❌ No articles found for today');
      console.log('\n📰 Latest articles from any day:');
      articles.slice(0, 3).forEach((article, i) => {
        console.log(`${i + 1}. ${article.title}`);
        console.log(`   Published: ${article.publishedAt}`);
        console.log(`   Source: ${article.source || 'Unknown'}`);
        console.log('');
      });
    }
    
    // Check for recent articles (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentArticles = articles.filter(article => {
      if (!article.publishedAt) return false;
      const articleDate = new Date(article.publishedAt);
      return articleDate >= yesterday;
    });
    
    console.log(`⏰ Articles from last 24 hours: ${recentArticles.length}`);
    
  } catch (error) {
    console.error('❌ News fetch failed:', error.message);
    console.error(error.stack);
  }
}

testNewsFetcher();