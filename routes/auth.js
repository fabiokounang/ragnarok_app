const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authLoginLimiter, authRegisterLimiter } = require('../middleware/rateLimits');

router.get('/login', authController.getLogin);
router.post('/login', authLoginLimiter, authController.postLogin);
router.get('/register', authController.getRegister);
router.post('/register', authRegisterLimiter, authController.postRegister);
router.post('/logout', authController.postLogout);

module.exports = router;
