# SafeVolt Client Application

This is the frontend application for SafeVolt Solutions, a modern service marketplace platform. Built with React and Vite, it offers a high-performance, responsive UI tailored for customers, service providers, and administrators.

## Project Overview
The SafeVolt client provides distinct dashboards and workflows for different user roles, ensuring a seamless experience from browsing services to managing complex professional workflows.

## Frontend Architecture
- **Framework**: React 18 (Vite-powered)
- **Styling**: Tailwind CSS (with glassmorphism and modern aesthetics)
- **State Management**: React context (AuthContext, SocketContext)
- **Routing**: React Router DOM (with Lazy Loading support)
- **Real-time**: Socket.io-client for instant notifications
- **Notifications**: React Toastify

## Folder Structure Summary
```bash
/client
├── src/
│   ├── api/            # API utility configurations
│   ├── components/     # Reusable UI components (Navbar, Footer, Loaders)
│   ├── context/        # Global state (Auth, Socket)
│   ├── layouts/        # Role-based page structures (AdminLayout, etc.)
│   ├── pages/          # Functional pages grouped by role
│   ├── routes/         # Role-based route definitions
│   ├── utils/          # Formaters and helper functions
│   └── App.jsx         # Main routing and system configuration
```

---

## Role-wise Features

### 1. Admin Features (`/admin/*`)
*Accessed via AdminLayout and protected by role-based guards.*
- **Global Dashboard**: interactive charts showing revenue, live stats, and booking distributions.
- **Provider Verification**: Specialized UI for reviewing pending provider applications and documents.
- **Service & Category Manager**: Full CRUD interface for managing service offerings, bulk importing via Excel, and setting pricing.
- **Commission & Payouts**: Interface to set platform fees and process withdrawal requests from providers.
- **Support Command Center**: Manage all system complaints, feedbacks, and contact inquiries.
- **System Customization**: Update brand assets like logos, favicons, and banners dynamically.

### 2. Customer Features (`/customer/*`)
*Focused on service consumption and account management.*
- **Service Discovery**: Elegant storefront to browse services by category.
- **Booking Engine**: Multi-step booking process with coupon application and dynamic pricing.
- **My Bookings**: Real-time tracking of job status (Pending -> Accepted -> In-Progress -> Completed).
- **Feedback & Loyalty**: System to rate providers and manage active discounts.
- **Support Hub**: Raise complaints with image uploads and track resolution status.

### 3. Provider Features (`/provider/*`)
*Professional workspace for service fulfillment.*
- **Onboarding Journey**: Guided profile completion including document uploads (Resume, Passbook).
- **Competency Assessment**: Mandatory testing module that providers must pass to go live.
- **Booking Management**: Real-time request notifications with "Accept/Reject" actions and job timers.
- **Financial Dashboard**: Wallet overview with breakdown of earnings and withdrawal request interface.
- **Performance Tracking**: View customer ratings and historical job reports.

---

## Routing & Authentication
- **Public Routes**: Home, About, Services, Careers, Contact, Login, and Registration.
- **Protected Routes**: Wrapped in `ProtectedRoute` component which validates JWT role and approval status.
- **Preloading**: Provider routes use custom `lazyWithPreload` for improved performance on critical dashboards.

## Frontend to Backend API Mapping

| Feature | Role | Frontend Component | API Method | Backend Controller |
|---------|------|--------------------|------------|--------------------|
| Login | Public | `Login.jsx` | `POST /auth/login` | `Auth-controller.js` |
| View Profile | Shared | `Profile.jsx` | `GET /[role]/profile` | `[Role]-controller.js` |
| Create Booking | Customer | `Book-Service.jsx` | `POST /api/booking` | `Booking-controller.js` |
| Start Job | Provider | `Provider-Booking.jsx`| `PATCH /api/booking/provider/:id/start` | `Booking-controller.js` |
| Set Commission | Admin | `Commision.jsx` | `POST /api/commission/rules` | `Commission-controller.js` |
| Upload Docs | Provider | `Provider-Register.jsx`| `PUT /provider/profile/complete` | `Provider-controller.js` |

---

## State & Data Handling
- **AuthContext**: Centralized storage for JWT, user profile, and role. Manages persistent sessions via `localStorage`.
- **SocketContext**: Maintains a live connection for receiving real-time booking updates and admin broadcasts.
- **Custom Hooks**: Used throughout for fetching stats, managing forms, and handling socket events.

## Important Reusable Components
- **Navbar**: Dynamic navigation that adapts based on user role and authentication status.
- **NotificationBell**: Real-time notification aggregator with unread counters.
- **AddressSelector**: standardized location input used in registration and booking flows.
- **ProtectedRoute**: Functional wrapper that enforces role-based access and "Approved" status for providers.

## Notes / Observations
- **Deep Linking**: The app supports "Cold Start" deep linking (e.g., clicking a notification link when the app is closed) via `AuthContext` state preservation.
- **Asset Management**: Favicons and company titles are dynamically fetched from the backend in `App.jsx` to support white-labeling or rebranding.
- **Lazy Loading**: All major modules are lazy-loaded to optimize initial bundle size.
