# Use Node.js as base image
FROM node:20-alpine

# Install Python and required dependencies for PDF extraction
RUN apk add --no-cache python3 py3-pip

# Install pdfplumber for Python PDF extraction
RUN pip3 install pdfplumber

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy server files (since Dockerfile is in server directory)
COPY . ./

# Create uploads directory with proper permissions
RUN mkdir -p /app/tmp/uploads && chmod 777 /app/tmp/uploads

# Create cache directory
RUN mkdir -p /app/server/cache && chmod 777 /app/server/cache

# Set environment variables
ENV NODE_ENV=production
ENV PORT=10000
ENV UPLOADS_PATH=/app/tmp/uploads

# Expose port
EXPOSE 10000

# Start the server
CMD ["node", "server.js"]
