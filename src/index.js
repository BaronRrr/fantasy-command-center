const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/environment');
const DraftMonitor = require('./services/draft-monitor');
const DiscordNotifier = require('./alerts/discord-bot');
const ExternalAPIsClient = require('./api/external-apis');
const createLogger = require('./utils/logger');
const errorHandler = require('./utils/error-handler');
const { Validator, ValidationError } = require('./utils/validation');
const rateLimiter = require('./middleware/rate-limiter');

const logger = createLogger(config.logging.level);

class FantasyCommandCenter {
  constructor() {
    this.app = express();
    this.draftMonitor = new DraftMonitor();
    this.discordNotifier = new DiscordNotifier();
    this.externalAPIs = new ExternalAPIsClient();
    this.isInitialized = false;
    
    // Setup global error handlers
    errorHandler.setupGlobalHandlers();
  }

  async initialize() {
    try {
      logger.info('🏈 Initializing Fantasy Command Center...');
      
      this.setupMiddleware();
      this.setupRoutes();
      this.setupDraftMonitorEvents();
      
      await this.performHealthChecks();
      
      this.isInitialized = true;
      logger.info('✅ Fantasy Command Center initialized successfully');
      
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize Fantasy Command Center:', error.message);
      throw error;
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));
    
    // CORS
    this.app.use(cors(config.server.cors));
    
    // Rate limiting
    this.app.use('/api/', rateLimiter.createMiddleware());
    
