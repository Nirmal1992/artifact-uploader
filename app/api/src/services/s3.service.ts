import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { config } from '../config/index.js';
import type { UploadedPart } from '../types/upload.js';

export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: config.AWS_REGION,
      credentials: config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: config.AWS_ACCESS_KEY_ID,
            secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
          }
        : undefined, // Use default credentials provider chain if not provided
    });
    this.bucketName = config.S3_BUCKET_NAME;
  }

  /**
   * Initialize a multipart upload
   */
  async initiateMultipartUpload(
    key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
        Metadata: metadata,
      });

      const response = await this.s3Client.send(command);

      if (!response.UploadId) {
        throw new Error('Failed to initiate multipart upload: No UploadId returned');
      }

      return response.UploadId;
    } catch (error) {
      console.error('Error initiating multipart upload:', error);
      throw new Error(
        `Failed to initiate multipart upload: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Upload a single part
   */
  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer
  ): Promise<string> {
    try {
      const command = new UploadPartCommand({
        Bucket: this.bucketName,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: body,
      });

      const response = await this.s3Client.send(command);

      if (!response.ETag) {
        throw new Error('Failed to upload part: No ETag returned');
      }

      return response.ETag;
    } catch (error) {
      console.error(`Error uploading part ${partNumber}:`, error);
      throw new Error(
        `Failed to upload part ${partNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Complete multipart upload
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: UploadedPart[]
  ): Promise<string> {
    try {
      // Sort parts by part number
      const sortedParts = parts.sort((a, b) => a.partNumber - b.partNumber);

      // Validate parts - all parts except the last must be at least 5MB
      // This is an AWS S3 requirement
      console.log('Completing multipart upload:', {
        key,
        uploadId,
        totalParts: sortedParts.length,
        partNumbers: sortedParts.map(p => p.partNumber),
      });

      const command = new CompleteMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: sortedParts.map((part) => ({
            PartNumber: part.partNumber,
            ETag: part.etag,
          })),
        },
      });

      const response = await this.s3Client.send(command);

      if (!response.Location) {
        throw new Error('Failed to complete multipart upload: No Location returned');
      }

      return response.Location;
    } catch (error) {
      console.error('Error completing multipart upload:', error);
      
      // Check if it's the "minimum size" error from S3
      if (error instanceof Error && error.message.includes('minimum allowed size')) {
        throw new Error(
          'Failed to complete multipart upload: One or more parts are smaller than the 5MB minimum required by S3. ' +
          'Make sure all parts except the last one are at least 5MB.'
        );
      }
      
      throw new Error(
        `Failed to complete multipart upload: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Abort multipart upload
   */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        UploadId: uploadId,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Error aborting multipart upload:', error);
      throw new Error(
        `Failed to abort multipart upload: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate S3 URL
   */
  getS3Url(key: string): string {
    return `https://${this.bucketName}.s3.${config.AWS_REGION}.amazonaws.com/${key}`;
  }
}

