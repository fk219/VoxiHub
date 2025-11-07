import express from 'express';
import { authenticateToken } from '../../../middleware/auth';
import { DatabaseService } from '../../../services/database';
import { AuditService } from '../../../services/auditService';
import { logger } from '../../../utils/logger';

const router = express.Router();
const dbService = new DatabaseService();
const auditService = new AuditService(dbService);

/**
 * @swagger
 * /api/v1/ivr/menus:
 *   get:
 *     summary: List all IVR menus
 *     tags: [IVR]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of IVR menus
 */
router.get('/menus', authenticateToken(auditService), async (req, res) => {
  try {
    const menus = await dbService.getIVRMenus(req.user!.id);
    res.json({ data: menus });
  } catch (error) {
    logger.error('Failed to list IVR menus:', error);
    res.status(500).json({
      error: 'Failed to list IVR menus',
      code: 'IVR_MENUS_LIST_FAILED',
    });
  }
});

/**
 * @swagger
 * /api/v1/ivr/menus:
 *   post:
 *     summary: Create IVR menu
 *     tags: [IVR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - prompt
 *               - items
 *             properties:
 *               name:
 *                 type: string
 *               prompt:
 *                 type: string
 *               items:
 *                 type: array
 *               timeout:
 *                 type: number
 *               maxRetries:
 *                 type: number
 *     responses:
 *       201:
 *         description: IVR menu created
 */
router.post('/menus', authenticateToken(auditService), async (req, res) => {
  try {
    const { name, prompt, items, timeout, maxRetries, invalidPrompt, timeoutPrompt, parentMenuId } = req.body;

    if (!name || !prompt || !items || !Array.isArray(items)) {
      return res.status(400).json({
        error: 'Name, prompt, and items are required',
        code: 'VALIDATION_ERROR',
      });
    }

    const menu = await dbService.createIVRMenu({
      user_id: req.user!.id,
      name,
      prompt,
      items,
      timeout,
      max_retries: maxRetries,
      invalid_prompt: invalidPrompt,
      timeout_prompt: timeoutPrompt,
      parent_menu_id: parentMenuId,
    });

    res.status(201).json({ data: menu });
  } catch (error) {
    logger.error('Failed to create IVR menu:', error);
    res.status(500).json({
      error: 'Failed to create IVR menu',
      code: 'IVR_MENU_CREATE_FAILED',
    });
  }
});

/**
 * @swagger
 * /api/v1/ivr/menus/{id}:
 *   get:
 *     summary: Get IVR menu by ID
 *     tags: [IVR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: IVR menu details
 */
router.get('/menus/:id', authenticateToken(auditService), async (req, res) => {
  try {
    const menu = await dbService.getIVRMenuById(req.params.id, req.user!.id);

    if (!menu) {
      return res.status(404).json({
        error: 'IVR menu not found',
        code: 'IVR_MENU_NOT_FOUND',
      });
    }

    res.json({ data: menu });
  } catch (error) {
    logger.error('Failed to get IVR menu:', error);
    res.status(500).json({
      error: 'Failed to get IVR menu',
      code: 'IVR_MENU_GET_FAILED',
    });
  }
});

/**
 * @swagger
 * /api/v1/ivr/menus/{id}:
 *   put:
 *     summary: Update IVR menu
 *     tags: [IVR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: IVR menu updated
 */
router.put('/menus/:id', authenticateToken(auditService), async (req, res) => {
  try {
    const menu = await dbService.getIVRMenuById(req.params.id, req.user!.id);

    if (!menu) {
      return res.status(404).json({
        error: 'IVR menu not found',
        code: 'IVR_MENU_NOT_FOUND',
      });
    }

    const updatedMenu = await dbService.updateIVRMenu(req.params.id, req.body);
    res.json({ data: updatedMenu });
  } catch (error) {
    logger.error('Failed to update IVR menu:', error);
    res.status(500).json({
      error: 'Failed to update IVR menu',
      code: 'IVR_MENU_UPDATE_FAILED',
    });
  }
});

/**
 * @swagger
 * /api/v1/ivr/menus/{id}:
 *   delete:
 *     summary: Delete IVR menu
 *     tags: [IVR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: IVR menu deleted
 */
router.delete('/menus/:id', authenticateToken(auditService), async (req, res) => {
  try {
    const menu = await dbService.getIVRMenuById(req.params.id, req.user!.id);

    if (!menu) {
      return res.status(404).json({
        error: 'IVR menu not found',
        code: 'IVR_MENU_NOT_FOUND',
      });
    }

    await dbService.deleteIVRMenu(req.params.id);
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete IVR menu:', error);
    res.status(500).json({
      error: 'Failed to delete IVR menu',
      code: 'IVR_MENU_DELETE_FAILED',
    });
  }
});

/**
 * @swagger
 * /api/v1/ivr/menus/{id}/test:
 *   post:
 *     summary: Test IVR menu
 *     tags: [IVR]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input:
 *                 type: string
 *     responses:
 *       200:
 *         description: Test result
 */
router.post('/menus/:id/test', authenticateToken(auditService), async (req, res) => {
  try {
    const menu = await dbService.getIVRMenuById(req.params.id, req.user!.id);

    if (!menu) {
      return res.status(404).json({
        error: 'IVR menu not found',
        code: 'IVR_MENU_NOT_FOUND',
      });
    }

    const { input } = req.body;
    const menuItem = menu.items.find((item: any) => item.digit === input);

    if (!menuItem) {
      return res.json({
        valid: false,
        message: menu.invalid_prompt || 'Invalid input',
      });
    }

    res.json({
      valid: true,
      menuItem,
      message: `Selected: ${menuItem.label}`,
    });
  } catch (error) {
    logger.error('Failed to test IVR menu:', error);
    res.status(500).json({
      error: 'Failed to test IVR menu',
      code: 'IVR_MENU_TEST_FAILED',
    });
  }
});

export default router;
