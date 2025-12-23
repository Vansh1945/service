## Remove Bookings from Last Week

### 1. Add deleteLastWeekBookings controller function
- [ ] Create function to calculate date range (7 days ago to now)
- [ ] Find bookings created in last week
- [ ] Delete associated transactions and earnings
- [ ] Delete the bookings
- [ ] Return count of deleted bookings

### 2. Add admin route for bulk delete
- [ ] Add DELETE /admin/bookings/last-week route
- [ ] Connect to new controller function

### 3. Testing
- [ ] Test the new endpoint
- [ ] Verify proper cleanup of related data
