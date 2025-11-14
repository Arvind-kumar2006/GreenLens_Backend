# Backend Deployment Guide

## Prerequisites

Before deploying, you need:

1. **MongoDB Database** - Sign up for free at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. **Climatiq API Key** - Get it from [Climatiq](https://www.climatiq.io/)
3. **GitHub Account** (for most deployment platforms)

## Environment Variables

Set these in your deployment platform:

- `MONGODB_URI` - Your MongoDB connection string
- `CLIMATIQ_API_KEY` - Your Climatiq API key
- `PORT` - Server port (usually auto-set by platform)

## Deployment Options

### Option 1: Render (Recommended - Free Tier Available)

1. Go to [Render](https://render.com)
2. Sign up/login with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name**: `greenlens-backend` (or your choice)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Root Directory**: `Backend`
6. Add Environment Variables:
   - `MONGODB_URI`
   - `CLIMATIQ_API_KEY`
   - `NODE_ENV=production`
7. Click "Create Web Service"

**Note**: Update your frontend `REACT_APP_API_URL` to your Render URL (e.g., `https://greenlens-backend.onrender.com/api`)

### Option 2: Railway

1. Go to [Railway](https://railway.app)
2. Sign up/login with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Set Root Directory to `Backend`
6. Add Environment Variables in the Variables tab
7. Railway will auto-detect Node.js and deploy

### Option 3: Vercel (Serverless) ⚡

**Prerequisites**: The `vercel.json` and `api/index.js` files are already configured.

#### Method 1: Using Vercel Dashboard (Recommended)

1. Go to [Vercel](https://vercel.com)
2. Sign up/login with GitHub
3. Click "Add New..." → "Project"
4. Import your GitHub repository
5. Configure:
   - **Framework Preset**: Other
   - **Root Directory**: `Backend` (important!)
   - **Build Command**: Leave empty (Vercel will auto-detect)
   - **Output Directory**: Leave empty
6. Add Environment Variables:
   - `MONGODB_URI` - Your MongoDB connection string
   - `CLIMATIQ_API_KEY` - Your Climatiq API key
   - `NODE_ENV` - Set to `production`
7. Click "Deploy"

#### Method 2: Using Vercel CLI

1. Install Vercel CLI globally:
   ```bash
   npm i -g vercel
   ```

2. Navigate to the Backend directory:
   ```bash
   cd Backend
   ```

3. Login to Vercel:
   ```bash
   vercel login
   ```

4. Deploy:
   ```bash
   vercel
   ```

5. Follow the prompts:
   - Set up and deploy? **Yes**
   - Which scope? (Select your account)
   - Link to existing project? **No**
   - Project name? (Press Enter for default)
   - Directory? **./** (current directory)
   - Override settings? **No**

6. Add environment variables:
   ```bash
   vercel env add MONGODB_URI
   vercel env add CLIMATIQ_API_KEY
   vercel env add NODE_ENV production
   ```

7. Redeploy with environment variables:
   ```bash
   vercel --prod
   ```

**Note**: Your API will be available at `https://your-project-name.vercel.app/api`

### Option 4: Heroku

1. Install Heroku CLI
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Set environment variables:
   ```bash
   heroku config:set MONGODB_URI=your_mongodb_uri
   heroku config:set CLIMATIQ_API_KEY=your_api_key
   ```
5. Deploy: `git push heroku main`

## Setting Up MongoDB Atlas

1. Create account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (free tier available)
3. Create database user
4. Whitelist IP address (use `0.0.0.0/0` for all IPs, or your deployment platform's IP)
5. Get connection string from "Connect" → "Connect your application"
6. Replace `<password>` with your database user password

## Testing Deployment

After deployment, test your API:

```bash
# Health check
curl https://your-backend-url.com/

# Should return: {"status":"OK","message":"Carbon Footprint API is running"}
```

## Frontend Configuration

After deploying, update your frontend `.env` file:

```env
REACT_APP_API_URL=https://your-backend-url.com/api
```

## Troubleshooting

- **Connection errors**: Check MongoDB Atlas IP whitelist
- **API errors**: Verify CLIMATIQ_API_KEY is set correctly
- **Build errors**: Ensure `package.json` has correct start script
- **CORS errors**: Backend already has CORS enabled for all origins

