# Use Node.js as base image
FROM node:20-alpine

# Install Python and required dependencies for PDF extraction
RUN apk add --no-cache python3 py3-pip

# Install pdfplumber for Python PDF extraction
RUN pip3 install pdfplumber

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy server files
COPY server ./server

# Create uploads directory with proper permissions
RUN mkdir -p /app/server/tmp/uploads && chmod 777 /app/server/tmp/uploads

# Set environment variable for uploads path
ENV UPLOADS_PATH=/app/server/tmp/uploads

# Expose port
EXPOSE 10000

# Start the server
CMD ["node", "server/server.js"]
