const axios = require('axios');

// Test notification functions for different channels

async function testPracticeChannelAlert() {
  const practiceWebhookUrl = process.env.PRACTICE_WEBHOOK_URL || 'https://discord.com/api/webhooks/1407573210593230949/49oispk9IkCr9_0TuE69WpYjaOqvacwqzhCQh3gwTu37OOzXcPzupJa2LpWYwLGC7mNN';
  
  const testEmbed = {
    title: '🏈 TEST: Practice Report Alert',
    description: 'Christian McCaffrey - SF',
    color: 0xFFFF00,
    fields: [
      {
        name: '📋 Practice Status',
        value: 'Limited Practice',
        inline: true
      },
      {
        name: '🏥 Injury',
        value: 'Knee (rest)',
        inline: true
      },
      {
        name: '📊 Fantasy Impact',
        value: 'Monitor closely - likely to play',
        inline: false
      }
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: 'TEST ALERT • Practice Monitor'
    }
  };

  try {
    await axios.post(practiceWebhookUrl, {
      content: '🧪 **This is a test alert for the Practice Channel**',
      embeds: [testEmbed]
    });
    console.log('✅ Practice channel test alert sent successfully!');
  } catch (error) {
    console.error('❌ Practice channel test failed:', error.message);
  }
}

async function testMainChannelAlert() {
  // This would go to your main Discord bot channels
  console.log('📊 **TEST: Main Channel Alert**');
  console.log('This would be sent to your main Discord channels via the bot');
  console.log('Example: Depth chart changes, general fantasy news, trending players');
}

async function testNewsChannelAlert() {
  // This would go to #newsarticles channel
  console.log('📰 **TEST: News Channel Alert**');
  console.log('This would be sent to #newsarticles channel');
  console.log('Example: Breaking news, injury reports, transactions');
}

async function testDepthChartAlert() {
  console.log('📊 **TEST: Depth Chart Alert**');
  console.log('Channel: Main Discord channels (via Discord bot)');
  console.log('Example: Starter changes, position movements, handcuff opportunities');
  
  const testDepthAlert = {
    title: '📊 TEST: Depth Chart Update - SF RB',
    description: '🚨 **STARTER CHANGE**: Jordan Mason replaces Christian McCaffrey as #1',
    color: 0xFF0000,
    fields: [
      {
        name: '📈 New Depth Chart',
        value: '1. Jordan Mason\n2. Christian McCaffrey\n3. Isaac Guerendo',
        inline: true
      },
      {
        name: '📉 Previous Depth Chart', 
        value: '1. Christian McCaffrey\n2. Jordan Mason\n3. Isaac Guerendo',
        inline: true
      },
      {
        name: '🎯 Fantasy Impact',
        value: 'Major opportunity change! Jordan Mason likely sees increased usage. Christian McCaffrey value decreases significantly.',
        inline: false
      }
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: 'TEST ALERT • Depth Chart Monitor'
    }
  };
  
  console.log('This alert would be sent via Discord bot to main channels');
}

async function testOfficialInjuryAlert() {
  console.log('🏥 **TEST: Official Injury Report Alert**');
  console.log('Channel: Main Discord channels (via Discord bot)');
  console.log('Schedule: Wed/Thu/Fri 4:15 PM EST');
  
  const testInjuryAlert = {
    title: '🚨 TEST: NEW INJURY REPORT',
    description: '**Christian McCaffrey** (RB - SF)',
    color: 0xFF8800,
    fields: [
      {
        name: '🏥 Injury',
        value: 'Knee',
        inline: true
      },
      {
        name: '🏃 Practice Status',
        value: 'Limited Practice',
        inline: true
      },
      {
        name: '📊 Game Status',
        value: 'Questionable',
        inline: true
      },
      {
        name: '🏈 Play Probability',
        value: '75%',
        inline: true
      },
      {
        name: '🎯 Fantasy Impact',
        value: 'Game-time decision - have backup plan ready',
        inline: false
      }
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: 'TEST ALERT • NFL.com Official Report'
    }
  };
  
  console.log('This alert would be sent via Discord bot to main channels');
}

async function runAllTests() {
  console.log('🧪 **TESTING ALL NOTIFICATION CHANNELS**\n');
  
  console.log('1. 🏈 PRACTICE CHANNEL TEST (Dedicated Webhook)');
  console.log('   Channel: Your dedicated practice monitoring channel');
  console.log('   Webhook: Practice webhook URL you configured');
  console.log('   Content: Practice status changes, weekly summaries');
  await testPracticeChannelAlert();
  console.log('');
  
  console.log('2. 📊 MAIN CHANNELS TEST (Discord Bot)');
  console.log('   Channel: Main Discord server channels');
  console.log('   Method: Discord bot messages');
  console.log('   Content: Depth charts, general alerts, trending');
  testMainChannelAlert();
  console.log('');
  
  console.log('3. 📰 NEWS CHANNEL TEST (Discord Bot)');
  console.log('   Channel: #newsarticles or configured news channel');
  console.log('   Method: Discord bot messages'); 
  console.log('   Content: Breaking news, articles, RSS feeds');
  testNewsChannelAlert();
  console.log('');
  
  console.log('4. 📊 DEPTH CHART ALERTS (Discord Bot)');
  testDepthChartAlert();
  console.log('');
  
  console.log('5. 🏥 OFFICIAL INJURY ALERTS (Discord Bot)');
  testOfficialInjuryAlert();
  console.log('');
  
  console.log('🎯 **SUMMARY - WHERE ALERTS GO:**');
  console.log('• Practice Alerts → Your dedicated practice webhook channel');
  console.log('• Depth Chart Changes → Main Discord channels (via bot)');
  console.log('• Official Injury Reports → Main Discord channels (via bot)');
  console.log('• Breaking News → #newsarticles channel (via bot)');
  console.log('• General Fantasy Updates → Main Discord channels (via bot)');
}

// Run tests
runAllTests().catch(console.error);