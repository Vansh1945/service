# TODO: Fix Forgot Password Functionality

## Steps to Complete
- [ ] Update forgotPassword in Auth-controller.js: Always return success, send OTP only if user exists (prevent email enumeration).
- [ ] Update verifyResetOTP in Auth-controller.js: Remove clearOTP after successful verification to keep OTP valid for reset.
- [ ] Update resetPassword in Auth-controller.js: Add OTP verification, hash newPassword, check against old hash, update password, then clear OTP.
- [ ] Test the updated flow (restart server, verify requests work).
