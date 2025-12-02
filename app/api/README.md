# Artifact Uploader API

A robust Fastify-based API service for chunked file uploads to Amazon S3 with comprehensive error handling and retry logic.

## Features

- **Chunked Upload**: Break large files into manageable chunks
- **S3 Integration**: Direct multipart upload to Amazon S3
- **Validation**: Zod-based request validation
- **Retry Logic**: Automatic retry with exponential backoff
- **Progress Tracking**: Real-time upload progress monitoring
- **Resumable**: Resume interrupted uploads
- **Auto Cleanup**: Automatic cleanup of expired sessions


## Installation

```bash
cd app/api
npm install
```

## Configuration

Create a `.env` file in the `app/api` directory:

```env
# Server Configuration
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
S3_BUCKET_NAME=your-bucket-name

# Upload Configuration
MAX_FILE_SIZE=10737418240
CHUNK_SIZE=5242880
MAX_PARALLEL_CHUNKS=3
UPLOAD_EXPIRATION=3600

# CORS
CORS_ORIGIN=http://localhost:5173
```

## Development

```bash
npm run dev
```

## Production Build

```bash
npm run build
npm start
```

## API Endpoints

### POST /api/upload/initiate

Initiate a new upload session.

**Request Body:**
```json
{
  "fileName": "example.zip",
  "fileSize": 104857600,
  "fileType": "application/zip",
  "chunkSize": 5242880,
  "metadata": {
    "uploader": "user123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uploadId": "uuid",
    "fileName": "example.zip"
  }
}
```

### POST /api/upload/chunk

Upload a single chunk.

**Form Data:**
- `file`: The chunk file
- `uploadId`: Upload session ID
- `chunkIndex`: Zero-based chunk index
- `totalChunks`: Total number of chunks

**Response:**
```json
{
  "success": true,
  "data": {
    "chunkIndex": 0,
    "uploadId": "uuid",
    "etag": "etag-value",
    "partNumber": 1,
    "message": "Chunk uploaded successfully"
  }
}
```

### POST /api/upload/complete

Complete the upload and finalize the S3 multipart upload.

**Request Body:**
```json
{
  "uploadId": "uuid",
  "totalChunks": 20,
  "fileName": "example.zip"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uploadId": "uuid",
    "fileName": "example.zip",
    "fileSize": 104857600,
    "s3Key": "uploads/uuid/example.zip",
    "s3Url": "https://bucket.s3.region.amazonaws.com/...",
    "completedAt": 1234567890
  }
}
```

### GET /api/upload/status/:uploadId

Get upload session status.

**Response:**
```json
{
  "success": true,
  "data": {
    "uploadId": "uuid",
    "fileName": "example.zip",
    "fileSize": 104857600,
    "uploadedChunks": [0, 1, 2],
    "totalChunks": 20,
    "status": "uploading",
    "createdAt": 1234567890,
    "expiresAt": 1234571490
  }
}
```

### POST /api/upload/cancel

Cancel an upload session.

**Request Body:**
```json
{
  "uploadId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uploadId": "uuid",
    "message": "Upload cancelled successfully"
  }
}
```

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": 1234567890
  }
}
```
