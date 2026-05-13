# Deploying Testify Frontend to Vercel

This guide explains how to deploy the Testify frontend to Vercel with proper SPA routing.

## Prerequisites

1. A [Vercel](https://vercel.com) account
2. Your backend API deployed (e.g., on Render.com)

## Deployment Steps

### 1. Prepare Your Frontend

1. Make sure your `.env.production` file is set up with the correct backend URL:
   ```
   VITE_API_URL=https://your-backend-url.onrender.com/api
   ```

2. Verify that the following files exist:
   - `client/vercel.json` - Configures Vercel to handle SPA routing
   - `client/public/_redirects` - Additional redirect configuration
   - `client/public/404.html` - Fallback page for client-side routing

3. Build your frontend locally to test:
   ```
   cd client
   npm run build
   ```

### 2. Deploy to Vercel

#### Option 1: Deploy from the Vercel Dashboard

1. Log in to your Vercel account
2. Click "New Project" and import your GitHub repository
3. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. Add environment variables:
   - `VITE_API_URL`: Your backend API URL (e.g., `https://nationalscore-api.onrender.com/api`)

5. Click "Deploy"

#### Option 2: Deploy Using Vercel CLI

1. Install the Vercel CLI:
   ```
   npm install -g vercel
   ```

2. Navigate to your client directory:
   ```
   cd client
   ```

3. Run the deployment command:
   ```
   vercel
   ```

4. Follow the prompts to configure your project
5. Set environment variables when prompted

### 3. Verify Deployment

1. Once deployed, Vercel will provide a URL for your frontend
2. Test the following scenarios:
   - Navigate to the homepage
   - Log in and navigate to the dashboard
   - **Refresh the page** on any route (this should work without 404 errors)
   - Directly access a route like `/dashboard` or `/login`

### 4. Troubleshooting SPA Routing Issues

If you still encounter "not found" errors when refreshing:

1. **Check vercel.json**: Ensure it contains the proper rewrites configuration:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```

2. **Verify _redirects file**: Make sure it contains:
   ```
   /* /index.html 200
   ```

3. **Check build output**: Verify that the build process is generating the correct files:
   ```
   npm run build:vercel
   ```
   This should create `index.html`, `200.html`, and `404.html` in the `dist` directory.

4. **Update project settings**: In the Vercel dashboard, go to your project settings and:
   - Under "Build & Development Settings", ensure the framework preset is set to "Vite"
   - Under "Output Directory", ensure it's set to "dist"

5. **Redeploy**: After making changes, redeploy your application:
   ```
   vercel --prod
   ```

## Additional Configuration

### Custom Domain

1. In the Vercel dashboard, go to your project
2. Click on "Domains"
3. Add your custom domain and follow the verification steps

### Environment Variables

You can update environment variables in the Vercel dashboard:
1. Go to your project
2. Click on "Settings" > "Environment Variables"
3. Add or update variables as needed

### Automatic Deployments

Vercel automatically deploys when you push to your GitHub repository. You can configure this behavior:
1. Go to your project
2. Click on "Settings" > "Git"
3. Configure production and preview branches
