const router = require('express').Router();
const c = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validation');

/**
 * @openapi
 * /api/auth/setup-status:
 *   get:
 *     tags: [Auth]
 *     summary: Returns whether the first-run wizard should be shown
 */
router.get('/setup-status', c.setupStatus);

/**
 * @openapi
 * /api/auth/setup:
 *   post:
 *     tags: [Auth]
 *     summary: Create the first admin (only allowed when no admin exists)
 */
router.post('/setup', c.setupValidators, handleValidation, c.setup);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in
 */
router.post('/login', c.loginValidators, handleValidation, c.login);

router.post('/logout', requireAuth, c.logout);
router.get('/me', requireAuth, c.me);
router.post('/change-password', requireAuth, c.changePasswordValidators, handleValidation, c.changePassword);

module.exports = router;
