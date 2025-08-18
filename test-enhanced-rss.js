const ArticleFetcher = require('./src/knowledge/article-fetcher');

async function testEnhancedRSS() {
  console.log('🚀 Testing Enhanced RSS Article Fetcher');
  console.log('=====================================');
  
  const fetcher = new ArticleFetcher();
  
  // Test individual high-priority sources
  const testSources = ['pff', 'rotoworld', 'rotowire', 'fantasypros', 'razzball'];
  
  for (const sourceKey of testSources) {
    const source = fetcher.sources[sourceKey];
    if (!source) {
      console.log(`❌ Source ${sourceKey} not found`);
      continue;
    }
    
    console.log(`\n📡 Testing ${source.name} (${source.priority} priority)`);
    console.log(`URL: ${source.rss}`);
    
    try {
      const articles = await fetcher.fetchSourceArticles(sourceKey, source);
      
      if (articles.length > 0) {
        console.log(`✅ Retrieved ${articles.length} articles`);
        
        // Show first article as example
        const firstArticle = articles[0];
        console.log(`📰 Sample: "${firstArticle.title}"`);
        console.log(`🔗 URL: ${firstArticle.url}`);
        console.log(`📝 Content: ${firstArticle.content.substring(0, 100)}...`);
        
      } else {
        console.log(`⚠️  No articles retrieved (may be filtered out or RSS unavailable)`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 RSS Source Summary:');
  console.log('======================');
  
  const sourcesByPriority = {
    CRITICAL: [],
    HIGH: [],
    MEDIUM: [],
    LOW: []
  };
  
  Object.entries(fetcher.sources).forEach(([key, source]) => {
    sourcesByPriority[source.priority].push(source.name);
  });
  
  Object.entries(sourcesByPriority).forEach(([priority, sources]) => {
    if (sources.length > 0) {
      console.log(`${priority}: ${sources.join(', ')}`);
    }
  });
  
  console.log(`\nTotal Sources: ${Object.keys(fetcher.sources).length}`);
  console.log('\n🎯 Next Steps:');
  console.log('- Run this periodically to build knowledge base');
  console.log('- Critical sources update every 5 minutes');
  console.log('- High priority sources update every 15 minutes');
  console.log('- Articles automatically filtered for fantasy relevance');
}

// Run the test
testEnhancedRSS().catch(console.error);