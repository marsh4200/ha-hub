const router = require('express').Router();
const c = require('../controllers/heartbeat.controller');
const { requireClientToken } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validation');

/**
 * @openapi
 * /api/heartbeat:
 *   post:
 *     tags: [Heartbeat]
 *     summary: HA agent heartbeat
 *     description: Sent every 30 seconds by the Home Assistant agent. Authenticated with X-Client-Token header.
 */
router.post('/', requireClientToken, c.heartbeatValidators, handleValidation, c.heartbeat);

module.exports = router;
