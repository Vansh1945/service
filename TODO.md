# Global Visiting Charge Implementation

## Backend Changes
- [x] Add static visitingCharge field to Service-model.js (default ₹100)
- [x] Add visitingCharge field to Booking-model.js schema
- [x] Update createBooking in Booking-controller.js to fetch global visitingCharge from Service model
- [x] Add admin endpoint in Services-controller.js to update global visiting charge

## Frontend Changes
- [ ] Update admin/booking.jsx to show visiting charge in payment breakdown
- [ ] Update admin/service.jsx to show and add,update visiting charge in payment breakdown
- [ ] Update provider/provider-booking.jsx to show visiting charge in payment breakdown
- [ ] Update customer/booking-service.jsx to show visiting charge in payment breakdown
- [ ] Update customer/bookingconfirmation.jsx to show visiting charge in payment breakdown
- [ ] Update customer/customerbookingpage.jsx to show visiting charge in payment breakdown
- [ ] Update customer/servicedetail.jsx to show visiting charge in payment breakdown
- [ ] Update customer/service.jsx to show visiting charge in payment breakdown

## Testing
- [ ] Test booking creation with subtotal < 100 (should apply visiting charge)
- [ ] Test booking creation with subtotal >= 100 (should not apply visiting charge)
- [ ] Verify admin can update visiting charge via admin endpoint
- [ ] Ensure frontend displays visiting charge correctly (only when > 0)
