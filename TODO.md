# Correct Admin/Complaint.jsx according to backend

## Tasks
- [x] Change API endpoints from singular `/complaint` to plural `/complaints` in fetchComplaints, fetchComplaintDetails, updateComplaintStatus, resolveComplaint
- [x] Remove priority-related code: priorityOptions, priority filter in UI, PriorityBadge component, priority column in table, priority display in modal
- [x] Add 'Reopened' to statusOptions and status update select
- [x] Fix booking ID display in modal to use `complaint.booking?.bookingId || complaint.booking?._id?.slice(-8) || 'N/A'`
- [ ] Test the corrected page for proper fetching, displaying, and updating complaints
