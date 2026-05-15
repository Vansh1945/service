# Client - Frontend React Application Documentation

## 🔹 Frontend Overview
This is the client-side application for the Service platform, built with modern web technologies to provide a responsive, fast, and interactive user experience. The application serves three distinct user roles: Customers, Providers, and Administrators, with role-based routing and tailored user interfaces.

## 🔹 Tech Stack
- **Framework:** React 18
- **Build Tool:** Vite
- **Styling & UI:** TailwindCSS, Material-UI (MUI), Ant Design, Styled Components
- **Routing:** React Router v7
- **State Management:** Context API (Auth Context), Zustand
- **Data Fetching & Caching:** Axios, React Query
- **Forms & Validation:** React Hook Form, Yup
- **Charts & Analytics:** Recharts, Chart.js
- **Real-Time:** Socket.io-client, Firebase (Cloud Messaging)
- **Maps:** Google Maps API (`@react-google-maps/api`)
- **Dates & Times:** date-fns, DayJS, Moment.js
- **Other Utilities:** Framer Motion (Animations), React Toastify/Hot Toast (Alerts), React Razorpay, React Quills (Rich Text).

## 🔹 Folder Structure
```text
client/
├── public/                 # Static public assets (icons, manifest.json)
├── src/
│   ├── api/                # Axios instance configuration and interceptors
│   ├── assets/             # Images, SVGs, and other local static files
│   ├── components/         # Reusable UI components (Navbar, Footer, Loaders, Modals)
│   ├── context/            # React Context providers (AuthContext, ThemeContext)
│   ├── hooks/              # Custom React hooks
│   ├── layouts/            # Page layouts wrapper (AdminLayout, CustomerLayout, etc.)
│   ├── pages/              # View components grouped by features/roles
│   │   ├── Admin/          # Admin dashboard pages
│   │   ├── Customer/       # Customer interface pages
│   │   ├── Provider/       # Provider dashboard pages
│   │   └── ...             # Public pages (Home, Login, About)
│   ├── routes/             # Route definitions (AdminRoutes, CustomerRoutes, etc.)
│   ├── services/           # API wrapper functions to interact with the backend
│   ├── socket/             # WebSocket context and event listeners
│   ├── utils/              # Helper functions (formatting, validation, constants)
│   ├── App.jsx             # Main application component and routing hub
│   └── main.jsx            # React entry point
├── package.json            # Project dependencies
├── tailwind.config.js      # Tailwind CSS configuration
└── vite.config.js          # Vite configuration
```

## 🔹 Pages & Components

### Public Pages
- **Home (`/`)**: Landing page showcasing featured services, hero section, and platform benefits.
- **Services (`/services`)**: Public catalog of available services.
- **Authentication**: `Login`, `Customer Registration`, `Provider Registration`, `Forgot Password`.
- **Informational**: `About`, `Careers`, `Contact`, `Privacy Policy`, `Terms and Conditions`, `Refund Policy`.

### Admin Panel Pages (`/admin/*`)
- **Dashboard**: High-level metrics, charts (Recharts), and recent activity overviews.
- **Providers**: Manage approved and pending provider applications.
- **Customers**: User directory and management.
- **Bookings**: Global view of all appointments across the platform.
- **Services & Categories**: Interface to add/edit/delete service offerings.
- **Coupons**: Discount code management.
- **Commission**: Platform fee settings.
- **Feedback & Complaints**: Moderation of user reviews and issue tickets.
- **System Settings**: Application configuration (Logo, banners, text).
- **Notifications**: Broadcast push notification management.
- **Transactions & Payouts**: Financial tracking and provider payout processing.

### Provider Dashboard (`/provider/*`)
- **Dashboard**: Quick stats (earnings, pending requests, ratings).
- **Booking Requests**: Interface to accept/decline new jobs and update status.
- **Earnings**: Track completed jobs, commissions deducted, and total payouts.
- **Profile**: Update availability, location, and upload necessary KYC documents.
- **Test/Onboarding**: Skill verification tests for new providers.
- **Feedback**: View customer ratings and comments.

### Customer Interface (`/customer/*`)
- **Service Catalog**: Browse and filter services.
- **Service Details**: View service description, price, and reviews.
- **Book Service**: Multi-step checkout process (Select Time -> Add Address -> Apply Coupon -> Pay).
- **Bookings**: Track upcoming and past appointments.
- **Profile**: Manage personal details and saved addresses.
- **Feedback & Complaints**: Submit reviews or raise issues regarding a booking.

---

## 🔹 Features

- **UI Features**: Responsive mobile-first design, interactive hover states, skeletons for loading states, and animated transitions using Framer Motion.
- **Booking Flow**: Intuitive, wizard-like booking experience. Address selection with Google Maps integration.
- **Login/Signup Flow**: Role-based redirection upon successful authentication. OTP support.
- **Dashboard Features**: Rich data visualization using charts, data grids for tabular data, and export options (Excel/PDF).
- **Filters / Search**: Advanced filtering capabilities for services and booking histories.
- **Real-Time Updates**: Socket.io integration for instant notification alerts and booking status changes without page refresh.
- **Push Notifications**: Firebase Cloud Messaging (FCM) implementation to receive alerts even when the app is in the background.

---

## 🔹 Role-Based UI

### Admin UI:
- Features a persistent sidebar for deep navigation.
- Data-heavy views utilize DataGrids with pagination, sorting, and bulk actions.
- Access to global settings and financial reports.

### Provider UI:
- Action-oriented interface focusing on pending tasks (Accept/Decline buttons).
- Earnings visualization.
- Status toggle for "Online/Offline" availability.

### Customer UI:
- E-commerce style layout prioritizing discoverability of services.
- Prominent search bars and category filters.
- Clear status indicators for ongoing bookings.

---

## 🔹 API Integration

The frontend uses an `axios` instance configured in `/src/api` to communicate with the backend. 
- Base URL is determined by environment variables (`VITE_API_URL`).
- Requests automatically attach the JWT Bearer token from local storage/context via interceptors.
- `src/services/` directory maps directly to Backend API domains (e.g., `AuthService.js`, `BookingService.js`, `AdminService.js`).

---

## 🔹 State Management

- **Context API (`AuthContext`)**: Manages the global authentication state, storing the currently logged-in user, their role, and JWT token. It also handles deep linking states from notifications.
- **Context API (`SocketContext`)**: Maintains a persistent WebSocket connection globally to emit and listen to real-time events.
- **Local State**: `useState` and `useReducer` are heavily utilized for component-level state (forms, UI toggles).
- **Data Fetching State**: Handled natively by custom hooks tracking `loading`, `data`, and `error` states for API calls.

---

## 🔹 Future Improvements
- Migrate data fetching logic entirely to `@tanstack/react-query` to improve caching, background updates, and reduce boilerplate code.
- Implement a robust centralized state management system like Redux Toolkit or Zustand for deeper global state needs (e.g., a complex shopping cart).
- Add e2e testing using Cypress or Playwright.
- Implement server-side rendering (SSR) or Static Site Generation (SSG) with a framework like Next.js for improved SEO on public pages, although Vite provides a fast SPA experience.
- Enhance accessibility (a11y) across all interactive components.
