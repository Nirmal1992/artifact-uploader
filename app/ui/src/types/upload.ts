export interface FileChunk {
  id: string;
  fileName: string;
  chunkIndex: number;
  totalChunks: number;
  blob: Blob;
  startByte: number;
  endByte: number;
  retryCount: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

export interface UploadFile {
  id: string; // Client-side ID for React key
  backendUploadId?: string; // Backend upload ID from /upload/initiate
  file: File;
  chunks: FileChunk[];
  totalSize: number;
  uploadedSize: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed';
  progress: number;
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface UploadConfig {
  chunkSize: number; // in bytes
  maxParallelChunks: number;
  maxRetries: number;
  retryDelay: number; // in milliseconds
  endpoint: string;
}

export interface ChunkUploadResponse {
  success: boolean;
  chunkIndex: number;
  message?: string;
}

