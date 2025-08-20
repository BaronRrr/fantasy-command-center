const axios = require('axios');

async function sendDepthChartTest() {
  const practiceWebhookUrl = process.env.PRACTICE_WEBHOOK_URL || 'https://discord.com/api/webhooks/1407573210593230949/49oispk9IkCr9_0TuE69WpYjaOqvacwqzhCQh3gwTu37OOzXcPzupJa2LpWYwLGC7mNN';
  
  const depthChartEmbed = {
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

  try {
    await axios.post(practiceWebhookUrl, {
      content: '🧪 **This is a test DEPTH CHART alert for the Practice Channel**',
      embeds: [depthChartEmbed]
    });
    console.log('✅ Depth chart test alert sent to practice channel!');
  } catch (error) {
    console.error('❌ Depth chart test failed:', error.message);
  }
}

async function sendInjuryReportTest() {
  const practiceWebhookUrl = process.env.PRACTICE_WEBHOOK_URL || 'https://discord.com/api/webhooks/1407573210593230949/49oispk9IkCr9_0TuE69WpYjaOqvacwqzhCQh3gwTu37OOzXcPzupJa2LpWYwLGC7mNN';
  
  const injuryEmbed = {
    title: '🚨 TEST: NEW INJURY REPORT',
    description: '**Saquon Barkley** (RB - PHI)',
    color: 0xFF8800,
    fields: [
      {
        name: '🏥 Injury',
        value: 'Ankle',
        inline: true
      },
      {
        name: '🏃 Practice Status',
        value: 'Did Not Practice',
        inline: true
      },
      {
        name: '📊 Game Status',
        value: 'Doubtful',
        inline: true
      },
      {
        name: '🏈 Play Probability',
        value: '25%',
        inline: true
      },
      {
        name: '🎯 Fantasy Impact',
        value: 'Very unlikely to play - have backup ready!',
        inline: false
      }
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: 'TEST ALERT • NFL.com Official Report'
    }
  };

  try {
    await axios.post(practiceWebhookUrl, {
      content: '🧪 **This is a test OFFICIAL INJURY REPORT alert for the Practice Channel**',
      embeds: [injuryEmbed]
    });
    console.log('✅ Official injury test alert sent to practice channel!');
  } catch (error) {
    console.error('❌ Injury test failed:', error.message);
  }
}

async function sendBreakingNewsTest() {
  const practiceWebhookUrl = process.env.PRACTICE_WEBHOOK_URL || 'https://discord.com/api/webhooks/1407573210593230949/49oispk9IkCr9_0TuE69WpYjaOqvacwqzhCQh3gwTu37OOzXcPzupJa2LpWYwLGC7mNN';
  
  const newsEmbed = {
    title: '🚨 TEST: BREAKING NEWS ALERT',
    description: 'Fantasy Football Trade News',
    color: 0x00FF00,
    fields: [
      {
        name: '📰 Breaking News',
        value: 'TEST: Major trade sends elite WR to contending team',
        inline: false
      },
      {
        name: '🎯 Fantasy Impact',
        value: 'Monitor target share changes and new offensive opportunities',
        inline: false
      },
      {
        name: '📊 Players Affected',
        value: '• Player A - Increased targets\n• Player B - Decreased role\n• Player C - New opportunity',
        inline: false
      }
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: 'TEST ALERT • Breaking News Monitor'
    }
  };

  try {
    await axios.post(practiceWebhookUrl, {
      content: '🧪 **This is a test BREAKING NEWS alert for the Practice Channel**',
      embeds: [newsEmbed]
    });
    console.log('✅ Breaking news test alert sent to practice channel!');
  } catch (error) {
    console.error('❌ Breaking news test failed:', error.message);
  }
}

async function sendWeeklySummaryTest() {
  const practiceWebhookUrl = process.env.PRACTICE_WEBHOOK_URL || 'https://discord.com/api/webhooks/1407573210593230949/49oispk9IkCr9_0TuE69WpYjaOqvacwqzhCQh3gwTu37OOzXcPzupJa2LpWYwLGC7mNN';
  
  const summaryEmbed = {
    title: '📋 TEST: Weekly Practice Summary',
    description: `Practice participation report for your watchlist players`,
    color: 0x00FF00,
    fields: [
      {
        name: '🚨 High Risk Players',
        value: '**Christian McCaffrey** (SF)\nTue: ❌ | Wed: ❌ | Thu: ⚠️ | Fri: ❓',
        inline: false
      },
      {
        name: '⚠️ Monitor Closely',
        value: '**Saquon Barkley** (PHI)\nTue: ✅ | Wed: ⚠️ | Thu: ⚠️ | Fri: ❓',
        inline: false
      },
      {
        name: '✅ Good to Go',
        value: '**Josh Allen** (BUF)\nTue: ✅ | Wed: ✅ | Thu: ✅ | Fri: ❓',
        inline: false
      },
      {
        name: '📊 This Week\'s Summary',
        value: `**Total Players:** 3\n**High Risk:** 1 🚨\n**Medium Risk:** 1 ⚠️\n**Low Risk:** 1 ✅\n\n*Game day approaches - check final injury reports Saturday!*`,
        inline: false
      }
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: 'TEST ALERT • Weekly Practice Summary'
    }
  };

  try {
    await axios.post(practiceWebhookUrl, {
      content: '🧪 **This is a test WEEKLY PRACTICE SUMMARY for the Practice Channel**',
      embeds: [summaryEmbed]
    });
    console.log('✅ Weekly practice summary test sent to practice channel!');
  } catch (error) {
    console.error('❌ Weekly summary test failed:', error.message);
  }
}

async function runAllAlerts() {
  console.log('🧪 **SENDING ALL TEST ALERTS TO YOUR PRACTICE CHANNEL**\n');
  
  console.log('1. 🏈 Sending Practice Status Alert...');
  // Previous practice alert already sent
  
  console.log('2. 📊 Sending Depth Chart Alert...');
  await sendDepthChartTest();
  
  console.log('3. 🏥 Sending Official Injury Report Alert...');
  await sendInjuryReportTest();
  
  console.log('4. 🚨 Sending Breaking News Alert...');
  await sendBreakingNewsTest();
  
  console.log('5. 📋 Sending Weekly Practice Summary...');
  await sendWeeklySummaryTest();
  
  console.log('\n✅ **ALL TEST ALERTS SENT!**');
  console.log('Check your practice channel - you should see 5 different types of alerts:');
  console.log('• Practice Status Alert (already sent)');
  console.log('• Depth Chart Change Alert');
  console.log('• Official Injury Report Alert');
  console.log('• Breaking News Alert');
  console.log('• Weekly Practice Summary');
}

runAllAlerts().catch(console.error);