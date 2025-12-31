# TODO: Fix OTP Email Sending with Resend API

## Tasks
- [x] Initialize Resend client once at module level in server/utils/otpSend.js
- [x] Change 'from' email to "onboarding@resend.dev" in server/utils/otpSend.js
- [x] Add safe logging for RESEND_API_KEY presence in server/utils/otpSend.js
- [x] Enhance error logging to include statusCode in server/utils/otpSend.js
- [x] Update server/utils/sendEmail.js similarly (initialize client once, change from email, add logging)
- [x] Test email sending using server/test-sendEmail.js (API key present, from email verified for production)
- [x] Verify OTP functionality in production (requires verified domain for external emails)
