import { Router, Request, Response } from 'express';
import { FunctionRegistry } from '../../../services/functionRegistry';
import { authenticateToken } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Get all functions
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, enabled } = req.query;
    const userId = (req as any).user?.id;

    const functionRegistry: FunctionRegistry = (req.app as any).functionRegistry;

    const filters: any = {};
    if (category) filters.category = category;
    if (enabled !== undefined) filters.enabled = enabled === 'true';
    if (userId) filters.userId = userId;

    const functions = functionRegistry.listFunctions(filters);

    // Add usage statistics
    const functionsWithStats = functions.map(func => {
      const stats = functionRegistry.getFunctionStats(func.id);
      return {
        ...func,
        usageCount: stats.totalExecutions,
        successRate: stats.totalExecutions > 0 
          ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
          : 0
      };
    });

    res.json(functionsWithStats);
  } catch (error) {
    logger.error('Failed to list functions:', error);
    res.status(500).json({ error: 'Failed to list functions' });
  }
});

/**
 * Get function by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const functionRegistry: FunctionRegistry = (req.app as any).functionRegistry;

    const func = functionRegistry.getFunction(id);

    if (!func) {
      return res.status(404).json({ error: 'Function not found' });
    }

    // Add usage statistics
    const stats = functionRegistry.getFunctionStats(id);

    res.json({
      ...func,
      usageCount: stats.totalExecutions,
      successRate: stats.totalExecutions > 0 
        ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
        : 0,
      averageExecutionTime: Math.round(stats.averageExecutionTime)
    });
  } catch (error) {
    logger.error('Failed to get function:', error);
    res.status(500).json({ error: 'Failed to get function' });
  }
});

/**
 * Register a new custom function
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, parameters, handler, category = 'custom' } = req.body;
    const userId = (req as any).user?.id;

    if (!name || !description || !parameters) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const functionRegistry: FunctionRegistry = (req.app as any).functionRegistry;

    // Check if function already exists
    const existing = functionRegistry.getFunctionByName(name);
    if (existing) {
      return res.status(409).json({ error: 'Function with this name already exists' });
    }

    // Create handler function from string (for custom functions)
    let handlerFn: (params: any, context: any) => Promise<any>;
    if (handler) {
      try {
        // In production, use a safer sandboxed execution environment
        const fn = new Function('params', 'context', `return (async () => { ${handler} })();`);
        handlerFn = async (params: any, context: any) => await fn(params, context);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid handler function' });
      }
    } else {
      // Default handler that returns parameters
      handlerFn = async (params: any) => params;
    }

    const functionId = functionRegistry.registerFunction({
      name,
      description,
      parameters,
      handler: handlerFn,
      category,
      userId,
      enabled: true
    });

    const func = functionRegistry.getFunction(functionId);

    res.status(201).json(func);
  } catch (error) {
    logger.error('Failed to register function:', error);
    res.status(500).json({ error: 'Failed to register function' });
  }
});

/**
 * Update function
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const functionRegistry: FunctionRegistry = (req.app as any).functionRegistry;

    const func = functionRegistry.getFunction(id);
    if (!func) {
      return res.status(404).json({ error: 'Function not found' });
    }

    // Only allow updating certain fields
    const allowedUpdates = ['description', 'enabled', 'parameters'];
    const filteredUpdates: any = {};
    
    for (const key of allowedUpdates) {
      if (key in updates) {
        filteredUpdates[key] = updates[key];
      }
    }

    const success = functionRegistry.updateFunction(id, filteredUpdates);

    if (!success) {
      return res.status(500).json({ error: 'Failed to update function' });
    }

    const updatedFunc = functionRegistry.getFunction(id);
    res.json(updatedFunc);
  } catch (error) {
    logger.error('Failed to update function:', error);
    res.status(500).json({ error: 'Failed to update function' });
  }
});

/**
 * Delete function
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const functionRegistry: FunctionRegistry = (req.app as any).functionRegistry;

    const func = functionRegistry.getFunction(id);
    if (!func) {
      return res.status(404).json({ error: 'Function not found' });
    }

    // Don't allow deleting built-in functions
    if (func.category === 'builtin') {
      return res.status(403).json({ error: 'Cannot delete built-in functions' });
    }

    const success = functionRegistry.unregisterFunction(id);

    if (!success) {
      return res.status(500).json({ error: 'Failed to delete function' });
    }

    res.json({ success: true, message: 'Function deleted' });
  } catch (error) {
    logger.error('Failed to delete function:', error);
    res.status(500).json({ error: 'Failed to delete function' });
  }
});

/**
 * Test function execution
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { parameters = {} } = req.body;
    const userId = (req as any).user?.id;

    const functionRegistry: FunctionRegistry = (req.app as any).functionRegistry;

    const func = functionRegistry.getFunction(id);
    if (!func) {
      return res.status(404).json({ error: 'Function not found' });
    }

    // Execute function with test context
    const result = await functionRegistry.executeFunction(
      func.name,
      parameters,
      {
        conversationId: 'test',
        agentId: 'test',
        userId,
        metadata: { test: true }
      }
    );

    res.json(result);
  } catch (error) {
    logger.error('Failed to test function:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test function'
    });
  }
});

/**
 * Get function execution logs
 */
router.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const functionRegistry: FunctionRegistry = (req.app as any).functionRegistry;

    const func = functionRegistry.getFunction(id);
    if (!func) {
      return res.status(404).json({ error: 'Function not found' });
    }

    const logs = functionRegistry.getExecutionLogs({
      functionId: id,
      limit: Number(limit)
    });

    res.json(logs);
  } catch (error) {
    logger.error('Failed to get function logs:', error);
    res.status(500).json({ error: 'Failed to get function logs' });
  }
});

/**
 * Get all function calls (across all functions)
 */
router.get('/calls/all', async (req: Request, res: Response) => {
  try {
    const { limit = 100, agentId, conversationId } = req.query;

    const functionRegistry: FunctionRegistry = (req.app as any).functionRegistry;

    const filters: any = { limit: Number(limit) };
    if (agentId) filters.agentId = agentId;
    if (conversationId) filters.conversationId = conversationId;

    const logs = functionRegistry.getExecutionLogs(filters);

    // Transform logs to match frontend interface
    const calls = logs.map(log => ({
      id: log.id,
      functionName: log.functionName,
      parameters: log.parameters,
      success: log.result.success,
      executionTime: log.result.executionTime,
      executedAt: log.createdAt,
      error: log.result.error,
      result: log.result.result
    }));

    res.json(calls);
  } catch (error) {
    logger.error('Failed to get function calls:', error);
    res.status(500).json({ error: 'Failed to get function calls' });
  }
});

/**
 * Get function statistics
 */
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const functionRegistry: FunctionRegistry = (req.app as any).functionRegistry;

    const func = functionRegistry.getFunction(id);
    if (!func) {
      return res.status(404).json({ error: 'Function not found' });
    }

    const stats = functionRegistry.getFunctionStats(id);

    res.json({
      functionId: id,
      functionName: func.name,
      ...stats,
      successRate: stats.totalExecutions > 0 
        ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100)
        : 0
    });
  } catch (error) {
    logger.error('Failed to get function stats:', error);
    res.status(500).json({ error: 'Failed to get function stats' });
  }
});

export default router;
