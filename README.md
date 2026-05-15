# Service Booking Platform - Comprehensive Documentation

Welcome to the root documentation for the Service Booking Platform. This project is a complete, production-ready full-stack web application designed to connect Customers with Service Providers, managed by a centralized Admin dashboard.

## 📌 Project Overview
The platform allows users to browse and book various household and professional services. Providers can register, pass skill tests, accept jobs, and track their earnings. Administrators have complete oversight of the system, managing users, resolving complaints, monitoring financials, and broadcasting notifications.

## 🚀 Key Features (High-level)
- **Multi-Role System:** Dedicated interfaces and logic for Admins, Providers, and Customers.
- **Complete Booking Lifecycle:** From browsing to checkout, assignment, status tracking, and completion.
- **Secure Authentication:** JWT-based auth with OTP verifications and role-based route protection.
- **Integrated Payments:** Seamless online transactions using Razorpay.
- **Real-Time Communication:** Instant alerts and updates powered by WebSockets (Socket.io) and Firebase Push Notifications.
- **Analytics & Reporting:** Rich dashboards with charts, financial tracking, and exportable reports (PDF/Excel).
- **Responsive Design:** A beautifully crafted, mobile-friendly frontend using Tailwind CSS and Material UI.

## 🛠 Tech Stack

### Frontend (Client)
- **React 18** & **Vite** for fast and modern UI development.
- **TailwindCSS**, **Material-UI**, and **Ant Design** for styling and components.
- **React Router v7** for complex, lazy-loaded routing.
- **Axios** for API communication.
- **Recharts** & **Chart.js** for analytics visualization.

### Backend (Server)
- **Node.js** & **Express.js** providing a robust API layer.
- **MongoDB** & **Mongoose** for a flexible, scalable NoSQL database.
- **Socket.io** for real-time bidirectional event-based communication.
- **Firebase Admin** for sending push notifications.
- **Cloudinary** for cloud-based media storage.
- **Razorpay** SDK for payment gateway integration.

## 🏗 Architecture Overview
The project follows a standard decoupled Client-Server architecture:
1. **Frontend (SPA):** A Single Page Application that consumes RESTful APIs. It handles UI rendering, client-side validation, and state management.
2. **Backend (REST API):** A stateless Node/Express server that processes business logic, interacts with the MongoDB database, integrates with third-party services (Razorpay, Cloudinary), and serves JSON responses.
3. **Database Layer:** MongoDB hosted (e.g., MongoDB Atlas) stores all application data in document collections.
4. **Real-time Layer:** A parallel WebSocket connection exists between the client and server to push instant updates (e.g., "Booking Accepted").

## 👥 User Roles Explanation

### 1. Admin
The highest level of access. Admins operate behind a protected dashboard to oversee platform health.
- **Key Capabilities:** Approve/Reject Providers, manage categories and service listings, view all bookings and transactions, handle payouts, set commission rates, resolve complaints, and broadcast system-wide notifications.

### 2. Provider
The service fulfillers. They have a specialized app interface to manage their workload.
- **Key Capabilities:** Take qualification tests, receive booking requests, update job statuses (Accept/Reject/Complete), track daily/monthly earnings, manage profile availability, and view customer feedback.

### 3. Customer
The end-users who consume services.
- **Key Capabilities:** Browse services, securely book appointments, apply promotional coupons, make online payments, track the real-time status of their bookings, and leave reviews for Providers.

## 🔄 How the System Works (Core Flow)
1. **Onboarding:** A Customer or Provider registers. Providers must pass a test and await Admin approval.
2. **Browsing:** Customer explores services, selects one, chooses a date/time, provides an address, and initiates checkout.
3. **Checkout:** Customer pays (or selects COD if available). A `Booking` record is created.
4. **Assignment:** Depending on the business logic, the booking is broadcasted to relevant approved Providers.
5. **Acceptance:** A Provider accepts the booking request.
6. **Fulfillment:** The Provider updates the status to 'In Progress' and then 'Completed'.
7. **Settlement:** The payment is finalized. The system calculates the commission, records the platform profit, and logs the Provider's earnings for future payout by the Admin.
8. **Feedback:** The Customer rates the service and the Provider.

## 📂 Folder Structure Overview
```text
Project-Root/
├── client/                 # Frontend React Application
│   ├── src/                # UI components, pages, routes, hooks
│   ├── public/             # Static assets
│   ├── package.json        # Frontend dependencies
│   └── vite.config.js      # Vite build config
├── server/                 # Backend Node/Express Application
│   ├── controllers/        # Route logic
│   ├── models/             # Database schemas
│   ├── routes/             # API endpoints
│   ├── config/             # DB & Environment setup
│   ├── package.json        # Backend dependencies
│   └── server.js           # Server entry point
└── README.md               # This documentation file
```

## ⚙️ Installation & Setup

### Prerequisites
- Node.js (v18+ recommended)
- MongoDB (Local or Atlas instance)
- Git

### 1. Clone the repository
```bash
git clone <repository-url>
cd <project-folder>
```

### 2. Server Setup (Backend)
```bash
cd server
npm install
```
- Create a `.env` file in the `server` directory and configure your environment variables:
  - `PORT=5000`
  - `MONGO_URI=<Your MongoDB Connection String>`
  - `JWT_SECRET=<Your Secret Key>`
  - `FRONTEND_URL=http://localhost:5173`
  - *Add Razorpay, Cloudinary, and Firebase keys as required by the backend setup.*
- Start the server:
```bash
npm run dev
```

### 3. Client Setup (Frontend)
Open a new terminal window:
```bash
cd client
npm install
```
- Create a `.env` file in the `client` directory:
  - `VITE_API_URL=http://localhost:5000`
  - *Add other necessary VITE_ variables.*
- Start the frontend:
```bash
npm run dev
```

### 4. Access the App
- Frontend runs at: `http://localhost:5173`
- Backend API runs at: `http://localhost:5000/api`

## 🔮 Future Improvements
- **Automated Deployments:** Implement GitHub Actions to deploy to Vercel (Frontend) and Render/AWS (Backend) automatically.
- **Dockerization:** Add Dockerfiles and `docker-compose.yml` to spin up the entire stack with a single command.
- **Microservices Architecture:** As the platform grows, separate Notification, Payment, and User services into independent microservices.
- **Enhanced Search:** Integrate Elasticsearch or Algolia for highly optimized, typo-tolerant search features on the frontend.
- **Advanced Matchmaking:** Implement an AI/ML based recommendation system to auto-assign the best providers based on past ratings, location proximity, and workload.

---
*For specific details on the API architecture, please refer to the [Server README](./server/README.md). For details on the UI and React structure, refer to the [Client README](./client/README.md).*
