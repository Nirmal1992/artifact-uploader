import { z } from 'zod';

// Initiate upload schema
export const initiateUploadSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().positive('File size must be positive'),
  fileType: z.string().min(1, 'File type is required'),
  chunkSize: z.number().positive('Chunk size must be positive').optional(),
  metadata: z.record(z.string()).optional(),
});

export type InitiateUploadInput = z.infer<typeof initiateUploadSchema>;

// Upload chunk schema (for multipart form data validation)
export const uploadChunkSchema = z.object({
  uploadId: z.string().min(1, 'Upload ID is required'),
  chunkIndex: z.string().regex(/^\d+$/, 'Chunk index must be a number').transform(Number),
  totalChunks: z.string().regex(/^\d+$/, 'Total chunks must be a number').transform(Number),
  // file is handled by multipart
});

export type UploadChunkInput = z.infer<typeof uploadChunkSchema>;

// Complete upload schema
export const completeUploadSchema = z.object({
  uploadId: z.string().min(1, 'Upload ID is required'),
  totalChunks: z.number().int().positive('Total chunks must be a positive integer'),
  fileName: z.string().min(1, 'File name is required'),
});

export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;

// Get upload status schema
export const getUploadStatusSchema = z.object({
  uploadId: z.string().min(1, 'Upload ID is required'),
});

export type GetUploadStatusInput = z.infer<typeof getUploadStatusSchema>;

// Cancel upload schema
export const cancelUploadSchema = z.object({
  uploadId: z.string().min(1, 'Upload ID is required'),
});

export type CancelUploadInput = z.infer<typeof cancelUploadSchema>;

// Response schemas
export const uploadResponseSchema = z.object({
  success: z.boolean(),
  uploadId: z.string(),
  fileName: z.string(),
  chunkSize: z.number(),
  totalChunks: z.number(),
  expiresAt: z.number(),
});

export const chunkUploadResponseSchema = z.object({
  success: z.boolean(),
  chunkIndex: z.number(),
  uploadId: z.string(),
  etag: z.string(),
  message: z.string().optional(),
});

export const completeUploadResponseSchema = z.object({
  success: z.boolean(),
  uploadId: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  s3Key: z.string(),
  s3Url: z.string().optional(),
  completedAt: z.number(),
});

export const uploadStatusResponseSchema = z.object({
  uploadId: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  uploadedChunks: z.array(z.number()),
  totalChunks: z.number(),
  status: z.enum(['pending', 'uploading', 'completed', 'failed', 'cancelled']),
  createdAt: z.number(),
  expiresAt: z.number(),
});

