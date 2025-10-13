# TODO: Fix Forgot Password Functionality

## Steps to Complete
- [x] Update forgotPassword in Auth-controller.js: Always return success, send OTP only if user exists (prevent email enumeration).
- [x] Update verifyResetOTP in Auth-controller.js: Remove clearOTP after successful verification to keep OTP valid for reset.
- [x] Update resetPassword in Auth-controller.js: Add OTP verification, hash newPassword, check against old hash, update password, then clear OTP.
- [x] Test the updated flow (restart server, verify requests work).
