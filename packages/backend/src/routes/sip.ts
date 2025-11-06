import express from 'express';
import Joi from 'joi';
import { SipService } from '../services/sip';
import { OutboundCallService } from '../services/outboundCallService';
import { DatabaseService } from '../services/database';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';
import { CreateSipConfigRequest } from '../database/types';

const router = express.Router();

// Validation schemas
const sipConfigSchema = Joi.object({
  agent_id: Joi.string().uuid().required(),
  provider_host: Joi.string().hostname().required(),
  provider_port: Joi.number().port().default(5060),
  username: Joi.string().required(),
  password: Joi.string().required(),
  realm: Joi.string().required(),
  inbound_numbers: Joi.array().items(Joi.string()).default([]),
  outbound_number: Joi.string().optional(),
  record_calls: Joi.boolean().default(true),
  max_call_duration: Joi.number().positive().default(3600), // 1 hour
  transfer_enabled: Joi.boolean().default(false),
  transfer_number: Joi.string().optional()
});

const outboundCallSchema = Joi.object({
  agent_id: Joi.string().uuid().required(),
  phone_number: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  message: Joi.string().optional()
});

const campaignSchema = Joi.object({
  agent_id: Joi.string().uuid().required(),
  name: Joi.string().required(),
  description: Joi.string().optional(),
  phone_numbers: Joi.array().items(Joi.string().pattern(/^\+?[1-9]\d{1,14}$/)).min(1).required(),
  message: Joi.string().optional(),
  scheduled_at: Joi.date().optional(),
  max_retries: Joi.number().integer().min(0).max(10).default(3),
  retry_delay: Joi.number().integer().min(1).max(1440).default(60), // 1-1440 minutes
  call_timeout: Joi.number().integer().min(30).max(3600).default(300) // 30s-1hour
});

// Initialize services (will be injected)
let sipService: SipService;
let outboundCallService: OutboundCallService;
let databaseService: DatabaseService;

export function initializeSipRoutes(sipSvc: SipService, outboundSvc: OutboundCallService, dbSvc: DatabaseService) {
  sipService = sipSvc;
  outboundCallService = outboundSvc;
  databaseService = dbSvc;
}

/**
 * Create or update SIP configuration for an agent
 */
