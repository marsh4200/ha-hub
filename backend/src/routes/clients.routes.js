const router = require('express').Router();
const c = require('../controllers/clients.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validation');

router.use(requireAuth);

router.get('/', c.list);
router.get('/:id', c.get);
router.post('/', requireRole('ADMIN'), c.createValidators, handleValidation, c.create);
router.patch('/:id', requireRole('ADMIN'), c.updateValidators, handleValidation, c.update);
router.delete('/:id', requireRole('ADMIN'), c.remove);
router.post('/:id/rotate-token', requireRole('ADMIN'), c.rotateToken);

module.exports = router;
