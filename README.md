# Opinion Trading App Backend

A robust backend for a prediction market application where users can trade on various market predictions with real-time updates and dynamic pricing mechanisms.

## 🚀 Features

- **User Authentication**: Secure JWT-based authentication system
- **Real-time Updates**: WebSocket integration for live market data
- **Order Matching System**: Sophisticated trade execution with exact price matching
- **Market Lifecycle Management**: Automated market expiry and settlement
- **Dynamic Pricing**: Price updates based on market activity
- **Trade Refunds**: Automatic refunds for pending trades when markets expire
- **Settlement Logic**: Winners receive 9x payout, losers get 1x commission

## 🛠️ Technologies Used

- **Node.js** - Backend runtime environment
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database for data persistence
- **Mongoose** - MongoDB object modeling
- **Socket.IO** - Real-time bidirectional event-based communication
- **JWT (jsonwebtoken)** - Authentication tokens
- **bcrypt** - Password hashing
- **node-cron** - Task scheduling for market operations
- **node-fetch** - HTTP client for external API calls

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn package manager

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Ayushaggarwal1277/Opinion_Trading_App_Backend.git
   cd Opinion_Trading_App_Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory with the following variables:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/opinion-trading
   JWT_SECRET=your_jwt_secret_key
   ```

4. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 📚 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/register` | Register a new user |
| POST | `/api/users/login` | User login |
| POST | `/api/users/logout` | User logout |

### Market Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/markets` | Create a new market |
| GET | `/api/markets` | Get all active markets |
| GET | `/api/markets/:id` | Get specific market details |

### Trade Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/trades` | Place a new trade |
| GET | `/api/trades` | Get user's trade history |

### Example API Calls

**Create a Market:**
```json
POST /api/markets
{
  "question": "Will it rain tomorrow?",
  "threshold": 30,
  "expiry": "2025-08-26T15:00:00.000Z",
  "yesPrice": 5,
  "noPrice": 5
}
```

**Place a Trade:**
```json
POST /api/trades
{
  "marketId": "60d5ec49f1b2c8b1f8e4e1a1",
  "option": "yes",
  "side": "buy",
  "amount": 10,
  "price": 6
}
```

## 🔄 Real-time Events (WebSocket)

The application uses Socket.IO for real-time communication:

### Client Events to Listen For:

- **`marketPriceUpdate`** - Market price changes
- **`newTrade`** - New trade executed
- **`userBalanceUpdate`** - User balance changes
- **`marketExpired`** - Market expiration notification
- **`marketSettled`** - Market settlement results
- **`tradeRefunded`** - Trade refund notification

### Example WebSocket Integration:

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

// Listen for market updates
socket.on('marketPriceUpdate', (data) => {
  console.log('Market Update:', data);
});

// Listen for balance updates
socket.on('userBalanceUpdate', (data) => {
  console.log('Balance Update:', data);
});
```

## 🏗️ Project Structure

```
├── controllers/           # Route controllers
│   ├── market.controller.js
│   ├── trade.controller.js
│   └── user.controller.js
├── jobs/                 # Scheduled tasks
│   └── marketScheduler.js
├── middlewares/          # Custom middleware
│   └── auth.middleware.js
├── models/               # Database models
│   ├── market.models.js
│   ├── trade.models.js
│   └── users.models.js
├── routes/               # API routes
│   ├── market.routes.js
│   └── user.routes.js
├── utils/                # Utility functions
│   ├── asyncHandler.js
│   ├── db.js
│   └── websocket.js
├── app.js               # Express app configuration
├── index.js             # Application entry point
└── package.json         # Dependencies and scripts
```

## 🎯 Key Features Explained

### Order Matching System
- Trades execute only at exact price matches
- Buy/Sell side matching with complementary pricing
- Pending orders wait for matching counterparts

### Market Settlement
- Automated settlement based on real-world data (weather API)
- Winners receive 9x their stake
- Losers receive 1x stake as commission
- Automatic refunds for unmatched trades

### Real-time Updates
- Live price updates as trades execute
- Instant balance updates for users
- Market status notifications

## 🔐 Security Features

- Password hashing with bcrypt
- JWT token-based authentication
- Input validation and sanitization
- Protected routes with middleware

## 📊 Market Mechanics

1. **Initial State**: Markets start with yesPrice = 5, noPrice = 5
2. **Trade Execution**: Orders match at exact prices only
3. **Price Discovery**: Prices reflect market sentiment through trading
4. **Settlement**: Based on external data sources (weather API)

## 🚦 Getting Started with Testing

Use Postman or any API client to test the endpoints:

1. Register a user
2. Login to get JWT token
3. Create a market
4. Place trades
5. Monitor real-time updates via WebSocket

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Ayush Aggarwal** - [Ayushaggarwal1277](https://github.com/Ayushaggarwal1277)

## 🙏 Acknowledgments

- Built for hackathon participation
- Weather data powered by Open-Meteo API
- Real-time communication via Socket.IO

---

⭐ Star this repository if you found it helpful!
