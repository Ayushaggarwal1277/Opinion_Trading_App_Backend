# Opinion Trading App

A comprehensive real-time prediction market platform where users can trade on Delhi temperature outcomes with live weather tracking and admin management capabilities.

## 🚀 Features

- **Real-time Trading**: WebSocket-powered live trading with instant updates
- **JWT Authentication**: Secure login system with refresh token mechanism
- **Admin Portal**: Dedicated admin interface for market creation and management
- **Live Temperature Tracking**: Real-time Delhi weather display and threshold comparison
- **Market Expiry Notifications**: Comprehensive notification system for trade outcomes
- **IST Timezone Support**: All operations in Indian Standard Time
- **Order Book System**: Live order matching with exact price execution
- **Settlement Logic**: Automated payouts - winners get ₹9/share, app takes ₹1 commission

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, MongoDB, Socket.io, node-cron
- **Frontend**: React, Vite, Tailwind CSS, WebSocket client
- **Authentication**: JWT with HTTP-only refresh tokens
- **Real-time**: WebSocket connections for live updates
- **External APIs**: Open-Meteo weather API for Delhi temperature
- **Database**: MongoDB with Mongoose ODM

## ⚙️ Environment Variables

### Backend (.env)
```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
ACCESS_TOKEN_SECRET=your_access_token_secret
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_SECRET=your_refresh_token_secret
REFRESH_TOKEN_EXPIRY=7d
CORS_ORIGIN=http://localhost:5173
```

### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:3000
```

## 🏃‍♂️ Local Development

### Backend Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Frontend Setup
```bash
# Navigate to frontend directory
cd NXTwin-frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🚀 Deployment Guide

### Frontend Deployment (GitHub Pages) - FREE
1. **Repository Setup**
   - Ensure your code is pushed to GitHub
   - Go to your repository settings
   - Navigate to Pages section
   - Select "GitHub Actions" as source

2. **Automatic Deployment**
   - GitHub Actions workflow is already configured
   - Automatically deploys on push to main branch
   - Frontend will be available at: `https://yourusername.github.io/Opinion_Trading_App_Backend/`

3. **Manual Deployment (Alternative)**
   ```bash
   cd NXTwin-frontend
   npm run deploy
   ```

### Frontend Deployment (Vercel) - FREE
1. **Connect Repository**
   - Go to [Vercel](https://vercel.com) and sign up with GitHub
   - Import your repository
   - Select the `NXTwin-frontend` folder as root directory

2. **Configure Build Settings**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Environment Variables**
   ```
   VITE_API_BASE_URL=https://your-backend-url.railway.app
   ```

4. **Deploy**
   - Click "Deploy" and your frontend will be live!

### Backend Deployment (Railway) - FREE
1. **Connect Repository**
   - Go to [Railway](https://railway.app) and sign up with GitHub
   - Create new project and connect your repository
   - Select the root directory (not frontend folder)

2. **Add Database**
   - Add MongoDB database service in Railway
   - Copy the MongoDB connection string

3. **Environment Variables**
   ```
   PORT=3000
   MONGODB_URI=mongodb://mongo:password@mongodb.railway.internal:27017
   ACCESS_TOKEN_SECRET=your_secret_here
   ACCESS_TOKEN_EXPIRY=15m
   REFRESH_TOKEN_SECRET=your_refresh_secret_here
   REFRESH_TOKEN_EXPIRY=7d
   CORS_ORIGIN=https://your-frontend-url.vercel.app
   ```

4. **Deploy**
   - Railway will automatically deploy your backend
   - Update frontend environment with backend URL

### Alternative Deployment Options
- **Frontend**: Netlify, GitHub Pages, Surge.sh
- **Backend**: Render, Heroku (paid), PlanetScale + Vercel Functions

## 📋 API Endpoints

### Authentication
- `POST /users/register` - User registration
- `POST /users/login` - User login  
- `POST /users/logout` - User logout
- `POST /users/refresh` - Refresh access token
- `GET /users/me` - Get current user profile

### Markets
- `GET /market/active` - Get all active markets
- `GET /market/:id` - Get specific market details
- `POST /market/question` - Create new market (admin only)
- `POST /market/:id/trades` - Place a trade
- `GET /market/:id/orderbook` - Get market order book
- `GET /market/:id/user-orders` - Get user's orders

### Weather
- `GET /weather/current` - Get current Delhi weather data

## 🔄 WebSocket Events

### Client Listening Events
- `market:priceUpdate` - Real-time price changes
- `market:newTrade` - New trade notifications  
- `user:balanceUpdate` - User balance updates
- `market:expired` - Market expiration alerts
- `market:settled` - Settlement results
- `trade:refunded` - Trade refund notifications
- `notification:new` - New notification alerts

## 🏗️ Project Structure

```
├── controllers/              # API route controllers
│   ├── market.controller.js  # Market operations
│   ├── trade.controller.js   # Trading logic
│   ├── user.controller.js    # User management
│   └── weather.controller.js # Weather data
├── jobs/
│   └── marketScheduler.js    # Market expiry scheduler
├── middlewares/
│   └── auth.middleware.js    # JWT authentication
├── models/                   # Database schemas
│   ├── market.models.js
│   ├── trade.models.js
│   └── users.models.js
├── routes/                   # API routes
│   ├── market.routes.js
│   ├── user.routes.js
│   └── weather.routes.js
├── utils/                    # Helper functions
│   ├── asyncHandler.js
│   ├── db.js
│   └── websocket.js
├── NXTwin-frontend/          # React frontend
│   ├── src/
│   │   ├── components/       # Reusable components
│   │   ├── context/          # React context
│   │   ├── Pages/            # Main pages
│   │   ├── services/         # API & WebSocket
│   │   └── utils/            # Frontend utilities
│   └── ...
├── app.js                    # Express configuration
└── index.js                 # Application entry point
```

## 🎯 Key Features

### Admin Portal
- Market creation with IST timezone support
- Market management and oversight
- Admin-only access controls

### Real-time Temperature Display
- Live Delhi weather in navbar
- Temperature vs threshold comparison
- Auto-refreshing weather data

### Notification System
- Trade outcome notifications
- Market settlement alerts
- Real-time notification panel
- Unread count indicators

### Advanced Trading
- Exact price matching system
- Live order book display
- Pending order management
- Automatic settlement and payouts

## 🧪 Testing the Application

### Create Admin User (Postman)
```json
POST /users/register
{
  "username": "admin",
  "email": "admin@example.com", 
  "password": "password123",
  "role": "admin"
}
```

### Test Weather API
```bash
GET /weather/current
```

### Create Test Market
```json
POST /market/question
{
  "question": "Will Delhi temperature be above 25°C tomorrow?",
  "threshold": 25,
  "expiry": "2024-01-15T15:00:00.000Z"
}
```

## 🔐 Security Features

- JWT access tokens (15 min expiry)
- HTTP-only refresh tokens (7 day expiry)
- Password hashing with bcrypt
- Role-based access control
- CORS protection
- Input validation and sanitization

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License.

## 👨‍� Author

**Ashutosh Aggarwal** - Full-stack Opinion Trading Platform

## 🙏 Acknowledgments

- Weather data from Open-Meteo API
- Real-time updates via Socket.IO
- UI components with Tailwind CSS
- Built for hackathon submission

---

⭐ **Star this repository if you found it helpful!**

🚀 **Ready for production deployment with Vercel + Railway!**
