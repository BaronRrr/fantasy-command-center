# 🚀 Cloud Deployment Guide

Deploy your Fantasy Command Center to the cloud for **24/7 automatic notifications**!

## ☁️ Quick Deploy to Railway.app (FREE)

### Step 1: Prepare Your Code
```bash
# Create a GitHub repository
git init
git add .
git commit -m "Initial Fantasy Command Center setup"
git branch -M main
git remote add origin https://github.com/yourusername/fantasy-command-center.git
git push -u origin main
```

### Step 2: Deploy to Railway
1. Go to [Railway.app](https://railway.app)
2. Sign up with GitHub account
3. Click "Deploy from GitHub repo"
4. Select your `fantasy-command-center` repository
5. Railway auto-detects Node.js and deploys!

### Step 3: Add Environment Variables
In Railway dashboard, go to Variables tab and add:
```
DISCORD_BOT_TOKEN=your_discord_bot_token
CLAUDE_API_KEY=your_claude_api_key
NODE_ENV=production
TZ=America/New_York
LOG_LEVEL=info
```

### Step 4: Deploy!
- Railway automatically starts your bot
- Check logs to verify it's running
- Your Discord will start receiving notifications!

---

## 🔔 What You'll Get

### Daily Notifications
- **8:00 AM EST**: Morning intelligence report
  - Overnight injury updates
  - Reddit trending players  
  - Breaking news digest
  - Fantasy opportunities

- **6:00 PM EST**: Evening wrap-up
  - Day's key developments
  - Tomorrow's focus areas
  - Waiver wire insights

### Real-Time Alerts
- **Major injuries** (within 5 minutes)
- **Depth chart changes**
- **Breaking trade news**
- **Surprise inactive lists**
- **Starting lineup changes**

### Weekly Summary
- **Sunday 10:00 AM EST**: Full week recap
- **Trending waiver pickups**
- **ADP movers and shakers**
- **Upcoming week preview**

---

## 💰 Cost Breakdown

### Railway.app FREE Tier
- **$0/month** (includes $5 credit)
- **500 hours runtime** (easily covers 24/7)
- **Perfect for small bots**

### API Costs
- **Claude AI**: ~$3-5/month for monitoring requests
- **Total Monthly**: $3-5 (vs $60+ for traditional tools)

---

## 🎯 Deployment Checklist

✅ **Required Files:**
- [x] `Procfile` - Railway startup command
- [x] `.env.example` - Environment template  
- [x] `package.json` - Dependencies
- [x] `start-discord-bot.js` - Main entry point

✅ **Environment Variables:**
- [x] `DISCORD_BOT_TOKEN`
- [x] `CLAUDE_API_KEY`
- [x] `NODE_ENV=production`

✅ **Features Activated:**
- [x] 24/7 Discord bot monitoring
- [x] Scheduled daily reports
- [x] Real-time breaking news alerts
- [x] Twitter monitoring active
- [x] Multi-source data aggregation

---

## 🚀 Alternative Deployment Options

### Vercel (Serverless)
```bash
npm install -g vercel
vercel --prod
```

### Render.com (Free tier)
1. Connect GitHub repo
2. Select "Web Service"
3. Use build command: `npm install`
4. Use start command: `node start-discord-bot.js`

### Fly.io (Docker)
```bash
fly launch
fly deploy
```

---

## 🔧 Troubleshooting

### Bot Not Starting
- Check environment variables are set
- Verify Discord bot token is valid
- Check Railway logs for errors

### No Notifications Received
- Verify bot has permissions in Discord server
- Check timezone settings (should be America/New_York)
- Ensure NODE_ENV=production for scheduled notifications

### High Usage/Costs
- Monitor Railway usage dashboard
- Adjust notification frequency if needed
- Consider upgrading to paid tier if needed

---

## 📱 Testing Your Deployment

Once deployed, test with Discord commands:
```
.update              # Verify data monitoring works
.intel               # Check intelligence gathering  
.monitor             # Confirm all systems active
```

**Expected result**: Your Discord will start receiving automated fantasy intelligence reports twice daily, plus real-time alerts for breaking news!

---

## 🎉 You're Live!

Your Fantasy Command Center is now running 24/7 in the cloud, automatically monitoring fantasy football news and sending you intelligence reports. 

**No more manual updates needed** - your Discord will light up with valuable fantasy intel! 🏈⚡