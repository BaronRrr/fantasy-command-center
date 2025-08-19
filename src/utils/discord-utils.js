const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class DiscordUtils {
  constructor() {
    this.retryDelays = [250, 500, 1000, 2000, 5000]; // Exponential backoff
  }

  /**
   * Send message with automatic retry and rate limit handling
   * @param {Function} sendFunction - The Discord send function to execute
   * @param {Object} payload - Message payload
   * @param {number} attempt - Current attempt number (for internal use)
   * @returns {Promise} Send result
   */
  async sendWithBackoff(sendFunction, payload, attempt = 1) {
    try {
      const result = await sendFunction(payload);
      if (attempt > 1) {
        logger.info(`✅ Discord send succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      // Handle rate limiting (429 status)
      if (error?.status === 429 && attempt < this.retryDelays.length) {
        const retryAfter = error.retry_after || this.retryDelays[attempt - 1];
        const waitTime = Math.min(retryAfter * 1000, 5000); // Cap at 5 seconds
        
        logger.warn(`⏳ Discord rate limited, waiting ${waitTime}ms (attempt ${attempt})`);
        await this.sleep(waitTime);
        return this.sendWithBackoff(sendFunction, payload, attempt + 1);
      }

      // Handle other retryable errors
      if (this.isRetryableError(error) && attempt < this.retryDelays.length) {
        const waitTime = this.retryDelays[attempt - 1];
        logger.warn(`🔄 Discord send failed, retrying in ${waitTime}ms (attempt ${attempt}): ${error.message}`);
        await this.sleep(waitTime);
        return this.sendWithBackoff(sendFunction, payload, attempt + 1);
      }

      // Log final failure and throw
      logger.error(`❌ Discord send failed after ${attempt} attempts:`, {
        error: error.message,
        status: error.status,
        code: error.code
      });
      throw error;
    }
  }

  /**
   * Send webhook message with retry logic
   * @param {string} webhookUrl - Discord webhook URL
   * @param {Object} payload - Message payload
   * @returns {Promise} Send result
   */
  async sendWebhook(webhookUrl, payload) {
    const axios = require('axios');
    
    const sendFunction = async (data) => {
      return await axios.post(webhookUrl, data, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    };

    return this.sendWithBackoff(sendFunction, payload);
  }

  /**
   * Send message to Discord channel with retry logic
   * @param {Object} channel - Discord channel object
   * @param {Object} payload - Message payload
   * @returns {Promise} Send result
   */
  async sendToChannel(channel, payload) {
    const sendFunction = async (data) => {
      if (typeof data === 'string') {
        return await channel.send(data);
      } else if (data.embeds) {
        return await channel.send({ embeds: data.embeds });
      } else {
        return await channel.send(data);
      }
    };

    return this.sendWithBackoff(sendFunction, payload);
  }

  /**
   * Validate Discord embed for size limits
   * @param {Object} embed - Discord embed object
   * @returns {Object} Validated and potentially truncated embed
   */
  validateEmbed(embed) {
    const limits = {
      title: 256,
      description: 4096,
      fieldName: 256,
      fieldValue: 1024,
      footerText: 2048,
      authorName: 256,
      totalFields: 25,
      totalCharacters: 6000
    };

    // Truncate title
    if (embed.title && embed.title.length > limits.title) {
      embed.title = embed.title.substring(0, limits.title - 3) + '...';
    }

    // Truncate description
    if (embed.description && embed.description.length > limits.description) {
      embed.description = embed.description.substring(0, limits.description - 3) + '...';
    }

    // Validate fields
    if (embed.fields) {
      embed.fields = embed.fields.slice(0, limits.totalFields);
      embed.fields = embed.fields.map(field => ({
        ...field,
        name: field.name.length > limits.fieldName 
          ? field.name.substring(0, limits.fieldName - 3) + '...'
          : field.name,
        value: field.value.length > limits.fieldValue
          ? field.value.substring(0, limits.fieldValue - 3) + '...'
          : field.value
      }));
    }

    // Truncate footer
    if (embed.footer?.text && embed.footer.text.length > limits.footerText) {
      embed.footer.text = embed.footer.text.substring(0, limits.footerText - 3) + '...';
    }

    // Calculate total character count and truncate if needed
    const totalChars = this.calculateEmbedSize(embed);
    if (totalChars > limits.totalCharacters) {
      logger.warn(`⚠️ Embed too large (${totalChars} chars), truncating description`);
      const excess = totalChars - limits.totalCharacters + 100; // Buffer
      if (embed.description) {
        embed.description = embed.description.substring(0, embed.description.length - excess - 3) + '...';
      }
    }

    return embed;
  }

  /**
   * Calculate total character count in an embed
   * @param {Object} embed - Discord embed object
   * @returns {number} Total character count
   */
  calculateEmbedSize(embed) {
    let total = 0;
    
    if (embed.title) total += embed.title.length;
    if (embed.description) total += embed.description.length;
    if (embed.footer?.text) total += embed.footer.text.length;
    if (embed.author?.name) total += embed.author.name.length;
    
    if (embed.fields) {
      total += embed.fields.reduce((sum, field) => 
        sum + field.name.length + field.value.length, 0);
    }
    
    return total;
  }

  /**
   * Check if an error is retryable
   * @param {Error} error - Error object
   * @returns {boolean} Whether the error is retryable
   */
  isRetryableError(error) {
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    const retryableCodes = ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];
    
    return retryableStatuses.includes(error.status) || 
           retryableCodes.includes(error.code) ||
           error.message?.includes('timeout');
  }

  /**
   * Sleep utility function
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after the delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a safe embed object with validation
   * @param {Object} embedData - Raw embed data
   * @returns {Object} Safe, validated embed
   */
  createSafeEmbed(embedData) {
    const embed = {
      title: embedData.title || '',
      description: embedData.description || '',
      color: embedData.color || 0x4A90E2,
      timestamp: embedData.timestamp || new Date().toISOString(),
      footer: embedData.footer || { text: 'Fantasy Command Center' },
      fields: embedData.fields || []
    };

    return this.validateEmbed(embed);
  }

  /**
   * Send error notification to ops channel (if configured)
   * @param {string} error - Error message
   * @param {Object} context - Additional context
   */
  async sendErrorAlert(error, context = {}) {
    try {
      const opsWebhook = process.env.DISCORD_OPS_WEBHOOK;
      if (!opsWebhook) return;

      const embed = this.createSafeEmbed({
        title: '🚨 System Error Alert',
        description: `Error: ${error.message || error}`,
        color: 0xFF0000,
        fields: [
          {
            name: 'Context',
            value: JSON.stringify(context, null, 2).substring(0, 1000),
            inline: false
          },
          {
            name: 'Timestamp',
            value: new Date().toISOString(),
            inline: true
          }
        ]
      });

      await this.sendWebhook(opsWebhook, { embeds: [embed] });
    } catch (alertError) {
      logger.error('Failed to send error alert:', alertError.message);
    }
  }
}

module.exports = new DiscordUtils();