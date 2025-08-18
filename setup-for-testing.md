# 🧪 Testing Your Fantasy Command Center

Since you don't have a live fantasy league yet, here's how to test and familiarize yourself with the system using mock data.

## 🚀 Quick Setup for Testing

### 1. **Create Basic Environment File**
```bash
cp .env.example .env
```

Edit the `.env` file with minimal config for testing:
```bash
# Mock ESPN data (not real league)
ESPN_LEAGUE_ID=MOCK_123456
ESPN_SEASON=2025

# Optional: Add Claude API key for real AI analysis
CLAUDE_API_KEY=your_claude_api_key_if_you_have_it

# Optional: Add Discord webhook for notification testing
DISCORD_WEBHOOK_URL=your_discord_webhook_if_you_want_alerts

# Database (SQLite for testing)
DATABASE_URL=sqlite:./database/fantasy.db
NODE_ENV=development
```

### 2. **Setup Database**
```bash
npm run migrate
```

### 3. **Test the Mock Draft System**
```bash
# Run the interactive mock draft demo
node src/scripts/mock-draft-demo.js
```

## 🎯 What the Mock Draft Demo Shows You

### **Real Draft Experience Simulation:**
- You're **Team 6** in a 12-team league
- Your picks: 6, 19, 30, 43, 54, 67, etc. (snake draft)
- System alerts you when your turn approaches
- AI provides instant recommendations
- Discord notifications (if webhook configured)

### **Sample Output:**
```
🎯 Starting Mock Draft Simulation...
   You are Team 6 - picks 6, 19, 30, 43, etc.

📋 PICK 1: Christian McCaffrey (RB) → Team 1
📋 PICK 2: Josh Allen (QB) → Team 2
📋 PICK 3: Cooper Kupp (WR) → Team 3
📋 PICK 4: Travis Kelce (TE) → Team 4
📋 PICK 5: Stefon Diggs (WR) → Team 5

⏰ Your turn in 1 picks
🤖 AI Analysis: 3 recommendations
   Top Pick: Amon-Ra St. Brown (HIGH) - Elite target share in high-powered offense...

🚨 YOUR TURN! 🚨
   ⏰ You have 90 seconds to decide...
```

## 🤖 AI Recommendations Example

When it's your turn, you'll see detailed analysis like:
```
🎯 TOP RECOMMENDATION: Amon-Ra St. Brown (WR, DET)
• Urgency: HIGH
• Value: 9/10 
• Risk: LOW
• Reasoning: "Elite target share in high-powered offense. Goff's favorite weapon 
  with 140+ targets likely. Great value at this spot."

💎 STEAL ALERT: Stefon Diggs - normally Round 2 pick
⚠️ THREAT: Amon-Ra St. Brown likely taken in next 2-3 picks
📈 STRATEGY: Focus on positional scarcity and value opportunities
```

## 📱 Testing Other Features

### **1. API Endpoints Test:**
```bash
# Start the server
npm run dev

# Test in another terminal:
curl http://localhost:3000/health
curl "http://localhost:3000/players/search?query=Josh%20Allen"
curl -X POST http://localhost:3000/notifications/test
```

### **2. Player Search Test:**
```bash
# Search for specific players
curl "http://localhost:3000/players/search?query=Cooper"

# Get players by position  
curl "http://localhost:3000/players/position/QB"
```

### **3. Discord Notification Test:**
If you set up a Discord webhook:
```bash
curl -X POST http://localhost:3000/notifications/test
```

## 🎮 Interactive Testing Options

### **Option 1: Full Mock Draft (20 minutes)**
```bash
node src/scripts/mock-draft-demo.js
```
- Simulates complete 16-round draft
- Shows all notifications and AI analysis
- You can see how the system works in real-time

### **Option 2: Quick Feature Test (2 minutes)**
```bash
node src/scripts/test-draft-monitor.js
```
- Tests core functionality quickly
- Verifies all components work
- Good for troubleshooting

### **Option 3: Manual API Testing**
```bash
npm run dev
# Then use curl commands or browser to test endpoints
```

## 🔧 Customizing for Your League

### **When You Get Your Real League:**

1. **Update ESPN Settings:**
```bash
# In .env file:
ESPN_LEAGUE_ID=your_actual_league_id
ESPN_S2_COOKIE=your_s2_cookie  # if private league
ESPN_SWID=your_swid_cookie     # if private league
```

2. **Test Real Connection:**
```bash
curl -X POST http://localhost:3000/draft/start
curl http://localhost:3000/draft/status
```

3. **Verify Your Team Detection:**
The system will automatically try to identify your team. Check the logs to make sure it picks the right one.

## 💡 Pro Tips for Testing

### **1. Test Different Scenarios:**
- Early round picks (studs available)
- Middle rounds (value hunting)
- Late rounds (sleepers and handcuffs)
- When your target gets taken
- Injury news breaking mid-draft

### **2. Discord Setup:**
Create a private Discord server for testing:
1. Create server → Settings → Integrations → Webhooks
2. Create webhook for #fantasy-alerts channel
3. Copy webhook URL to `.env` file
4. Test notifications during mock draft

### **3. AI Analysis Testing:**
If you have a Claude API key:
- Test different draft positions
- See how recommendations change by round
- Verify urgency levels make sense

### **4. Prepare for Draft Day:**
- Run mock draft several times
- Get familiar with Discord alerts
- Test on your phone/tablet
- Verify all APIs are working

## 🎯 What You'll Learn from Testing

### **System Capabilities:**
- How quickly picks are detected (5-second intervals)
- AI recommendation quality and speed
- Discord notification timing
- Player search functionality

### **Draft Strategy Insights:**
- Value identification at different rounds
- Position scarcity understanding
- ADP vs current availability analysis
- Risk/reward assessment

### **Competitive Advantages:**
- Real-time intelligence while others manually track
- AI analysis considering multiple factors
- Automated alerts for critical moments
- League-wide roster visibility

## 🚨 Ready for Your Real Draft

After testing with mock data, you'll be prepared to:

1. **Connect to your real ESPN league** (just change league ID)
2. **Start monitoring instantly** when draft begins
3. **Get AI recommendations** for every pick decision
4. **Receive critical alerts** via Discord
5. **Dominate your league** with data-driven decisions

**Your opponents will have no idea what hit them!** 😈

---

Start with the mock draft demo to see the full system in action:
```bash
node src/scripts/mock-draft-demo.js
```