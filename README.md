# FinForesight

A modern financial management application built with Next.js, Express, and microservices architecture. FinForesight helps users manage budgets, track financial goals, handle multiple accounts, and gain actionable insights into their finances.

## Features

### Core Functionality

- **Authentication & Security** - JWT-based authentication with encrypted sessions
- **Multi-Account Management** - Support for checking, savings, credit cards, cash, and investment accounts
- **Budget Tracking** - Category-based budgets with spending alerts and notifications
- **Financial Goals** - Set and track savings goals with progress visualization
- **Transaction Management** - Full CRUD operations with intelligent categorization
- **Recurring Bills** - Automated bill tracking and payment reminders
- **Receipt Management** - Upload receipts with OCR capabilities for expense tracking
- **Financial Reports** - Monthly and yearly summaries with export functionality
- **Smart Categorization** - Machine learning-based automatic transaction categorization
- **Interactive Dashboard** - Comprehensive financial overview with real-time updates

## Architecture

### Microservices

The application follows a microservices architecture with the following services:

```
┌─────────────┐
│   Frontend  │ (Next.js, Port 3001)
│  (Next.js)  │
└──────┬──────┘
       │ HTTP/WebSocket
       │
┌──────▼──────────────────────────────────────────┐
│           API Gateway (Port 3000)               │
│  Routes requests to appropriate microservices   │
└───┬───┬───┬───┬───┬───┬───┬───┬────────────────┘
    │   │   │   │   │   │   │   │
    │   │   │   │   │   │   │   └──► Notification Service (Port 3004)
    │   │   │   │   │   │   │        - WebSocket server
    │   │   │   │   │   │   │        - Real-time notifications
    │   │   │   │   │   │   │
    │   │   │   │   │   │   └──► ML Service (Port 3003)
    │   │   │   │   │   │         - Smart categorization
    │   │   │   │   │   │         - Fraud detection
    │   │   │   │   │   │         └─► Python ML Service (Port 5000)
    │   │   │   │   │   │
    │   │   │   │   │   └──► Goal Service (Port 3007)
    │   │   │   │   │         - Financial goals management
    │   │   │   │   │
    │   │   │   │   └──► Budget Service (Port 3006)
    │   │   │   │         - Budget tracking
    │   │   │   │         - Spending alerts
    │   │   │   │
    │   │   │   └──► Account Service (Port 3005)
    │   │   │         - Multi-account management
    │   │   │
    │   │   └──► Transaction Service (Port 3002)
    │   │         - Transaction CRUD
    │   │         - Reports & exports
    │   │         - Recurring transactions
    │   │
    │   └──► Auth Service (Port 3008)
    │         - User authentication
    │         - JWT token management
    │         - Session management
    │
    └──► Shared Infrastructure
          ├── MongoDB (Port 27017)
          │    └── Data persistence
          │
          └── Redis (Port 6379)
               ├── Session storage
               └── Caching layer
```

**Service Details:**

1. **Auth Service** (Port 3008) - User authentication and session management
2. **Transaction Service** (Port 3002) - Transaction CRUD operations, reports, exports
3. **Account Service** (Port 3005) - Multi-account management
4. **Budget Service** (Port 3006) - Budget tracking and alerts
5. **Goal Service** (Port 3007) - Financial goals management
6. **ML Service** (Port 3003) - Smart categorization and insights
7. **Notification Service** (Port 3004) - Real-time updates via WebSocket
8. **API Gateway** (Port 3000) - Routes requests to appropriate services

### Infrastructure

- **MongoDB** (Port 27017) - Primary database for data persistence
- **Redis** (Port 6379) - Session storage and caching layer
- **Python ML Service** (Port 5000) - Machine learning model inference

## Tech Stack

### Frontend

- **Next.js 14+** (App Router) - React framework for server-side rendering
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality UI component library
- **Zustand** - Lightweight state management
- **React Query** - Server state management and data fetching
- **Lucide React** - Icon library

### Backend

- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Redis** - In-memory data store for caching and sessions
- **JWT** - JSON Web Tokens for authentication
- **Microservices Architecture** - Scalable and maintainable service-oriented design

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js 18 or higher
- MongoDB (local or remote instance)
- Redis server
- Python 3.11 or higher (required for ML service)
- npm or yarn package manager

## Getting Started

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory:
```bash
# Copy the example file
cp .env.example .env
```

   Then edit `.env` and update the values as needed. See `backend/.env.example` for all available configuration options and descriptions.

4. Start MongoDB and Redis services:
```bash
# MongoDB (macOS)
brew services start mongodb/brew/mongodb-community@7.0

# Redis (macOS)
brew services start redis
```

5. Start all microservices. Each service should run in a separate terminal:
```bash
# Terminal 1 - Auth Service
npm run dev:auth

# Terminal 2 - Transaction Service
npm run dev:transaction

# Terminal 3 - Account Service
npm run dev:account

# Terminal 4 - Budget Service
npm run dev:budget

# Terminal 5 - Goal Service
npm run dev:goal

# Terminal 6 - ML Service
npm run dev:ml

# Terminal 7 - Notification Service
npm run dev:notification

# Terminal 8 - API Gateway
npm run dev:gateway
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the frontend directory:
```bash
# Copy the example file
cp .env.local.example .env.local
```

   Then edit `.env.local` and update the values as needed. See `frontend/.env.local.example` for all available configuration options.

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:3001`

