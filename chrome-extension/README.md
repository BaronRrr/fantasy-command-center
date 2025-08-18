# Fantasy Command Center - Chrome Extension

## 🏈 Live ESPN Draft Monitor with Discord AI Integration

This Chrome extension provides real-time monitoring of ESPN Fantasy Football drafts with automatic Discord notifications and AI-powered pick recommendations.

## 🚀 Features

- **Real-time Draft Monitoring**: Automatically detects picks as they happen on ESPN Fantasy draft pages
- **Discord Integration**: Sends instant notifications to your Discord channels
- **AI Draft Coach**: Triggers AI analysis for optimal pick recommendations 
- **Draft Export**: Download complete draft results as JSON for analysis
- **Snake Draft Support**: Accurately tracks your pick timing in snake drafts
- **Multi-Channel Support**: Different channels for picks, AI analysis, and alerts

## 📦 Installation

1. **Download Extension Files**
   ```bash
   # Clone or download the fantasy-command-center repository
   cd fantasy-command-center/chrome-extension
   ```

2. **Install in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top-right toggle)
   - Click "Load unpacked"
   - Select the `chrome-extension` folder

3. **Configure Extension**
   - Click the extension icon in your toolbar
   - Enter your Discord webhook URL
   - Set your team ID (usually 1-12)
   - Click "Save Configuration"

## ⚙️ Configuration

### Discord Webhook Setup
1. Go to your Discord server settings
2. Navigate to Integrations → Webhooks
3. Create a new webhook for your draft channel
4. Copy the webhook URL
5. Paste it in the extension popup

### Team ID
- Find your team ID from the ESPN draft URL
- Usually appears as `teamId=2` in the URL
- Enter this number in the extension settings

## 🎯 Usage

### During Live Draft

1. **Navigate to ESPN Draft**
   ```
   https://fantasy.espn.com/football/draft?leagueId=YOUR_LEAGUE_ID
   ```

2. **Start Monitoring**
   - Extension automatically activates on draft pages
   - Green status indicator shows "Connected & Monitoring"
   - Pick counter updates in real-time

3. **AI Coaching**
   - Extension sends Discord messages to trigger AI analysis
   - Discord bot responds with pick recommendations
   - Analysis includes available players, team needs, and strategy

4. **Export Results**
   - Click "Export Draft Results" in extension popup
   - Downloads complete JSON file with all picks
   - Includes your specific picks for easy team tracking

### Discord Integration

The extension sends three types of messages:

**Pick Notifications**
```
🎯 YOUR DRAFT PICK!
Pick #15: Christian McCaffrey
Your Team: Baron's Best Team
```

**AI Analysis Requests**
```
🤖 AI Analysis Request
Please analyze draft state for upcoming pick
Current Pick: #14
Generate recommendations for Baron's Best Team
```

**Status Updates**
```
🚀 Fantasy Command Center Connected!
Chrome extension monitoring League 449753582
Status: Live draft monitoring active
Your Team: Team 2 (Baron's Best Team)
```

## 🔧 Technical Details

### File Structure
```
chrome-extension/
├── manifest.json          # Extension configuration
├── content.js             # Main draft monitoring logic
├── background.js           # Service worker for communication
├── popup.html             # Extension interface
├── popup.js               # Popup functionality
└── README.md              # This file
```

### Key Components

**FantasyDraftMonitor Class** (`content.js`)
- DOM monitoring for ESPN draft pages
- Pick detection and processing
- Discord webhook integration
- Snake draft position calculation

**Background Service** (`background.js`)
- Message passing between components
- Configuration management
- Error handling and logging

**Popup Interface** (`popup.html` + `popup.js`)
- Real-time status display
- Configuration management
- Quick actions and testing

### Draft Detection Strategy

1. **Multiple DOM Selectors**: Searches for draft elements using various CSS selectors
2. **Mutation Observer**: Watches for page changes in real-time
3. **Periodic Scanning**: Backup scan every 5 seconds
4. **Pick Validation**: Filters out empty slots and system messages

### Snake Draft Logic

Calculates user's pick numbers for snake drafts:
- Odd rounds: Pick = Team ID
- Even rounds: Pick = (Team Count - Team ID + 1)
- Example for Team 2 in 8-team league: 2, 7, 10, 15, 18, 23...

## 🤖 AI Integration

### Discord Bot Commands

The extension works with the Fantasy Command Center Discord bot:

```
!coach analyze draft state    # Triggered automatically
!coach what should I pick     # Manual analysis request
!coach help                   # Bot usage help
```

### AI Features

- **Real-time Recommendations**: Based on current draft state
- **ESPN 2025 Projections**: Incorporates latest player rankings
- **Conservative Strategy**: Emphasizes proven performers
- **Position Analysis**: Tracks team needs and depth
- **Opponent Tracking**: Monitors other teams' strategies

## 📊 Data Export

### Export Format
```json
{
  "league_id": "449753582",
  "export_time": "2025-08-16T15:30:00.000Z",
  "total_picks": 128,
  "user_team_id": 2,
  "picks": [
    {
      "overall": 1,
      "player": "Christian McCaffrey",
      "element": "[DOM Element]"
    }
  ],
  "user_picks": [
    {
      "overall": 2,
      "player": "Justin Jefferson"
    }
  ]
}
```

### Use Cases
- Post-draft team analysis
- Trade opportunity identification
- Season-long performance tracking
- League analytics and insights

## 🛠️ Troubleshooting

### Extension Not Working
1. Check if you're on ESPN Fantasy draft page
2. Refresh the page to reload content script
3. Verify Discord webhook URL is correct
4. Check browser console for error messages

### No Pick Detection
1. ESPN pages may take time to load draft data
2. Try refreshing the draft page
3. Ensure you're in an active draft (not just viewing)
4. Check if draft is actually in progress

### Discord Issues
1. Test webhook URL in extension popup
2. Verify webhook permissions in Discord
3. Check that webhook channel exists
4. Ensure webhook URL hasn't expired

### Common Error Messages

**"No monitor active"**
- Refresh ESPN draft page
- Extension content script needs to reload

**"Discord connection failed"**
- Check webhook URL format
- Verify Discord server permissions
- Test with "Test Discord Connection" button

**"Export failed"**
- Must be on ESPN draft page
- Wait for draft data to load fully

## 🔐 Privacy & Security

- **No Personal Data Stored**: Only Discord webhook and team ID
- **Local Processing**: All draft detection happens in browser
- **Secure Communication**: Uses HTTPS for all external requests
- **No Tracking**: Extension doesn't collect usage analytics

## 🎯 Advanced Usage

### Multiple Leagues
- Configure different webhook URLs for different leagues
- Use unique team IDs for each league
- Export data keeps league ID for organization

### Custom Discord Channels
- Set up different webhooks for different message types
- Example: `#draft-picks` and `#ai-analysis` channels
- Modify webhook URLs in extension for channel routing

### Integration with Cloud Service
- Export data can feed into cloud-based analytics
- JSON format compatible with most databases
- Use for automated trade analysis and season tracking

## 📝 Version History

### v1.0.0 (Current)
- Initial release with core draft monitoring
- Discord webhook integration
- AI analysis request system
- Draft export functionality
- Snake draft position calculation

---

**Support**: For issues or questions, check the main Fantasy Command Center documentation or Discord server.