    // Logging
    this.app.use(morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim())
      }
    }));
    
    // Body parsing with size limits
    this.app.use(express.json({ 
      limit: '1mb',
      verify: (req, res, buf, encoding) => {
        // Validate JSON size
        if (buf.length > 1048576) { // 1MB
          throw new Error('Request entity too large');
        }
      }
    }));
    
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '1mb' 
    }));

    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.getSystemHealth();
        res.json(health);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Draft monitoring endpoints
    this.app.post('/draft/start', async (req, res) => {
      try {
        if (!this.draftMonitor.isMonitoring) {
          await this.draftMonitor.initialize();
          this.draftMonitor.startMonitoring();
          res.json({ message: 'Draft monitoring started', status: 'active' });
        } else {
          res.json({ message: 'Draft monitoring already active', status: 'active' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/draft/stop', (req, res) => {
      try {
        this.draftMonitor.stopMonitoring();
        res.json({ message: 'Draft monitoring stopped', status: 'inactive' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/draft/status', (req, res) => {
      try {
        const status = this.draftMonitor.getDraftStatus();
        res.json(status);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Player data endpoints
    this.app.get('/players/search', async (req, res) => {
      try {
        const query = Validator.validateString(req.query.query, 'query', { 
          required: true, 
          minLength: 2, 
          maxLength: 50 
        });
        
        const limit = Validator.validateNumber(req.query.limit || 20, 'limit', { 
          min: 1, 
          max: 100, 
          integer: true 
        });
        
        const players = await this.draftMonitor.searchPlayers(query, limit);
        res.json({ 
          success: true, 
          data: players,
          query: query,
          limit: limit
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          return res.status(400).json({ 
            success: false, 
            error: error.message 
          });
        }
        const errorResponse = errorHandler.handleAPIError(error, 'Player Search');
        res.status(errorResponse.status).json(errorResponse);
      }
    });

    this.app.get('/players/position/:position', async (req, res) => {
      try {
        const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
        const position = req.params.position.toUpperCase();
        
        if (!validPositions.includes(position)) {
          return res.status(400).json({ 
            success: false,
            error: `Invalid position. Valid positions: ${validPositions.join(', ')}` 
          });
        }
        
        const limit = Validator.validateNumber(req.query.limit || 10, 'limit', { 
          min: 1, 
          max: 50, 
          integer: true 
        });
        
        const players = await this.draftMonitor.getAvailablePlayersByPosition(position, limit);
        res.json({ 
          success: true, 
          data: players,
          position: position,
          limit: limit
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          return res.status(400).json({ 
            success: false, 
            error: error.message 
          });
        }
        const errorResponse = errorHandler.handleAPIError(error, 'Position Search');
        res.status(errorResponse.status).json(errorResponse);
      }
    });

    // Notification test endpoint
    this.app.post('/notifications/test', async (req, res) => {
      try {
        const result = await this.discordNotifier.testConnection();
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // AI recommendation endpoint
    this.app.post('/ai/analyze', async (req, res) => {
      try {
        const { currentPick, context } = req.body;
        if (!currentPick) {
          return res.status(400).json({ error: 'currentPick is required' });
        }
        
        const recommendations = await this.draftMonitor.generateAIRecommendations(currentPick, context?.picksUntilNext);
        res.json(recommendations);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // External data endpoints
    this.app.get('/external/injuries', async (req, res) => {
      try {
        const injuries = await this.externalAPIs.getInjuryReports();
        res.json(injuries);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/external/projections', async (req, res) => {
      try {
        const { position, week } = req.query;
        const projections = await this.externalAPIs.getPlayerProjections(position, week);
        res.json(projections);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/external/news', async (req, res) => {
      try {
        const { player, limit = 10 } = req.query;
        const news = await this.externalAPIs.getPlayerNews(player, parseInt(limit));
        res.json(news);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Default route
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Fantasy Command Center',
        version: '1.0.0',
        status: this.isInitialized ? 'ready' : 'initializing',
        endpoints: [
          'GET /health - System health check',
          'POST /draft/start - Start draft monitoring',
          'POST /draft/stop - Stop draft monitoring',
          'GET /draft/status - Get draft status',
          'GET /players/search?query={name} - Search players',
          'GET /players/position/{pos} - Get players by position',
          'POST /notifications/test - Test Discord notifications',
          'POST /ai/analyze - Get AI recommendations',
          'GET /external/injuries - Get injury reports',
          'GET /external/projections - Get player projections',
          'GET /external/news - Get player news'
        ]
      });
    });
  }

  setupDraftMonitorEvents() {
    this.draftMonitor.on('initialized', (data) => {
      logger.info('Draft Monitor initialized:', data);
    });

    this.draftMonitor.on('newPick', async (pick) => {
      logger.info(`New pick detected: ${pick.player.name} to ${pick.teamName}`);
      
      await this.discordNotifier.sendDraftAlert({
        type: 'NEW_PICK',
        urgency: 'MEDIUM',
        data: pick
      });
    });

    this.draftMonitor.on('myTurn', async (data) => {
      logger.info('🚨 IT\'S MY TURN! 🚨');
      
      await this.discordNotifier.sendDraftAlert({
        type: 'MY_TURN',
        urgency: 'CRITICAL',
        data: data
      });
    });

    this.draftMonitor.on('turnApproaching', async (data) => {
      logger.info(`Turn approaching in ${data.picksUntilTurn} picks`);
      
      await this.discordNotifier.sendDraftAlert({
        type: 'TURN_APPROACHING',
        urgency: 'HIGH',
        data: data
      });
    });

    this.draftMonitor.on('aiRecommendations', async (recommendations) => {
      logger.info(`AI recommendations generated: ${recommendations.recommendations?.length || 0} options`);
      
      if (recommendations.recommendations && recommendations.recommendations.length > 0) {
        await this.discordNotifier.sendDraftAlert({
          type: 'AI_RECOMMENDATIONS',
          urgency: 'HIGH',
          data: recommendations
        });
      }
    });

    this.draftMonitor.on('error', (error) => {
      logger.error('Draft Monitor error:', error.message);
    });

    this.draftMonitor.on('monitoringStarted', (data) => {
      logger.info(`Draft monitoring started with ${data.interval}ms interval`);
    });

    this.draftMonitor.on('monitoringStopped', () => {
      logger.info('Draft monitoring stopped');
    });
  }

  async performHealthChecks() {
    logger.info('Performing system health checks...');
    
    try {
      // Check ESPN API connection
      const espnHealth = await this.draftMonitor.espnClient.healthCheck();
      logger.info('ESPN API Health:', espnHealth.status);
      
      // Check Claude AI connection
      const claudeHealth = await this.draftMonitor.claudeAI.healthCheck();
      logger.info('Claude AI Health:', claudeHealth.status);
      
      // Check Discord connection
      const discordHealth = await this.discordNotifier.testConnection();
      logger.info('Discord Health:', discordHealth.success ? 'connected' : 'error');
      
      // Check External APIs
      const externalHealth = await this.externalAPIs.healthCheck();
      logger.info('External APIs Health:', Object.keys(externalHealth).map(key => 
        `${key}: ${externalHealth[key].status}`
      ).join(', '));
      
    } catch (error) {
      logger.warn('Some health checks failed:', error.message);
    }
  }

  async getSystemHealth() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {}
    };

    try {
      health.services.espn = await this.draftMonitor.espnClient.healthCheck();
      health.services.claude = await this.draftMonitor.claudeAI.healthCheck();
      health.services.discord = await this.discordNotifier.testConnection();
      health.services.external = await this.externalAPIs.healthCheck();
      health.services.draftMonitor = {
        status: this.draftMonitor.isMonitoring ? 'monitoring' : 'idle',
        lastKnownPick: this.draftMonitor.lastKnownPick,
        timestamp: new Date().toISOString()
      };

      const hasErrors = Object.values(health.services).some(service => 
        service.status === 'error' || service.success === false
      );
      
      if (hasErrors) {
        health.status = 'degraded';
      }

    } catch (error) {
      health.status = 'error';
      health.error = error.message;
    }

    return health;
  }

  async start() {
    const port = config.server.port;
    const host = config.server.host;

    if (!this.isInitialized) {
      await this.initialize();
    }

    this.server = this.app.listen(port, host, () => {
      logger.info(`🚀 Fantasy Command Center running on http://${host}:${port}`);
      logger.info('🏈 Ready for fantasy football domination!');
    });

    return this.server;
  }

  async stop() {
    if (this.draftMonitor.isMonitoring) {
      this.draftMonitor.stopMonitoring();
    }

    if (this.server) {
      this.server.close();
      logger.info('Fantasy Command Center stopped');
    }
  }
}

// Start the application if this file is run directly
if (require.main === module) {
  const app = new FantasyCommandCenter();
  
  app.start().catch(error => {
    logger.error('Failed to start Fantasy Command Center:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await app.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await app.stop();
    process.exit(0);
  });
}

module.exports = FantasyCommandCenter;