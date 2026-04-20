# SafeVolt Server API Documentation

Welcome to the backend documentation for the SafeVolt Solutions project. This server is built using Node.js, Express, and MongoDB, providing a robust RESTful API with real-time capabilities via Socket.io.

## Project Overview
The SafeVolt server handles authentication, service management, booking workflows, financial transactions, and role-based access control for Admins, Customers, and Providers. It integrates with Cloudinary for file storage and uses JWT for secure session management.

## Backend Architecture
- **Environment**: Node.js / Express
- **Database**: MongoDB (Mongoose ODM)
- **Real-time**: Socket.io
- **Storage**: Cloudinary (via Multer)
- **Security**: JWT Authentication, CORS, Role-based Protection

## Folder Structure
```bash
/server
├── config/             # Database & global configurations
├── controllers/        # Business logic for each module
├── middlewares/        # Auth, role-checks, and file upload handlers
├── models/             # Mongoose schemas and models
├── routes/             # API endpoint definitions
├── services/           # External service integrations (Cloudinary, etc.)
├── socket/             # Socket.io server-side implementation
├── uploads/            # Local temporary storage (if applicable)
├── utils/              # Helper functions and constants
└── server.js           # Entry point of the application
```

---

## Role-wise Features

### 1. Admin Features (Super Access)
- **System Dashboard**: Real-time stats, revenue analytics, and performance monitoring.
- **Provider Management**: Verify pending registrations, approve/reject providers, and monitor performance.
- **User Management**: Unified view of all customers and their activity.
- **Booking Oversight**: Assign providers to bookings, reschedule, or cancel on behalf of users.
- **Financial Control**: Configure commission rules (fixed/percentage), manage withdrawal requests, and generate ledger reports.
- **Content Management**: CRUD operations for Services, Categories, Banners, and FAQ/Support Questions.
- **System Settings**: Global configuration for company name, logo, and favicon.
- **Broadcast System**: Send global notifications to all users/providers.

### 2. Customer Features
- **Profile Management**: Secure registration, login, and profile customization.
- **Service Booking**: Dynamic booking flow with coupon application and real-time status tracking.
- **Payments**: Integrated payment tracking and history.
- **Feedback & Support**: Rate services and raise complaints with image evidence.
- **Notifications**: Real-time alerts for booking changes and admin broadcasts.

### 3. Provider Features
- **Onboarding & Assessment**: Professional registration with document verification and mandatory competency tests.
- **Job Management**: Accept/Reject booking requests, update service milestones (Start -> Complete).
- **Earnings Dashboard**: Detailed breakdown of daily/weekly/monthly earnings and withdrawal history.
- **Performance Analytics**: View customer ratings and feedback.
- **Support**: Direct communication with admin via the complaint system.

---

## Models & Database Flow
| Model | Description | Relations |
|-------|-------------|-----------|
| `User` | Customer profiles & auth | Links to `Booking`, `Feedback` |
| `Provider` | Provider profiles, docs, test status | Links to `Booking`, `Earnings` |
| `Admin` | Superuser accounts | Manages all models |
| `Service` | Offered services & pricing | Categorized by `SystemSetting.categories` |
| `Booking` | Transactional job data | References `User`, `Provider`, `Service` |
| `Complaint` | Support tickets | Linked to `User` or `Provider` |
| `Transaction` | Financial logs | References `Booking`, `Provider` |
| `Notification` | System & Broadast messages | Targeted by `recipientId` |

---

## API Documentation Overview

### Authentication & Authorization
- **JWT Usage**: Tokens are issued upon login and must be sent in the `Authorization: Bearer <token>` header.
- **Role Protection**: Middlewares like `adminAuthMiddleware`, `userAuthMiddleware`, and `providerAuthMiddleware` enforce access control.
- **Provider Assessment**: `providerTestPassedMiddleware` ensures only qualified providers can accept jobs.

### Major API Endpoints
| Endpoint | Method | Role | Purpose |
|----------|--------|------|---------|
| `/api/auth/login` | POST | Public | Authenticate and get token |
| `/api/admin/dashboard/stats` | GET | Admin | Fetch overall business metrics |
| `/api/customer/book-service` | POST | Customer | Create a new service request |
| `/api/provider/profile/complete` | PUT | Provider | Upload verification documents |
| `/api/booking/provider/:id/complete`| PATCH| Provider| Mark a job as finished |
| `/api/complaint/` | POST | Shared | Submit a support ticket |
| `/api/system-setting/categories` | GET | Public | List all active service categories |

---

## Frontend to Backend Feature Mapping

| Feature | Role | Frontend Page | Backend Endpoint | Controller |
|---------|------|---------------|------------------|------------|
| Registration | Customer | `/register` | `POST /api/customer/register` | `User-controller.js` |
| Booking | Customer | `/customer/book-service/:id` | `POST /api/booking/` | `Booking-controller.js` |
| Job Management | Provider | `/provider/booking-requests` | `PATCH /api/booking/provider/:id/accept` | `Booking-controller.js` |
| Verification | Admin | `/admin/approve-providers` | `PUT /api/admin/providers/:id/status` | `Admin-controller.js` |
| Payouts | Admin | `/admin/payout` | `PUT /api/payment/admin/withdrawal-request/:id/approve` | `paymentController.js` |
| Assessment | Provider | `/provider/test` | `POST /api/test/submit` | `Test-controller.js` |

---

## Validation & Error Handling
- **Global Error Handler**: Centralized middleware in `server.js` for consistent JSON error responses.
- **Validations**: Per-field validation in controllers and Mongoose schema constraints.
- **Authentication**: Unauthorized (401) and Forbidden (403) responses for invalid tokens or restricted roles.

## Notes / Observations
- **Modular Routes**: The project uses granular route files (e.g., `Commission-route.js`, `Question-route.js`) for better maintainability.
- **Hybrid Auth**: Some routes like `/api/complaint` use a `sharedAuth` middleware to support multiple roles on a single endpoint.
- **Real-time Notifications**: Socket events are triggered upon booking status changes and broadcasted to relevant parties.
