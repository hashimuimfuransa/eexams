# Deploying Testify Backend to Render

This guide explains how to deploy the Testify backend to Render.com.

## Prerequisites

1. A [Render](https://render.com) account
2. A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account for the database
3. A [Google AI Studio](https://ai.google.dev/) account for the Gemini API

## Deployment Steps

### 1. Prepare Your MongoDB Database

1. Create a MongoDB Atlas cluster if you don't already have one
2. Set up a database user with appropriate permissions
3. Whitelist all IP addresses (0.0.0.0/0) for Render deployment
4. Get your MongoDB connection string

### 2. Deploy to Render Using the Dashboard

#### Option 1: Deploy from the Render Dashboard

1. Log in to your Render account
2. Click "New" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `nationalscore-api` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && node server.js`
   - **Plan**: Free (or select a paid plan for better performance)

5. Add the following environment variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render assigns its own port, but this is used internally)
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `JWT_SECRET`: A secure random string for JWT token generation
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `FRONTEND_URL`: `https://testfyrwanda.vercel.app`

6. Set up disk storage:
   - Click on "Advanced" settings
   - Under "Disks", add a new disk
   - Name: `uploads`
   - Mount Path: `/var/data/uploads`
   - Size: 1 GB (or more if needed)

7. Click "Create Web Service"

#### Option 2: Deploy Using render.yaml (Blueprint)

1. Push the `render.yaml` file to your GitHub repository
2. In Render, click "New" and select "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect the `render.yaml` file and configure the services
5. You'll need to manually set the secret environment variables:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `GEMINI_API_KEY`

### 3. Update Your Frontend

1. Update your frontend environment variables to point to your Render backend:
   - Create a `.env.production` file in your client directory with:
     ```
     VITE_API_URL=https://nationalscore-api.onrender.com/api
     ```
   - Replace `nationalscore-api` with the actual name of your Render service

2. Redeploy your frontend on Vercel

### 4. Verify Deployment

1. Wait for the Render deployment to complete (this may take a few minutes)
2. Test the API by visiting `https://your-render-service-name.onrender.com/api/health`
3. If you see a JSON response with `{ "status": "ok" }`, your backend is working correctly
4. Test the frontend by logging in through your application

## Troubleshooting

### Deployment Issues

- **Build Failures**: Check the build logs in Render for specific errors
- **Startup Failures**: Check the logs in Render for runtime errors
- **Database Connection Issues**: Verify your MongoDB connection string and ensure the IP whitelist includes 0.0.0.0/0

### CORS Issues

- If you encounter CORS issues, verify that the `FRONTEND_URL` environment variable is set correctly
- You may need to update the CORS configuration in `server.js` to specifically allow your frontend domain

### File Upload Issues

- Render has ephemeral storage by default, which means uploaded files will be lost when the service restarts
- We've configured a persistent disk in the `render.yaml` file to store uploads
- The application has fallback logic to handle cases where the disk isn't properly mounted
- If you encounter permission errors with `/var/data/uploads`:
  1. Check if the disk is properly mounted in the Render dashboard
  2. The application will automatically fall back to using a temporary directory
  3. You can also manually set an environment variable `UPLOADS_PATH` to specify a custom path

## Maintenance

### Updating Your Deployment

1. Push changes to your GitHub repository
2. Render will automatically rebuild and redeploy your application

### Monitoring

Use Render's built-in monitoring tools to track:
- CPU and memory usage
- Request logs
- Error logs
