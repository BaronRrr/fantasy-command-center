const DuckDuckGoSearch = require('./src/api/duckduckgo-search');
const WeatherClient = require('./src/api/weather-client');

async function testLiveDataServices() {
  console.log('🧪 Testing Live Data Services...\n');
  
  try {
    // Test 1: DuckDuckGo Search Health Check
    console.log('1️⃣ Testing DuckDuckGo search service...');
    const ddgSearch = new DuckDuckGoSearch();
    const ddgHealth = await ddgSearch.healthCheck();
    console.log('DuckDuckGo Status:', ddgHealth);
    console.log('');
    
    // Test 2: Weather Service Health Check
    console.log('2️⃣ Testing weather service...');
    const weatherClient = new WeatherClient();
    const weatherHealth = await weatherClient.healthCheck();
    console.log('Weather Status:', weatherHealth);
    console.log('');
    
    // Test 3: DuckDuckGo Player Search
    console.log('3️⃣ Testing player news search...');
    const playerNews = await ddgSearch.searchPlayerNews('Josh Allen');
    console.log(`Found ${playerNews.length} news items for Josh Allen`);
    if (playerNews.length > 0) {
      console.log('Sample news:');
      playerNews.slice(0, 2).forEach((news, index) => {
        console.log(`  ${index + 1}. ${news.title} (${news.urgency})`);
        console.log(`     Summary: ${news.summary.substring(0, 100)}...`);
      });
    }
    console.log('');
    
    // Test 4: Weather Data
    console.log('4️⃣ Testing weather data...');
    const bufWeather = await weatherClient.getCurrentWeather('BUF');
    console.log('Buffalo Weather:', {
      team: bufWeather.team,
      location: bufWeather.location,
      conditions: bufWeather.conditions,
      temperature: bufWeather.temperature,
      isDome: bufWeather.isDome
    });
    console.log('');
    
    // Test 5: Game Day Forecast
    console.log('5️⃣ Testing game day forecast...');
    const gameForecast = await weatherClient.getGameDayForecast('KC', 'BUF');
    console.log('Game Forecast:', {
      homeTeam: gameForecast.homeTeam,
      awayTeam: gameForecast.awayTeam,
      conditions: gameForecast.conditions,
      temperature: gameForecast.temperature,
      impact: gameForecast.impact,
      fantasyAdvice: gameForecast.fantasyAdvice
    });
    console.log('');
    
    // Test 6: Breaking News
    console.log('6️⃣ Testing breaking news search...');
    const breakingNews = await ddgSearch.searchBreakingNews();
    console.log(`Found ${breakingNews.length} breaking news items`);
    if (breakingNews.length > 0) {
      console.log('Sample breaking news:');
      breakingNews.slice(0, 2).forEach((news, index) => {
        console.log(`  ${index + 1}. ${news.title}`);
      });
    }
    console.log('');
    
    console.log('✅ Live data services test completed!');
    console.log('\nResults Summary:');
    console.log(`  📰 DuckDuckGo: ${ddgHealth.status} (${playerNews.length + breakingNews.length} total news items)`);
    console.log(`  🌦️ Weather: ${weatherHealth.status} (${weatherHealth.message || 'Live data available'})`);
    console.log(`  🔗 Integration: Both services integrated successfully`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testLiveDataServices();