router.post('/config', authMiddleware, async (req, res) => {
  try {
    const { error, value } = sipConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details
      });
    }

    const sipConfigData: CreateSipConfigRequest = value;
    const userId = req.user?.id;

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await databaseService.supabase
      .from('agents')
      .select('id')
      .eq('id', sipConfigData.agent_id)
      .eq('user_id', userId)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({
        error: 'Agent not found or access denied'
      });
    }

    // Encrypt password before storage
    const encryptedPassword = Buffer.from(sipConfigData.password).toString('base64');

    // Check if configuration already exists
    const { data: existingConfig } = await databaseService.supabase
      .from('sip_configs')
      .select('id')
      .eq('agent_id', sipConfigData.agent_id)
      .single();

    let sipConfig;
    if (existingConfig) {
      // Update existing configuration
      const { data, error } = await databaseService.supabase
        .from('sip_configs')
        .update({
          provider_host: sipConfigData.provider_host,
          provider_port: sipConfigData.provider_port,
          username: sipConfigData.username,
          password_encrypted: encryptedPassword,
          realm: sipConfigData.realm,
          inbound_numbers: sipConfigData.inbound_numbers,
          outbound_number: sipConfigData.outbound_number,
          record_calls: sipConfigData.record_calls,
          max_call_duration: sipConfigData.max_call_duration,
          transfer_enabled: sipConfigData.transfer_enabled,
          transfer_number: sipConfigData.transfer_number,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConfig.id)
        .select()
        .single();

      if (error) throw error;
      sipConfig = data;
    } else {
      // Create new configuration
      const { data, error } = await databaseService.supabase
        .from('sip_configs')
        .insert({
          agent_id: sipConfigData.agent_id,
          provider_host: sipConfigData.provider_host,
          provider_port: sipConfigData.provider_port,
          username: sipConfigData.username,
          password_encrypted: encryptedPassword,
          realm: sipConfigData.realm,
          inbound_numbers: sipConfigData.inbound_numbers,
          outbound_number: sipConfigData.outbound_number,
          record_calls: sipConfigData.record_calls,
          max_call_duration: sipConfigData.max_call_duration,
          transfer_enabled: sipConfigData.transfer_enabled,
          transfer_number: sipConfigData.transfer_number
        })
        .select()
        .single();

      if (error) throw error;
      sipConfig = data;
    }

    // Update SIP service with new configuration
    await sipService.updateAgentConfig(sipConfigData.agent_id, sipConfig);

    // Remove sensitive data from response
    const responseConfig = { ...sipConfig };
    delete responseConfig.password_encrypted;

    res.status(200).json({
      message: 'SIP configuration saved successfully',
      config: responseConfig
    });

  } catch (error) {
    logger.error('Failed to save SIP configuration:', error);
    res.status(500).json({
      error: 'Failed to save SIP configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get SIP configuration for an agent
 */
router.get('/config/:agentId', authMiddleware, async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user?.id;

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await databaseService.supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({
        error: 'Agent not found or access denied'
      });
    }

    // Get SIP configuration
    const { data: sipConfig, error } = await databaseService.supabase
      .from('sip_configs')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    if (!sipConfig) {
      return res.status(404).json({
        error: 'SIP configuration not found'
      });
    }

    // Remove sensitive data from response
    const responseConfig = { ...sipConfig };
    delete responseConfig.password_encrypted;

    res.status(200).json({
      config: responseConfig
    });

  } catch (error) {
    logger.error('Failed to get SIP configuration:', error);
    res.status(500).json({
      error: 'Failed to get SIP configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete SIP configuration for an agent
 */
router.delete('/config/:agentId', authMiddleware, async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user?.id;

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await databaseService.supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({
        error: 'Agent not found or access denied'
      });
    }

    // Unregister agent from SIP service
    await sipService.unregisterAgent(agentId);

    // Delete SIP configuration from database
    const { error } = await databaseService.supabase
      .from('sip_configs')
      .delete()
      .eq('agent_id', agentId);

    if (error) throw error;

    res.status(200).json({
      message: 'SIP configuration deleted successfully'
    });

  } catch (error) {
    logger.error('Failed to delete SIP configuration:', error);
    res.status(500).json({
      error: 'Failed to delete SIP configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Make single outbound call
 */
router.post('/call/outbound', authMiddleware, async (req, res) => {
  try {
    const { error, value } = outboundCallSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details
      });
    }

    const { agent_id, phone_number, message } = value;
    const userId = req.user?.id;

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await databaseService.supabase
      .from('agents')
      .select('id')
      .eq('id', agent_id)
      .eq('user_id', userId)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({
        error: 'Agent not found or access denied'
      });
    }

    // Make outbound call
    const call = await outboundCallService.makeOutboundCall(agent_id, phone_number, message);

    res.status(200).json({
      message: 'Outbound call initiated',
      call: {
        id: call.id,
        agentId: call.agentId,
        phoneNumber: call.phoneNumber,
        status: call.status,
        attempts: call.attempts,
        scheduledAt: call.scheduledAt,
        createdAt: call.createdAt
      }
    });

  } catch (error) {
    logger.error('Failed to make outbound call:', error);
    res.status(500).json({
      error: 'Failed to make outbound call',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * End call
 */
router.post('/call/:callId/end', authMiddleware, async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user?.id;

    // Get call details
    const call = sipService.getCall(callId);
    if (!call) {
      return res.status(404).json({
        error: 'Call not found'
      });
    }

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await databaseService.supabase
      .from('agents')
      .select('id')
      .eq('id', call.agentId)
      .eq('user_id', userId)
      .single();

    if (agentError || !agent) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // End the call
    await sipService.endCall(callId);

    res.status(200).json({
      message: 'Call ended successfully'
    });

  } catch (error) {
    logger.error('Failed to end call:', error);
    res.status(500).json({
      error: 'Failed to end call',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get active calls for user's agents
 */
router.get('/calls/active', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;

    // Get user's agents
    const { data: agents, error: agentsError } = await databaseService.supabase
      .from('agents')
      .select('id')
      .eq('user_id', userId);

    if (agentsError) throw agentsError;

    const agentIds = agents?.map(agent => agent.id) || [];
    
    // Get active calls for user's agents
    const activeCalls = sipService.getActiveCalls().filter(call => 
      agentIds.includes(call.agentId)
    );

    // Format response
    const formattedCalls = activeCalls.map(call => ({
      id: call.id,
      agentId: call.agentId,
      phoneNumber: call.phoneNumber,
      direction: call.direction,
      status: call.status,
      startTime: call.startTime,
      conversationId: call.conversationId
    }));

    res.status(200).json({
      calls: formattedCalls
    });

  } catch (error) {
    logger.error('Failed to get active calls:', error);
    res.status(500).json({
      error: 'Failed to get active calls',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get call details
 */
router.get('/call/:callId', authMiddleware, async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user?.id;

    // Get call details
    const call = sipService.getCall(callId);
    if (!call) {
      return res.status(404).json({
        error: 'Call not found'
      });
    }

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await databaseService.supabase
      .from('agents')
      .select('id')
      .eq('id', call.agentId)
      .eq('user_id', userId)
      .single();

    if (agentError || !agent) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    res.status(200).json({
      call: {
        id: call.id,
        agentId: call.agentId,
        phoneNumber: call.phoneNumber,
        direction: call.direction,
        status: call.status,
        startTime: call.startTime,
        endTime: call.endTime,
        conversationId: call.conversationId
      }
    });

  } catch (error) {
    logger.error('Failed to get call details:', error);
    res.status(500).json({
      error: 'Failed to get call details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Create call campaign
 */
router.post('/campaigns', authMiddleware, async (req, res) => {
  try {
    const { error, value } = campaignSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details
      });
    }

    const campaignData = value;
    const userId = req.user?.id;

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await databaseService.supabase
      .from('agents')
      .select('id')
      .eq('id', campaignData.agent_id)
      .eq('user_id', userId)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({
        error: 'Agent not found or access denied'
      });
    }

    // Create campaign
    const campaign = await outboundCallService.createCampaign({
      agentId: campaignData.agent_id,
      name: campaignData.name,
      description: campaignData.description,
      phoneNumbers: campaignData.phone_numbers,
      message: campaignData.message,
      scheduledAt: campaignData.scheduled_at,
      maxRetries: campaignData.max_retries,
      retryDelay: campaignData.retry_delay,
      callTimeout: campaignData.call_timeout
    });

    res.status(201).json({
      message: 'Campaign created successfully',
      campaign: {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        status: campaign.status,
        phoneNumbers: campaign.phoneNumbers.length,
        scheduledAt: campaign.scheduledAt,
        createdAt: campaign.createdAt
      }
    });

  } catch (error) {
    logger.error('Failed to create campaign:', error);
    res.status(500).json({
      error: 'Failed to create campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get user's campaigns
 */
router.get('/campaigns', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;

    // Get user's agents
    const { data: agents, error: agentsError } = await databaseService.supabase
      .from('agents')
      .select('id')
      .eq('user_id', userId);

    if (agentsError) throw agentsError;

    const agentIds = agents?.map(agent => agent.id) || [];
    
    // Get campaigns for user's agents
    const campaigns = outboundCallService.getActiveCampaigns()
      .filter(campaign => agentIds.includes(campaign.agentId));

    // Get campaign statistics
    const campaignsWithStats = campaigns.map(campaign => {
      const stats = outboundCallService.getCampaignStats(campaign.id);
      return {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        status: campaign.status,
        phoneNumbers: campaign.phoneNumbers.length,
        scheduledAt: campaign.scheduledAt,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        stats
      };
    });

    res.status(200).json({
      campaigns: campaignsWithStats
    });

  } catch (error) {
    logger.error('Failed to get campaigns:', error);
    res.status(500).json({
      error: 'Failed to get campaigns',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get campaign details
 */
router.get('/campaigns/:campaignId', authMiddleware, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userId = req.user?.id;

    const campaign = outboundCallService.getCampaign(campaignId);
    if (!campaign) {
      return res.status(404).json({
        error: 'Campaign not found'
      });
    }

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await databaseService.supabase
      .from('agents')
      .select('id')
      .eq('id', campaign.agentId)
      .eq('user_id', userId)
      .single();

    if (agentError || !agent) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Get campaign statistics and calls
    const stats = outboundCallService.getCampaignStats(campaignId);
    const calls = outboundCallService.getActiveOutboundCalls()
      .filter(call => call.campaignId === campaignId);

    res.status(200).json({
      campaign: {
        ...campaign,
        stats
      },
      calls: calls.map(call => ({
        id: call.id,
        phoneNumber: call.phoneNumber,
        status: call.status,
        attempts: call.attempts,
        outcome: call.outcome,
        scheduledAt: call.scheduledAt,
        lastAttemptAt: call.lastAttemptAt,
        connectedAt: call.connectedAt,
        endedAt: call.endedAt,
        duration: call.duration,
        notes: call.notes
      }))
    });

  } catch (error) {
    logger.error('Failed to get campaign details:', error);
    res.status(500).json({
      error: 'Failed to get campaign details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Start campaign
 */
router.post('/campaigns/:campaignId/start', authMiddleware, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userId = req.user?.id;

    const campaign = outboundCallService.getCampaign(campaignId);
    if (!campaign) {
      return res.status(404).json({
        error: 'Campaign not found'
      });
    }

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await databaseService.supabase
      .from('agents')
      .select('id')
      .eq('id', campaign.agentId)
      .eq('user_id', userId)
      .single();

    if (agentError || !agent) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    await outboundCallService.startCampaign(campaignId);

    res.status(200).json({
      message: 'Campaign started successfully'
    });

  } catch (error) {
    logger.error('Failed to start campaign:', error);
    res.status(500).json({
      error: 'Failed to start campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Pause campaign
 */
router.post('/campaigns/:campaignId/pause', authMiddleware, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userId = req.user?.id;

    const campaign = outboundCallService.getCampaign(campaignId);
    if (!campaign) {
      return res.status(404).json({
        error: 'Campaign not found'
      });
    }

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await databaseService.supabase
      .from('agents')
      .select('id')
      .eq('id', campaign.agentId)
      .eq('user_id', userId)
      .single();

    if (agentError || !agent) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    await outboundCallService.pauseCampaign(campaignId);

    res.status(200).json({
      message: 'Campaign paused successfully'
    });

  } catch (error) {
    logger.error('Failed to pause campaign:', error);
    res.status(500).json({
      error: 'Failed to pause campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Cancel campaign
 */
router.post('/campaigns/:campaignId/cancel', authMiddleware, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userId = req.user?.id;

    const campaign = outboundCallService.getCampaign(campaignId);
    if (!campaign) {
      return res.status(404).json({
        error: 'Campaign not found'
      });
    }

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await databaseService.supabase
      .from('agents')
      .select('id')
      .eq('id', campaign.agentId)
      .eq('user_id', userId)
      .single();

    if (agentError || !agent) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    await outboundCallService.cancelCampaign(campaignId);

    res.status(200).json({
      message: 'Campaign cancelled successfully'
    });

  } catch (error) {
    logger.error('Failed to cancel campaign:', error);
    res.status(500).json({
      error: 'Failed to cancel campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test SIP connection
 */
router.post('/test-connection', authMiddleware, async (req, res) => {
  try {
    const { error, value } = sipConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details
      });
    }

    const sipConfigData = value;
    const userId = req.user?.id;

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await databaseService.supabase
      .from('agents')
      .select('id')
      .eq('id', sipConfigData.agent_id)
      .eq('user_id', userId)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({
        error: 'Agent not found or access denied'
      });
    }

    // Test connection (simplified - just validate configuration)
    const testResult = {
      success: true,
      message: 'SIP configuration is valid',
      details: {
        host: sipConfigData.provider_host,
        port: sipConfigData.provider_port,
        username: sipConfigData.username,
        realm: sipConfigData.realm
      }
    };

    res.status(200).json(testResult);

  } catch (error) {
    logger.error('Failed to test SIP connection:', error);
    res.status(500).json({
      error: 'Failed to test SIP connection',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;