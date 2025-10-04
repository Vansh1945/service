# Fix "Call Provider" Button Not Showing Issue

## Completed Tasks
- [x] Analyzed the issue: "Call Provider" button in CustomerBookingsPage.jsx only shows if booking status is in ['accepted', 'assigned', 'in-progress', 'confirmed'] and booking.provider?.phone exists
- [x] Identified root cause: Backend getUserBookings API not populating provider.phone field in booking data
- [x] Updated server/controllers/Booking-controller.js to include 'phone' in provider select fields for getUserBookings function

## Pending Tasks
- [ ] Test the fix by running the server and checking customer bookings API response includes provider.phone
- [ ] Verify the "Call Provider" button shows correctly in the UI for eligible bookings
- [ ] Test the call functionality to ensure it works when button is clicked

## Notes
- The button will only show for bookings with status: accepted, assigned, in-progress, or confirmed
- Provider phone number must be available in the booking data
- After backend fix, the button should appear for eligible bookings
