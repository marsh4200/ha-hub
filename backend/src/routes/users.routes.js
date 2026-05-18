const router = require('express').Router();
const c = require('../controllers/users.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validation');

router.use(requireAuth, requireRole('ADMIN'));

router.get('/', c.list);
router.post('/', c.createValidators, handleValidation, c.create);
router.patch('/:id', c.updateValidators, handleValidation, c.update);
router.delete('/:id', c.remove);

module.exports = router;
