# 🏈 Fantasy Command Center

A comprehensive Node.js fantasy football management system that provides real-time draft assistance, season-long roster optimization, and advanced league intelligence using ESPN Fantasy API integration and AI-powered analysis.

## 🎯 Overview

This system gives you a significant competitive advantage through:
- **Real-time draft monitoring** with instant AI recommendations
- **League intelligence** tracking all players across all teams
- **Season management** with weekly lineup optimization and waiver alerts
- **Advanced analytics** with injury impact analysis and schedule strength
- **Automated alerts** via Discord webhooks for critical opportunities

## 🚀 Quick Start

### 1. Installation

```bash
git clone <repository>
cd fantasy-command-center
npm install
```

### 2. Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your API keys and league information:
```bash
# ESPN Fantasy Football
ESPN_LEAGUE_ID=your_league_id
ESPN_S2_COOKIE=your_s2_cookie
ESPN_SWID=your_swid_cookie

# Claude AI
CLAUDE_API_KEY=your_claude_api_key

# Discord Notifications
DISCORD_WEBHOOK_URL=your_discord_webhook

# External APIs (optional but recommended)
SPORTSDATA_API_KEY=your_sportsdata_key
FANTASYPROS_API_KEY=your_fantasypros_key
```

### 3. Setup Database

```bash
npm run migrate
```

### 4. Start the Application

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

## 🔧 Getting Your ESPN Credentials

For **private leagues**, you need ESPN cookies:

1. Log into ESPN Fantasy Football in your browser
2. Open Developer Tools (F12) → Network tab
3. Refresh the page and look for any request to `fantasy.espn.com`
4. In the request headers, find:
   - `espn_s2` cookie value
   - `SWID` cookie value
5. Add these to your `.env` file

For **public leagues**, only the league ID is needed.

## 📊 Features

### Draft Assistant
- **Real-time pick monitoring** (5-second intervals)
- **Instant AI recommendations** when your turn approaches
- **Value-based suggestions** considering ADP vs current availability
- **Position scarcity alerts**
- **Discord notifications** for critical draft moments

### League Intelligence
- **All-team roster tracking**
- **Trade opportunity detection**
- **Waiver wire value identification**
- **Opponent weakness analysis**

### AI Analysis
- **Draft recommendations** with urgency levels
- **Player value analysis** vs ADP
- **Injury impact assessment**
- **Schedule strength consideration**
- **Breakout player identification**

## 🤖 API Endpoints

### Draft Management
```bash
# Start draft monitoring
POST /draft/start

# Stop draft monitoring  
POST /draft/stop

# Get draft status
GET /draft/status

# Get AI recommendations
POST /ai/analyze
```

### Player Data
```bash
# Search players
GET /players/search?query=Josh%20Allen

# Get players by position
GET /players/position/QB

# Get injury reports
GET /external/injuries

# Get player projections
GET /external/projections
```

### Notifications
```bash
# Test Discord connection
POST /notifications/test

# System health check
GET /health
```

## 💬 Discord Integration

### Setup Discord Webhook
1. Go to your Discord server settings
2. Navigate to Integrations → Webhooks
3. Create a new webhook for your fantasy channel
4. Copy the webhook URL to your `.env` file

### Alert Types
- 🚨 **CRITICAL**: Your turn to pick
- ⚠️ **HIGH**: Turn approaching, AI recommendations
- 📢 **MEDIUM**: New picks, trade opportunities
- ℹ️ **INFO**: General updates, system status

## 🧪 Testing

Run the test suite to verify everything works:

```bash
# Test draft monitoring with mock data
node src/scripts/test-draft-monitor.js

# Test individual components
npm test
```

## 📁 Project Structure

```
fantasy-command-center/
├── src/
│   ├── api/                    # API clients
│   │   ├── espn-client.js     # ESPN Fantasy API
│   │   ├── claude-ai.js       # Claude AI integration
│   │   └── external-apis.js   # Sports data APIs
│   ├── services/              # Business logic
│   │   ├── draft-monitor.js   # Real-time draft tracking
│   │   └── ...
│   ├── alerts/                # Notification systems
│   │   ├── discord-bot.js     # Discord webhooks
│   │   └── ...
│   └── index.js              # Main application
├── config/                   # Configuration files
├── database/                 # Database setup and migrations
└── tests/                   # Test files
```

## 🎮 Usage Examples

### Starting Draft Monitoring

```javascript
// Via API
curl -X POST http://localhost:3000/draft/start

// The system will:
// 1. Connect to your ESPN league
// 2. Load current draft state
// 3. Start monitoring for new picks
// 4. Send Discord alerts when it's your turn
```

### Getting AI Recommendations

```javascript
// When it's your turn, get instant analysis
curl -X POST http://localhost:3000/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{"currentPick": {"overall": 24, "round": 2, "pickInRound": 12}}'

// Response includes:
// - Top 3 recommended players
// - Urgency levels (CRITICAL/HIGH/MEDIUM/LOW)
// - Value analysis vs ADP
// - Steal opportunities
// - Risk assessments
```

### Player Search

```javascript
// Find specific players
curl "http://localhost:3000/players/search?query=Josh%20Allen"

// Get top available QBs
curl "http://localhost:3000/players/position/QB?limit=10"
```

## ⚡ Advanced Features

### Custom AI Prompts
The system uses sophisticated prompts that consider:
- Historical performance trends
- Injury status and recovery timelines
- 2025 team situation changes
- Schedule strength analysis
- Positional scarcity
- League-specific scoring

### Real-time Monitoring
- Checks for new picks every 5 seconds
- Instant notifications when your turn approaches
- Automatic AI analysis when picks are detected
- Background monitoring with minimal resource usage

### Data Enrichment
- Combines ESPN data with external sources
- SportsData.io for comprehensive stats
- FantasyPros for expert rankings and ADP
- Weather API for game conditions
- News API for breaking player updates

## 🔒 Security

- Environment variables for all sensitive data
- Rate limiting on API requests
- Input validation and sanitization
- Secure webhook configurations
- No storage of API keys in code

## 📈 Performance

- Efficient caching of API responses
- Minimal ESPN API calls to avoid rate limits
- Optimized database queries
- Background processing for heavy operations
- Graceful error handling and recovery

## 🛠️ Troubleshooting

### Common Issues

**ESPN API Connection Failed**
- Verify your league ID is correct
- For private leagues, ensure S2 and SWID cookies are valid
- Check if ESPN is experiencing outages

**Discord Notifications Not Working**
- Verify webhook URL is correct
- Test with `POST /notifications/test`
- Check Discord server permissions

**AI Recommendations Not Generated**
- Verify Claude API key is valid
- Check internet connection
- Review logs for specific error messages

### Debug Mode
```bash
NODE_ENV=development npm run dev
```

Enable debug logging in your `.env`:
```bash
LOG_LEVEL=debug
```

## 🔮 Future Enhancements

- **React Dashboard**: Web interface for easy management
- **Mobile App**: Push notifications and quick lineup changes
- **Machine Learning**: Custom player value models
- **Trade Analyzer**: Advanced trade evaluation
- **Playoff Optimizer**: Late-season strategy recommendations
- **Dynasty Support**: Keeper league functionality

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs for error messages
3. Create an issue on GitHub with detailed information

---

**Ready to dominate your fantasy league!** 🏆

This system provides the insights and automation you need to make data-driven decisions and stay ahead of your competition. Good luck this season!