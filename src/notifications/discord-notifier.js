const axios = require('axios');
const config = require('../../config');

class DiscordNotifier {
  constructor() {
    this.webhookUrl = config.discord.webhookUrl || config.notifications.discord.webhookURL;
    this.colors = config.notifications.discord.colors;
  }

  async sendNotification(notification, channel = 'draft-central') {
    if (!this.webhookUrl) {
      console.log('📢 NOTIFICATION (Discord disabled):');
      console.log(`   ${notification.title}`);
      console.log(`   ${notification.description}`);
      return;
    }

    try {
      const payload = {
        embeds: [{
          title: notification.title,
          description: notification.description,
          color: notification.color || this.colors.INFO,
          fields: notification.fields || [],
          timestamp: notification.timestamp || new Date().toISOString(),
          footer: {
            text: `Fantasy Command Center • ${channel}`
          }
        }]
      };

      await axios.post(this.webhookUrl, payload);
      console.log(`✅ Discord notification sent to ${channel}`);

    } catch (error) {
      console.error('❌ Failed to send Discord notification:', error.message);
      // Still log the notification locally
      console.log('📢 NOTIFICATION:');
      console.log(`   ${notification.title}`);
      console.log(`   ${notification.description}`);
    }
  }

  async sendDraftAlert(pick) {
    const notification = {
      title: pick.isYour ? '🎯 YOUR DRAFT PICK!' : '📊 Draft Pick',
      description: `**${pick.player.name}**\n${pick.player.position} - ${pick.player.team}\nRound ${pick.round}, Pick ${pick.overall}`,
      color: pick.isYour ? 0xFF6B35 : 0x4A90E2
    };

    await this.sendNotification(notification, 'draft-central');
  }

  async sendConnectionAlert() {
    const notification = {
      title: '🚀 Draft Monitor Connected!',
      description: 'Real-time draft monitoring is now active.\nReady to track picks and provide AI recommendations!',
      color: this.colors.INFO
    };

    await this.sendNotification(notification, 'draft-central');
  }
}

module.exports = DiscordNotifier;