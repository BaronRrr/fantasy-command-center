/**
 * Discord Webhook for Trade Suggestions
 * Sends AI-powered trade analysis directly to Discord channel
 */
const axios = require('axios');
const createLogger = require('../utils/logger');

const logger = createLogger();

class TradeWebhook {
  constructor() {
    this.webhookUrl = 'https://discord.com/api/webhooks/1408224618850029689/4mpK7R-7LebdWvJgND3ydNxikk0TdY2WCsJMY8BAog2fdnJCW43LRLl8-K-Do5TYH8Sz';
    this.retryAttempts = 3;
  }

  /**
   * Send trade analysis to Discord
   */
  async sendTradeAnalysis(teamName, analysis) {
    try {
      const embed = this.createTradeEmbed(teamName, analysis);
      
      const payload = {
        username: 'Trade Analyzer',
        avatar_url: 'https://cdn.discordapp.com/emojis/💼.png',
        embeds: [embed]
      };

      await this.sendWithRetry(payload);
      logger.info(`✅ Trade analysis sent to Discord for ${teamName}`);
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to send trade analysis to Discord:', error.message);
      throw error;
    }
  }

  /**
   * Send trade suggestions to Discord
   */
  async sendTradeSuggestions(teamName, suggestions) {
    try {
      if (!suggestions || suggestions.length === 0) {
        return { success: false, message: 'No trade suggestions to send' };
      }

      for (let i = 0; i < suggestions.length; i++) {
        const suggestion = suggestions[i];
        const embed = this.createTradeSuggestionEmbed(teamName, suggestion, i + 1, suggestions.length);
        
        const payload = {
          username: 'AI Trade Advisor',
          avatar_url: 'https://cdn.discordapp.com/emojis/🤖.png',
          embeds: [embed]
        };

        await this.sendWithRetry(payload);
        
        // Small delay between messages to avoid rate limits
        if (i < suggestions.length - 1) {
          await this.delay(1000);
        }
      }

      logger.info(`✅ ${suggestions.length} trade suggestions sent to Discord for ${teamName}`);
      return { success: true, count: suggestions.length };
    } catch (error) {
      logger.error('Failed to send trade suggestions to Discord:', error.message);
      throw error;
    }
  }

  /**
   * Create embed for trade analysis overview
   */
  createTradeEmbed(teamName, analysis) {
    const strengthsText = analysis.strengths.map(s => 
      `• **${s.position}**: ${s.reason}`
    ).join('\n') || 'No clear strengths identified';

    const needsText = analysis.needs.map(n => 
      `• **${n.position}** (Priority: ${n.priority}): ${n.reason}`
    ).join('\n') || 'No major needs identified';

    const tradeableText = analysis.tradeable.slice(0, 5).map(t => 
      `• **${t.name}** (${t.position}) - ${t.reason}`
    ).join('\n') || 'No obvious tradeable assets';

    return {
      title: `📊 Trade Analysis: ${teamName}`,
      color: 0x00ff00,
      description: `AI-powered team composition analysis`,
      fields: [
        {
          name: '💪 Team Strengths',
          value: strengthsText,
          inline: false
        },
        {
          name: '🎯 Priority Needs',
          value: needsText,
          inline: false
        },
        {
          name: '🔄 Tradeable Assets',
          value: tradeableText,
          inline: false
        },
        {
          name: '📈 Market Trends',
          value: `Rising: ${analysis.marketTrends?.rising?.join(', ') || 'N/A'}\nFalling: ${analysis.marketTrends?.falling?.join(', ') || 'N/A'}`,
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Fantasy Command Center • AI Trade Analysis'
      }
    };
  }

  /**
   * Create embed for individual trade suggestion
   */
  createTradeSuggestionEmbed(teamName, suggestion, index, total) {
    const giveText = suggestion.trade?.give?.join(', ') || 'Unknown players';
    const receiveText = suggestion.trade?.receive?.join(', ') || 'Unknown players';
    const fairnessStars = '⭐'.repeat(Math.min(5, Math.max(1, suggestion.fairness || 5)));
    const riskText = suggestion.risks?.join('\n• ') || 'No major risks identified';

    return {
      title: `💼 Trade Suggestion ${index}/${total} for ${teamName}`,
      color: suggestion.fairness >= 8 ? 0x00ff00 : suggestion.fairness >= 6 ? 0xffff00 : 0xff9900,
      description: `Trading with **${suggestion.partner}**`,
      fields: [
        {
          name: '📤 You Give',
          value: giveText,
          inline: true
        },
        {
          name: '📥 You Receive', 
          value: receiveText,
          inline: true
        },
        {
          name: '⚖️ Fairness Rating',
          value: `${fairnessStars} (${suggestion.fairness}/10)`,
          inline: false
        },
        {
          name: '🧠 AI Reasoning',
          value: suggestion.reasoning || 'Analysis pending...',
          inline: false
        },
        {
          name: '⚠️ Potential Risks',
          value: `• ${riskText}`,
          inline: false
        },
        {
          name: '🎯 Compatibility Score',
          value: `${suggestion.compatibility}/100`,
          inline: true
        },
        {
          name: '📊 Trade Score',
          value: `${suggestion.score}/10`,
          inline: true
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: `Fantasy Command Center • AI Trade Advisor • Suggestion ${index}/${total}`
      }
    };
  }

  /**
   * Send payload with retry logic
   */
  async sendWithRetry(payload, attempt = 1) {
    try {
      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.status === 204) {
        return { success: true };
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      if (attempt < this.retryAttempts) {
        logger.warn(`Webhook attempt ${attempt} failed, retrying...`, error.message);
        await this.delay(1000 * attempt); // Exponential backoff
        return this.sendWithRetry(payload, attempt + 1);
      } else {
        throw new Error(`Webhook failed after ${this.retryAttempts} attempts: ${error.message}`);
      }
    }
  }

  /**
   * Send quick trade alert
   */
  async sendTradeAlert(message, urgency = 'MEDIUM') {
    try {
      const colors = {
        LOW: 0x808080,      // Gray
        MEDIUM: 0x0099ff,   // Blue
        HIGH: 0xff9900,     // Orange
        CRITICAL: 0xff0000  // Red
      };

      const embed = {
        title: '🚨 Trade Alert',
        description: message,
        color: colors[urgency] || colors.MEDIUM,
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Fantasy Command Center • Trade Monitor'
        }
      };

      const payload = {
        username: 'Trade Monitor',
        embeds: [embed]
      };

      await this.sendWithRetry(payload);
      return { success: true };
    } catch (error) {
      logger.error('Failed to send trade alert:', error.message);
      throw error;
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test webhook connection
   */
  async testConnection() {
    try {
      const testEmbed = {
        title: '🧪 Trade Webhook Test',
        description: 'Testing Discord webhook connection for trade suggestions',
        color: 0x00ff00,
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Fantasy Command Center • Connection Test'
        }
      };

      const payload = {
        username: 'Trade Webhook Test',
        embeds: [testEmbed]
      };

      await this.sendWithRetry(payload);
      logger.info('✅ Trade webhook test successful');
      return { success: true, message: 'Webhook connection verified' };
    } catch (error) {
      logger.error('❌ Trade webhook test failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = TradeWebhook;