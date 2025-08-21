/**
 * Improved Claude AI Service
 * Enhanced with proper error handling, rate limiting, and validation
 */
const axios = require('axios');
const config = require('../config/environment');
const createLogger = require('../utils/logger');
const errorHandler = require('../utils/error-handler');
const { Validator, ValidationError } = require('../utils/validation');

const logger = createLogger();

class ImprovedClaudeAI {
  constructor() {
    this.apiKey = config.ai.claude.apiKey;
    this.model = config.ai.claude.model;
    this.maxTokens = config.ai.claude.maxTokens;
    this.temperature = config.ai.claude.temperature;
    this.baseURL = 'https://api.anthropic.com/v1/messages';
    
    // Rate limiting
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.rateLimitConfig = config.rateLimiting.claude;
    this.requestHistory = [];
    
    this.axiosInstance = axios.create({
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      }
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug('Claude AI request initiated');
        return config;
      },
      (error) => {
        logger.error('Claude AI request setup failed:', error.message);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug('Claude AI response received successfully');
        return response;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Validate messages array
   */
  validateMessages(messages) {
    Validator.validateArray(messages, 'messages', { 
      minLength: 1,
      itemValidator: (message, fieldName) => {
        Validator.validateObject(message, fieldName, {
          role: (value) => {
            const validRoles = ['user', 'assistant'];
            if (!validRoles.includes(value)) {
              throw new ValidationError('role', value, `one of: ${validRoles.join(', ')}`);
            }
            return value;
          },
          content: (value) => Validator.validateString(value, 'content', { 
            required: true, 
            minLength: 1,
            maxLength: 100000 
          })
        });
      }
    });
  }

  /**
   * Check rate limits
   */
  checkRateLimit() {
    const now = Date.now();
    const windowStart = now - this.rateLimitConfig.period;
    
    // Clean old requests from history
    this.requestHistory = this.requestHistory.filter(timestamp => timestamp > windowStart);
    
    if (this.requestHistory.length >= this.rateLimitConfig.requests) {
      const oldestRequest = Math.min(...this.requestHistory);
      const waitTime = oldestRequest + this.rateLimitConfig.period - now;
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`);
    }
    
    this.requestHistory.push(now);
  }

  /**
   * Make request with queue and rate limiting
   */
  async makeRequest(messages, systemPrompt = null, options = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        messages,
        systemPrompt,
        options,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      this.processQueue();
    });
  }

  /**
   * Process request queue
   */
  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      
      try {
        // Check if request has expired (5 minutes max wait)
        if (Date.now() - request.timestamp > 300000) {
          request.reject(new Error('Request timeout - expired in queue'));
          continue;
        }

        const result = await this.executeRequest(
          request.messages, 
          request.systemPrompt, 
          request.options
        );
        
        request.resolve(result);
        
        // Small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        request.reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Execute the actual API request
   */
  async executeRequest(messages, systemPrompt = null, options = {}) {
    try {
      // Validate inputs
      this.validateMessages(messages);
      
      if (systemPrompt) {
        Validator.validateString(systemPrompt, 'systemPrompt', { 
          maxLength: 50000 
        });
      }

      // Check rate limits
      this.checkRateLimit();

      const payload = {
        model: options.model || this.model,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || this.temperature,
        messages: messages
      };

      if (systemPrompt) {
        payload.system = systemPrompt;
      }

      logger.debug('Executing Claude AI request', { 
        messageCount: messages.length,
        model: payload.model,
        hasSystemPrompt: !!systemPrompt
      });

      const response = await this.axiosInstance.post(this.baseURL, payload);
      
      if (response.status === 200 && response.data.content?.[0]?.text) {
        const result = response.data.content[0].text;
        
        logger.debug('Claude AI request successful', {
          responseLength: result.length,
          usage: response.data.usage
        });
        
        return result;
      } else {
        throw new Error('Invalid response structure from Claude AI');
      }
      
    } catch (error) {
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded - please try again later');
      } else if (error.response?.status === 401) {
        throw new Error('Invalid API key - check configuration');
      } else if (error.response?.status === 400) {
        throw new Error(`Invalid request: ${error.response.data?.error?.message || 'Bad request'}`);
      }
      
      throw errorHandler.handleAPIError(error, 'Claude AI');
    }
  }

  /**
   * Health check with proper error handling
   */
  async healthCheck() {
    try {
      const testMessages = [{
        role: 'user',
        content: 'Say "OK" if you are working properly.'
      }];

      const response = await this.executeRequest(testMessages, null, { 
        maxTokens: 10,
        temperature: 0 
      });
      
      if (response && response.toLowerCase().includes('ok')) {
        return { 
          status: 'healthy', 
          service: 'Claude AI',
          model: this.model,
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error('Unexpected response from health check');
      }
      
    } catch (error) {
      logger.error('Claude AI health check failed:', error.message);
      return { 
        status: 'unhealthy', 
        service: 'Claude AI',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Analyze draft situation with enhanced error handling
   */
  async analyzeDraftSituation(draftContext) {
    try {
      Validator.validateObject(draftContext, 'draftContext', {
        currentPick: (value) => Validator.validateObject(value, 'currentPick', {
          overall: (val) => Validator.validateNumber(val, 'overall', { min: 1, integer: true }),
          round: (val) => Validator.validateNumber(val, 'round', { min: 1, integer: true })
        }),
        availablePlayers: (value) => Validator.validateArray(value, 'availablePlayers', { minLength: 1 }),
        myTeam: (value) => Validator.validateObject(value, 'myTeam'),
        leagueSettings: (value) => Validator.validateObject(value, 'leagueSettings')
      });

      const systemPrompt = this.buildDraftSystemPrompt();
      const userMessage = this.buildDraftAnalysisPrompt(draftContext);

      const messages = [{
        role: 'user',
        content: userMessage
      }];

      const response = await this.makeRequest(messages, systemPrompt, {
        maxTokens: 3000,
        temperature: 0.3
      });

      return this.parseDraftRecommendations(response);
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      logger.error('Draft analysis failed:', error.message);
      throw new Error(`Draft analysis error: ${error.message}`);
    }
  }

  /**
   * Build enhanced system prompt
   */
  buildDraftSystemPrompt() {
    return `You are an expert fantasy football analyst with comprehensive knowledge of player values, team needs, and draft strategy. 

Key Guidelines:
- Provide data-driven, actionable recommendations
- Consider current season context (2025)
- Account for injury history and current status
- Factor in team offensive systems and coaching changes
- Prioritize proven performers over unproven rookies when in doubt
- Consider league scoring format (PPR vs Standard)

Response Format:
- Be concise but thorough
- Include specific reasoning for each recommendation
- Rank recommendations by confidence level
- Note any risk factors

Current Date: ${new Date().toLocaleDateString()}
Season: 2025 NFL Fantasy Football`;
  }

  /**
   * Build draft analysis prompt with validation
   */
  buildDraftAnalysisPrompt(context) {
    const {
      currentPick,
      myTeam,
      availablePlayers,
      recentPicks,
      leagueSettings,
      otherTeams,
      picksUntilNext
    } = context;

    return `Analyze this draft situation and provide immediate actionable recommendations:

DRAFT CONTEXT:
- League: ${leagueSettings.size}-team ${leagueSettings.scoringType || 'PPR'}
- Current Pick: ${currentPick.overall} overall (Round ${currentPick.round})
- Picks until next turn: ${picksUntilNext || 'Unknown'}

MY CURRENT ROSTER:
${this.formatRoster(myTeam.roster)}

POSITION NEEDS ANALYSIS:
${this.analyzePositionNeeds(myTeam.roster, leagueSettings)}

TOP AVAILABLE PLAYERS:
${this.formatAvailablePlayers(availablePlayers.slice(0, 15))}

${recentPicks ? `RECENT DRAFT ACTIVITY:\n${this.formatRecentPicks(recentPicks)}` : ''}

Provide top 3 recommendations with specific reasoning for each.`;
  }

  /**
   * Format roster for display
   */
  formatRoster(roster) {
    if (!roster || roster.length === 0) {
      return 'No players drafted yet';
    }

    return roster.map(player => 
      `${player.name} (${player.position}, ${player.team})`
    ).join('\n');
  }

  /**
   * Analyze position needs
   */
  analyzePositionNeeds(roster, leagueSettings) {
    const positions = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
    
    if (roster) {
      roster.forEach(player => {
        if (positions.hasOwnProperty(player.position)) {
          positions[player.position]++;
        }
      });
    }

    const needs = [];
    const typical = { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DST: 1 };

    for (const [pos, count] of Object.entries(positions)) {
      if (count < typical[pos]) {
        needs.push(`${pos}: Need ${typical[pos] - count} more`);
      }
    }

    return needs.length > 0 ? needs.join('\n') : 'All basic positions covered';
  }

  /**
   * Format available players
   */
  formatAvailablePlayers(players) {
    return players.map((player, index) => 
      `${index + 1}. ${player.name} (${player.position}, ${player.team}) - ADP: ${player.adp || 'N/A'}`
    ).join('\n');
  }

  /**
   * Format recent picks
   */
  formatRecentPicks(picks) {
    return picks.slice(-5).map(pick => 
      `${pick.player.name} (${pick.player.position}) to ${pick.teamName}`
    ).join('\n');
  }

  /**
   * Parse draft recommendations from response
   */
  parseDraftRecommendations(response) {
    try {
      // Extract structured data from response
      const recommendations = {
        recommendations: [],
        analysis: response,
        timestamp: new Date().toISOString()
      };

      // Try to extract specific recommendations
      const lines = response.split('\n');
      let currentRec = null;

      for (const line of lines) {
        if (line.match(/^\d+\./)) {
          if (currentRec) {
            recommendations.recommendations.push(currentRec);
          }
          currentRec = {
            player: line.replace(/^\d+\.\s*/, '').split(' (')[0],
            reasoning: ''
          };
        } else if (currentRec && line.trim()) {
          currentRec.reasoning += line.trim() + ' ';
        }
      }

      if (currentRec) {
        recommendations.recommendations.push(currentRec);
      }

      return recommendations;
      
    } catch (error) {
      logger.warn('Failed to parse structured recommendations, returning raw response');
      return {
        analysis: response,
        recommendations: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.requestQueue = [];
    this.requestHistory = [];
    this.isProcessingQueue = false;
    
    if (this.axiosInstance) {
      // Clear interceptors
      this.axiosInstance.interceptors.request.clear();
      this.axiosInstance.interceptors.response.clear();
    }
  }
}

module.exports = ImprovedClaudeAI;