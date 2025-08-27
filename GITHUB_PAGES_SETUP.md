# GitHub Pages Deployment Guide

## 🚀 Steps to Enable GitHub Pages

### 1. Enable GitHub Pages in Repository Settings
1. Go to your repository: https://github.com/Ayushaggarwal1277/Opinion_Trading_App_Backend
2. Click on **Settings** tab
3. Scroll down to **Pages** section in the left sidebar
4. Under **Source**, select **"GitHub Actions"**
5. Save the settings

### 2. GitHub Actions Workflow
✅ Already configured! The workflow file is at `.github/workflows/deploy-frontend.yml`

### 3. Update Backend URL
Once you deploy your backend, update the environment variable in the workflow:
- Edit `.github/workflows/deploy-frontend.yml`
- Replace `https://your-backend-url.railway.app` with your actual backend URL

### 4. Your Site Will Be Available At:
```
https://ayushaggarwal1277.github.io/Opinion_Trading_App_Backend/
```

### 5. Manual Deployment (Alternative)
If you prefer to deploy manually:
```bash
cd NXTwin-frontend
npm run deploy
```

## 🔧 Troubleshooting

### If the deployment fails:
1. Check the Actions tab in your GitHub repository
2. Ensure GitHub Pages is enabled with "GitHub Actions" source
3. Make sure the repository is public (or you have GitHub Pro for private repos)

### To update the deployed site:
1. Make changes to your frontend code
2. Commit and push to the main branch
3. GitHub Actions will automatically redeploy

## 📝 Next Steps
1. ✅ Enable GitHub Pages in repository settings
2. 🔄 Deploy your backend to Railway/Render
3. 🔧 Update the backend URL in the GitHub Actions workflow
4. 🎉 Your Opinion Trading App will be live!

---
**Note**: The first deployment might take 5-10 minutes. Subsequent deployments are faster.