### Test Credentials

For testing purposes, you can use the following credentials:

- **Email**: `test@finforesight.com`
- **Password**: `test123`

## Project Structure

```
FinForesight/
├── backend/
│   ├── services/
│   │   ├── auth-service/
│   │   ├── transaction-service/
│   │   ├── account-service/
│   │   ├── budget-service/
│   │   ├── goal-service/
│   │   ├── ml-service/
│   │   └── notification-service/
│   ├── shared/
│   │   ├── models/
│   │   ├── middleware/
│   │   └── utils/
│   └── gateway/
│
└── frontend/
    ├── app/
    │   ├── (auth)/
    │   ├── (dashboard)/
    │   └── layout.tsx
    ├── components/
    ├── lib/
    └── store/
```

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register a new user account
- `POST /api/auth/login` - Authenticate and login user
- `POST /api/auth/logout` - Logout current user session
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current authenticated user information

### Account Endpoints

- `GET /api/accounts` - Retrieve all user accounts
- `GET /api/accounts/:id` - Get specific account by ID
- `POST /api/accounts` - Create a new account
- `PUT /api/accounts/:id` - Update account information
- `DELETE /api/accounts/:id` - Archive an account
- `POST /api/accounts/transfer` - Transfer funds between accounts

### Transaction Endpoints

- `GET /api/transactions` - Get paginated list of transactions
- `GET /api/transactions/:id` - Get specific transaction by ID
- `POST /api/transactions` - Create a new transaction
- `PUT /api/transactions/:id` - Update transaction details
- `DELETE /api/transactions/:id` - Delete a transaction

### Budget Endpoints

- `GET /api/budgets` - Retrieve all budgets
- `GET /api/budgets/:id` - Get specific budget by ID
- `POST /api/budgets` - Create a new budget
- `PUT /api/budgets/:id` - Update budget information
- `DELETE /api/budgets/:id` - Delete a budget
- `GET /api/budgets/summary/overview` - Get budget summary overview

### Goal Endpoints

- `GET /api/goals` - Retrieve all financial goals
- `GET /api/goals/:id` - Get specific goal by ID
- `POST /api/goals` - Create a new financial goal
- `PUT /api/goals/:id` - Update goal information
- `DELETE /api/goals/:id` - Delete a goal
- `POST /api/goals/:id/contribute` - Add contribution to a goal

## Roadmap

- [x] Phase 1: Foundation & Setup
- [x] Phase 2: Accounts & Transactions UI
- [x] Phase 3: Budget System UI
- [x] Phase 4: Goals & Bills UI
- [x] Phase 5: Smart Features (Receipts, Categorization)
- [ ] Phase 6: Reports & Export

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Troubleshooting

### Common Issues

#### Services won't start
- **Check MongoDB**: Ensure MongoDB is running (`mongosh` should connect)
- **Check Redis**: Ensure Redis is running (`redis-cli ping` should return "PONG")
- **Check Ports**: Ensure ports 3000-3008 and 5000 are not in use
- **Check Environment Variables**: Verify `.env` file exists and has correct values

#### Database Connection Errors
- Verify `MONGO_URL` is correct in `.env`
- Check MongoDB is accessible: `mongosh "mongodb://localhost:27017/finforesight"`
- Ensure MongoDB service is running: `brew services list` (macOS)

#### Redis Connection Errors
- Verify `REDIS_URL` is correct in `.env`
- Check Redis is accessible: `redis-cli ping`
- Ensure Redis service is running: `brew services list` (macOS)

#### CORS Errors
- Verify `FRONTEND_URL` in backend `.env` matches frontend URL
- Check `NEXT_PUBLIC_API_URL` in frontend `.env.local` matches gateway URL
- Ensure both frontend and backend are running

#### Authentication Issues
- Verify JWT secrets are set in `.env`
- Check token expiration settings (`JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`)
- Clear browser localStorage and cookies

#### Rate Limiting Issues
- In development, set `DISABLE_RATE_LIMIT=true` in `.env`
- Or set `NODE_ENV=development` to automatically bypass rate limiting
- Clear rate limits: `npm run clear-rate-limits` (in backend directory)

### Development Tips

- Use the provided `start.sh` script to start all services at once
- Use `stop.sh` to stop all services
- Check service logs in the `logs/` directory
- Use `npm run seed` to populate test data
- Use `npm run create-test-user` to create a test user

### Getting Help

1. Check the logs in `backend/logs/` for error messages
2. Verify all environment variables are set correctly
3. Ensure all prerequisites are installed and running
4. Check that all services are running on their expected ports

## Support

For issues, questions, or feature requests, please open an issue on the [GitHub Issues](https://github.com/yourusername/FinForesight/issues) page.
