# Remove Comment-Related Code from Complaint System

## Backend Changes
- [x] Remove commentSchema and comments field from server/models/Complaint-model.js
- [x] Remove addComment function from server/controllers/Complaint-controller.js
- [x] Remove comment additions in submitComplaint, resolveComplaint, updateComplaintStatus, reopenComplaint functions
- [x] Remove populate('comments.author') from getComplaint and getComplaintDetails functions
- [x] Remove POST /:id/comments route from server/routes/complaintRoutes.js

## Frontend Changes
- [x] Remove comments tab from ComplaintDetailsModal in client/src/pages/Admin/Complaint.jsx
- [x] Remove add comment functionality and UI from the modal
- [x] Remove comment display components
- [x] Update modal tabs to exclude comments

## Testing
- [ ] Verify complaint submission still works
- [ ] Verify complaint status updates work
- [ ] Verify complaint resolution works
- [ ] Verify frontend modal displays correctly without comments
