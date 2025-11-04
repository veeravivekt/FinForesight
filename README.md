# FinForesight - Financial Management Application

A modern, practical financial management application built with Next.js, Express, and microservices architecture. Focus on budgets, goals, multi-account management, and actionable financial insights.

## ✨ Features

### Core Features
- 🔐 **JWT-based Authentication** with encrypted sessions
- 💰 **Multi-Account Management** - Checking, Savings, Credit Cards, Cash, Investment accounts
- 📊 **Budget Tracking** - Category-based budgets with spending alerts
- 🎯 **Financial Goals** - Set and track savings goals with progress visualization
- 💳 **Transaction Management** - Full CRUD with smart categorization
- 📅 **Recurring Bills** - Automated bill tracking and reminders
- 📄 **Receipt Management** - Upload and OCR for expense tracking
- 📈 **Financial Reports** - Monthly/yearly summaries and exports
- 🤖 **Smart Categorization** - ML-based auto-categorization
- 📊 **Dashboard** - Comprehensive financial overview

## 🏗️ Architecture

### Microservices

1. **Auth Service** (Port 3001) - User authentication and session management
2. **Transaction Service** (Port 3002) - Transaction CRUD operations
3. **Account Service** (Port 3005) - Multi-account management
4. **Budget Service** (Port 3006) - Budget tracking and alerts
5. **Goal Service** (Port 3007) - Financial goals management
6. **ML Service** (Port 3003) - Smart categorization and insights
7. **Notification Service** (Port 3004) - Real-time updates via WebSocket
8. **API Gateway** (Port 3000) - Routes requests to services

### Infrastructure

- **MongoDB** - Primary database
- **Redis** - Session storage and caching
- **Python ML Service** (Port 5000) - ML model inference

## 🛠️ Tech Stack

### Frontend
- **Next.js 14+** (App Router) - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Zustand** - State management
- **React Query** - Server state management
- **Lucide React** - Icons

### Backend
- **Express.js** - Web framework
- **MongoDB** - Database
- **Redis** - Caching & sessions
- **JWT** - Authentication
- **Microservices** - Scalable architecture

## 📋 Prerequisites

- Node.js 18+
- MongoDB
- Redis
- Python 3.11+ (for ML service)
- npm or yarn

## 🚀 Quick Start

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
MONGO_URL=mongodb://localhost:27017/finforesight
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
FRONTEND_URL=http://localhost:3001
```

4. Start MongoDB and Redis:
```bash
# MongoDB (macOS)
brew services start mongodb/brew/mongodb-community@7.0

# Redis (macOS)
brew services start redis
```

5. Start all services (use separate terminals):
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

1. Navigate to frontend directory:
```bash
cd frontend-new
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

4. Start development server:
```bash
npm run dev
```

5. Visit: http://localhost:3001

### Test Credentials

- **Email**: `test@finforesight.com`
- **Password**: `test123`

## 📁 Project Structure

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
└── frontend-new/
    ├── app/
    │   ├── (auth)/
    │   ├── (dashboard)/
    │   └── layout.tsx
    ├── components/
    ├── lib/
    └── store/
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

### Accounts
- `GET /api/accounts` - Get all accounts
- `GET /api/accounts/:id` - Get account by ID
- `POST /api/accounts` - Create account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Archive account
- `POST /api/accounts/transfer` - Transfer between accounts

### Transactions
- `GET /api/transactions` - Get transactions (paginated)
- `GET /api/transactions/:id` - Get transaction by ID
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Budgets
- `GET /api/budgets` - Get all budgets
- `GET /api/budgets/:id` - Get budget by ID
- `POST /api/budgets` - Create budget
- `PUT /api/budgets/:id` - Update budget
- `DELETE /api/budgets/:id` - Delete budget
- `GET /api/budgets/summary/overview` - Get budget summary

### Goals
- `GET /api/goals` - Get all goals
- `GET /api/goals/:id` - Get goal by ID
- `POST /api/goals` - Create goal
- `PUT /api/goals/:id` - Update goal
- `DELETE /api/goals/:id` - Delete goal
- `POST /api/goals/:id/contribute` - Add contribution to goal

## 🎯 Roadmap

- [x] Phase 1: Foundation & Setup
- [x] Phase 2: Accounts & Transactions UI
- [x] Phase 3: Budget System UI
- [x] Phase 4: Goals & Bills UI
- [ ] Phase 5: Smart Features (Receipts, Categorization)
- [ ] Phase 6: Reports & Export

## 📝 License

ISC

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

For issues and questions, please open an issue on GitHub.
