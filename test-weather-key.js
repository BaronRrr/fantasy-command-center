const WeatherClient = require('./src/api/weather-client');

async function testWeatherKey() {
  console.log('🌦️ Testing Weather API Key...\n');
  
  const weatherClient = new WeatherClient();
  console.log('API Key loaded:', weatherClient.apiKey ? 'YES (' + weatherClient.apiKey.substring(0, 8) + '...)' : 'NO');
  
  try {
    console.log('\n1️⃣ Testing Kansas City weather...');
    const kcWeather = await weatherClient.getCurrentWeather('KC');
    console.log('KC Weather Result:', {
      team: kcWeather.team,
      location: kcWeather.location,
      conditions: kcWeather.conditions,
      temperature: kcWeather.temperature,
      note: kcWeather.note || 'Live data!'
    });
    
    console.log('\n2️⃣ Testing health check...');
    const health = await weatherClient.healthCheck();
    console.log('Health Status:', health);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testWeatherKey();