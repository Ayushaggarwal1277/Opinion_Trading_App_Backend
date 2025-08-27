# Backend Deployment Guide - Railway

## 🚀 Quick Deployment Steps

### 1. Deploy to Railway
1. Go to [Railway.app](https://railway.app)
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo"
4. Choose: `Ayushaggarwal1277/Opinion_Trading_App_Backend`
5. Railway will automatically detect it's a Node.js app

### 2. Add MongoDB Database
1. In your Railway project dashboard
2. Click "New Service" → "Database" → "MongoDB"
3. Railway will create a MongoDB instance
4. Copy the connection string

### 3. Set Environment Variables
In Railway project settings, add these variables:
```
PORT=3000
MONGODB_URI=<your-railway-mongodb-connection-string>
ACCESS_TOKEN_SECRET=your-super-secret-jwt-key-here
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_SECRET=your-super-secret-refresh-key-here
REFRESH_TOKEN_EXPIRY=7d
CORS_ORIGIN=https://ayushaggarwal1277.github.io
```

### 4. Deploy
1. Railway will automatically deploy
2. You'll get a URL like: `https://your-app-name.railway.app`
3. Copy this URL - you'll need it for frontend

### 5. Update Frontend
Update the GitHub Pages deployment to use your Railway backend URL.

## 🔧 Alternative: Render Deployment

If Railway doesn't work, try Render:

1. Go to [Render.com](https://render.com)
2. Connect GitHub repository  
3. Create "Web Service"
4. Set:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: Node

## 📋 Environment Variables Needed

```env
PORT=3000
MONGODB_URI=mongodb://username:password@host:port/database
ACCESS_TOKEN_SECRET=your-jwt-secret-key
ACCESS_TOKEN_EXPIRY=15m  
REFRESH_TOKEN_SECRET=your-refresh-secret-key
REFRESH_TOKEN_EXPIRY=7d
CORS_ORIGIN=https://ayushaggarwal1277.github.io
```

## 🔗 After Backend is Deployed

1. Copy your backend URL (e.g., `https://your-app.railway.app`)
2. Update GitHub Actions workflow with the real backend URL
3. Push to trigger frontend redeployment
4. Your full-stack app will be live!

---

**Your app will be accessible at:**
- Frontend: https://ayushaggarwal1277.github.io/Opinion_Trading_App_Backend/
- Backend: https://your-app-name.railway.app
