# Complaint & Dispute Resolution System Upgrade - TODO

## Phase 1: Backend Models ✅ IN PROGRESS

### A) Update Complaint Model
- [x] Add resolutionType enum (refund, warning, penalty, none)
- [x] Add adminResponse field
- [x] Update status enum (Open, In Review, Resolved, Rejected)
- [x] Add isSerious boolean flag
- [x] Add isConvertedToDispute flag
- [x] Add MongoDB indexes
- [x] Update status history tracking

### B) Create Dispute Model
- [x] Create Dispute schema with all required fields
- [x] Add timelineLogs sub-schema
- [x] Add fraud detection fields
- [x] Add compensation and refund fields
- [x] Add MongoDB indexes


## Phase 2: Backend Controllers ✅ COMPLETED

### A) Update Complaint Controller
- [x] Update submitComplaint with new categories
- [x] Add convertToDispute function
- [x] Update resolveComplaint with resolutionType
- [x] Add markAsSerious function
- [x] Add provider access to complaints

### B) Create Dispute Controller
- [x] createDispute function
- [x] getMyDisputes (role-based)
- [x] getAllDisputes (admin with filters)
- [x] resolveDispute with compensation logic
- [x] escalateDispute function
- [x] addEvidence function
- [x] Fraud detection middleware
- [x] Auto-escalation logic


## Phase 3: Backend Routes ✅ COMPLETED

### A) Update Complaint Routes
- [x] Add provider middleware support
- [x] Add convert-to-dispute endpoint

### B) Create Dispute Routes
- [x] POST /dispute/create
- [x] GET /dispute/my
- [x] GET /dispute/admin/all
- [x] PUT /dispute/admin/resolve
- [x] PUT /dispute/admin/escalate
- [x] PUT /dispute/add-evidence


## Phase 4: Frontend - Customer Panel

### Update Customer Complaint Page
- [ ] Add "Raise Dispute" button
- [ ] Add dispute status timeline
- [ ] Add admin decision display
- [ ] Add refund status tracking

### Create Customer Disputes Page
- [ ] My Disputes list
- [ ] Dispute detail view
- [ ] Upload evidence feature
- [ ] Resolution display

## Phase 5: Frontend - Provider Panel

### Create Provider Complaints Page
- [ ] View complaints against provider
- [ ] Respond to complaints
- [ ] Status tracking

### Create Provider Disputes Page
- [ ] My Disputes list
- [ ] Respond to disputes
- [ ] Upload counter-evidence
- [ ] Accept/challenge decision

## Phase 6: Frontend - Admin Panel

### Update Admin Complaint Page
- [ ] Add filter by status
- [ ] Add "Convert to Dispute" button
- [ ] Add resolution type selection
- [ ] Add admin response field

### Create Admin Disputes Page
- [ ] Full dispute management
- [ ] Filter by status
- [ ] Investigation notes
- [ ] Approve refund integration
- [ ] Apply provider penalty
- [ ] Escalate case
- [ ] Close case
- [ ] Timeline viewer

## Phase 7: Integration & Security

- [ ] Update server.js with dispute routes
- [ ] Add MongoDB indexes
- [ ] Add file upload validation
- [ ] Prevent duplicate disputes
- [ ] Test refund integration
- [ ] Test provider penalty deduction

## Phase 8: Testing & Verification

- [ ] Test all complaint APIs
- [ ] Test all dispute APIs
- [ ] Verify role-based access
- [ ] Test auto-escalation
- [ ] Test fraud detection
- [ ] Test compensation logic
- [ ] Verify no breaking changes

---

## Progress Tracking
- Total Tasks: 60+
- Completed: 0
- In Progress: 0
- Pending: 60+

Started: [Date]
Last Updated: [Date]
