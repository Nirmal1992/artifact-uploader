# Artifact Uploader

A full-stack application for uploading large files to Amazon S3 with advanced features like chunked uploads, parallel processing, automatic retry, and network resilience.




https://github.com/user-attachments/assets/c95359bc-3ea3-4612-ae2f-7c4488913fc6





## Features

### Frontend (React + TypeScript + TailwindCss)

### Backend (Fastify + TypeScript + Zod + AWS S3 client)



See [API Documentation](app/api/README.md) for detailed endpoint specifications.
See [UI Documentation](app/ui/README.md) for detail UI setup.

## How It Works

### 1. File Chunking
Large files are split into smaller chunks (default 5MB) on the client side using the `File.slice()` API.

### 2. Upload Initiation
The client requests an upload session from the backend, which creates a multipart upload in S3.

### 3. Parallel Upload
Multiple chunks are uploaded in parallel (default 3 concurrent uploads) to maximize bandwidth utilization.

### 4. Retry Logic
Failed chunks are automatically retried with exponential backoff. Successful chunks are tracked to avoid re-uploading.

### 5. Completion
Once all chunks are successfully uploaded, the client notifies the backend to complete the S3 multipart upload.

### 6. Error Handling
Network failures, timeouts, and errors are handled gracefully with automatic retry and resume capabilities.





