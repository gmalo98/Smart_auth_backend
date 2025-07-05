const express = require('express');
const { signup, login, verifyAccounts,resendOTP, logout, forgetPassword, resetPassword, cleanupUnverifiedEmail } = require('../controller/authController');
const isAuthenticated = require('../middlewares/isAuthenticated');

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/verify-account", isAuthenticated, verifyAccounts);
router.post("/resend-otp",isAuthenticated,resendOTP);
router.post('/logout',logout);
router.post('/forget-password',forgetPassword);
router.post('/reset-password',resetPassword);
router.get('/cleanup-unverified-users',cleanupUnverifiedEmail)
module.exports = router;
