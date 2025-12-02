export interface UploadSession {
  uploadId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  chunkSize: number;
  totalChunks: number;
  s3Key: string;
  s3UploadId: string;
  uploadedParts: UploadedPart[];
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  metadata?: Record<string, string>;
  createdAt: number;
  expiresAt: number;
}

export interface UploadedPart {
  partNumber: number;
  etag: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

