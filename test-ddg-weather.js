const DuckDuckGoSearch = require('./src/api/duckduckgo-search');

async function testDDGWeather() {
  console.log('🌦️ Testing DuckDuckGo Weather Search...\n');
  
  const ddgSearch = new DuckDuckGoSearch();
  
  try {
    // Test 1: Game Weather Search
    console.log('1️⃣ Testing game weather search...');
    const gameWeather = await ddgSearch.searchGameWeather('BUF', 'MIA');
    if (gameWeather) {
      console.log('Buffalo vs Miami Weather:');
      console.log(`  Conditions: ${gameWeather.conditions}`);
      console.log(`  Severity: ${gameWeather.severity}`);
      console.log(`  Impact: ${gameWeather.impact}`);
      console.log(`  Fantasy Advice: ${gameWeather.fantasyAdvice}`);
      console.log(`  Sources Found: ${gameWeather.sources.length}`);
    }
    console.log('');
    
    // Test 2: Stadium Weather
    console.log('2️⃣ Testing stadium weather search...');
    const stadiumWeather = await ddgSearch.searchStadiumWeather('GB');
    if (stadiumWeather) {
      console.log('Green Bay Stadium Weather:');
      console.log(`  Location: ${stadiumWeather.location}`);
      console.log(`  Conditions: ${stadiumWeather.conditions}`);
      console.log(`  Temperature: ${stadiumWeather.temperature}°F`);
      console.log(`  Is Dome: ${stadiumWeather.isDome}`);
      console.log(`  Sources Found: ${stadiumWeather.sources.length}`);
    }
    console.log('');
    
    // Test 3: Weekly Weather Report
    console.log('3️⃣ Testing weekly weather report...');
    const weeklyWeather = await ddgSearch.searchWeeklyWeatherReport();
    console.log(`Weekly Weather Report: ${weeklyWeather.length} items found`);
    if (weeklyWeather.length > 0) {
      weeklyWeather.slice(0, 3).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.team}: ${item.conditions} - ${item.impact}`);
      });
    }
    console.log('');
    
    console.log('✅ DuckDuckGo weather search integration completed!');
    console.log('\n🎯 Benefits:');
    console.log('  📰 100% Free - No API keys needed');
    console.log('  🔍 Real search results from weather sites');
    console.log('  🏈 Fantasy-focused impact analysis');
    console.log('  🏟️ Dome detection for indoor games');
    console.log('  ⚡ Automatic parsing of weather conditions');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDDGWeather();