import { randomUUID } from 'crypto';
import { S3Service } from './s3.service.js';
import { config } from '../config/index.js';
import type { UploadSession } from '../types/upload.js';

export class UploadService {
  private s3Service: S3Service;
  private uploadSessions: Map<string, UploadSession>;

  constructor() {
    this.s3Service = new S3Service();
    this.uploadSessions = new Map();
    
    // Clean up expired sessions every 5 minutes
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
  }

  /**
   * Initiate a new upload session
   */
  async initiateUpload(
    fileName: string,
    fileSize: number,
    fileType: string,
    chunkSize?: number,
    metadata?: Record<string, string>
  ): Promise<UploadSession> {
    const uploadId = randomUUID();
    const effectiveChunkSize = chunkSize || config.CHUNK_SIZE;
    
    // AWS S3 multipart upload requirements:
    // - Each part must be at least 5MB (except the last part)
    // - Minimum chunk size should be 5MB
    const MIN_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
    
    if (effectiveChunkSize < MIN_CHUNK_SIZE) {
      throw new Error(
        `Chunk size must be at least 5MB for S3 multipart uploads. Current: ${effectiveChunkSize} bytes`
      );
    }
    
    const totalChunks = Math.ceil(fileSize / effectiveChunkSize);
    
    // Generate S3 key
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `uploads/${uploadId}/${sanitizedFileName}`;

    // Initiate S3 multipart upload
    const s3UploadId = await this.s3Service.initiateMultipartUpload(
      s3Key,
      fileType,
      metadata
    );

    const now = Date.now();
    const expiresAt = now + config.UPLOAD_EXPIRATION * 1000;

    const session: UploadSession = {
      uploadId,
      fileName,
      fileSize,
      fileType,
      chunkSize: effectiveChunkSize,
      totalChunks,
      s3Key,
      s3UploadId,
      uploadedParts: [],
      status: 'pending',
      metadata,
      createdAt: now,
      expiresAt,
    };

    this.uploadSessions.set(uploadId, session);

    return session;
  }

  /**
   * Upload a chunk
   */
  async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    chunkData: Buffer
  ): Promise<{ etag: string; partNumber: number }> {
    const session = this.uploadSessions.get(uploadId);

    if (!session) {
      throw new Error('Upload session not found');
    }

    if (session.status === 'completed') {
      throw new Error('Upload already completed');
    }

    if (session.status === 'cancelled') {
      throw new Error('Upload was cancelled');
    }

    if (Date.now() > session.expiresAt) {
      session.status = 'failed';
      throw new Error('Upload session expired');
    }

    // Validate chunk index is within range
    if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      throw new Error(
        `Invalid chunk index ${chunkIndex}. Expected 0-${session.totalChunks - 1}`
      );
    }

    const partNumber = chunkIndex + 1;

    // Check if this part was already uploaded
    const existingPart = session.uploadedParts.find(
      (p) => p.partNumber === partNumber
    );

    if (existingPart) {
      console.log(
        `Part ${partNumber}/${session.totalChunks} already uploaded for session ${uploadId}, returning existing etag`
      );
      return { etag: existingPart.etag, partNumber };
    }

    // Upload to S3
    const etag = await this.s3Service.uploadPart(
      session.s3Key,
      session.s3UploadId,
      partNumber,
      chunkData
    );

    // Save the uploaded part
    session.uploadedParts.push({ partNumber, etag });
    session.status = 'uploading';

    console.log(
      `Uploaded part ${partNumber}/${session.totalChunks}, total uploaded: ${session.uploadedParts.length}`
    );

    return { etag, partNumber };
  }

  /**
   * Complete the upload
   */
  async completeUpload(uploadId: string): Promise<{
    s3Key: string;
    s3Url: string;
    fileSize: number;
  }> {
    const session = this.uploadSessions.get(uploadId);

    if (!session) {
      throw new Error('Upload session not found');
    }

    if (session.status === 'completed') {
      return {
        s3Key: session.s3Key,
        s3Url: this.s3Service.getS3Url(session.s3Key),
        fileSize: session.fileSize,
      };
    }

    // Deduplicate parts by partNumber (just in case)
    const uniqueParts = Array.from(
      new Map(session.uploadedParts.map(p => [p.partNumber, p])).values()
    );
    
    session.uploadedParts = uniqueParts;

    if (session.uploadedParts.length !== session.totalChunks) {
      // Log detailed info for debugging
      console.error('Upload completion failed:', {
        expected: session.totalChunks,
        received: session.uploadedParts.length,
        partNumbers: session.uploadedParts.map(p => p.partNumber).sort((a, b) => a - b),
      });
      
      throw new Error(
        `Not all chunks uploaded. Expected ${session.totalChunks}, got ${session.uploadedParts.length}`
      );
    }

    // Complete S3 multipart upload
    const s3Url = await this.s3Service.completeMultipartUpload(
      session.s3Key,
      session.s3UploadId,
      session.uploadedParts
    );

    session.status = 'completed';

    return {
      s3Key: session.s3Key,
      s3Url,
      fileSize: session.fileSize,
    };
  }

  /**
   * Get upload status
   */
  getUploadStatus(uploadId: string): UploadSession | null {
    return this.uploadSessions.get(uploadId) || null;
  }

  /**
   * Cancel upload
   */
  async cancelUpload(uploadId: string): Promise<void> {
    const session = this.uploadSessions.get(uploadId);

    if (!session) {
      throw new Error('Upload session not found');
    }

    if (session.status === 'completed') {
      throw new Error('Cannot cancel completed upload');
    }

    // Abort S3 multipart upload
    await this.s3Service.abortMultipartUpload(
      session.s3Key,
      session.s3UploadId
    );

    session.status = 'cancelled';
    
    // Remove from active sessions
    this.uploadSessions.delete(uploadId);
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [uploadId, session] of this.uploadSessions.entries()) {
      if (now > session.expiresAt && session.status !== 'completed') {
        expiredSessions.push(uploadId);
      }
    }

    expiredSessions.forEach(async (uploadId) => {
      const session = this.uploadSessions.get(uploadId);
      if (session) {
        try {
          await this.s3Service.abortMultipartUpload(
            session.s3Key,
            session.s3UploadId
          );
        } catch (error) {
          console.error(`Error aborting expired upload ${uploadId}:`, error);
        }
        this.uploadSessions.delete(uploadId);
      }
    });

    if (expiredSessions.length > 0) {
      console.log(`Cleaned up ${expiredSessions.length} expired upload sessions`);
    }
  }

}

