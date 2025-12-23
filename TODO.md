# Add 'scheduled' status for bookings

## Tasks
- [ ] Update Booking model enum to include 'scheduled'
- [ ] Update pre-save hook in Booking model to handle 'scheduled' status change
- [ ] Change confirmBooking function to set status to 'scheduled' instead of 'pending'
- [ ] Update allowedTransitions in updateBookingStatus to include 'scheduled' transitions
- [ ] Update getUserBookings to include 'scheduled' in upcoming statuses
- [ ] Update getBookingsByStatus validStatuses to include 'scheduled'
