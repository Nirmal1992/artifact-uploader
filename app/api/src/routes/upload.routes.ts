import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UploadService } from '../services/upload.service.js';
import {
  initiateUploadSchema,
  completeUploadSchema,
  getUploadStatusSchema,
  cancelUploadSchema,
} from '../schemas/upload.schema.js';
import { ZodError } from 'zod';

const uploadService = new UploadService();

interface UploadChunkRequest {
  Body: {
    uploadId: string;
    chunkIndex: string;
    totalChunks: string;
  };
}

export async function uploadRoutes(fastify: FastifyInstance) {
  // Initiate upload
  fastify.post('/upload/initiate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedData = initiateUploadSchema.parse(request.body);

      const session = await uploadService.initiateUpload(
        validatedData.fileName,
        validatedData.fileSize,
        validatedData.fileType,
        validatedData.chunkSize,
        validatedData.metadata
      );

      return reply.status(200).send({
        success: true,
        data: {
          uploadId: session.uploadId,
          fileName: session.fileName,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }

      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate upload',
      });
    }
  });

  // Upload chunk
  fastify.post<UploadChunkRequest>(
    '/upload/chunk',
    async (request: FastifyRequest<UploadChunkRequest>, reply: FastifyReply) => {
      try {
        const data = await request.file();

        if (!data) {
          return reply.status(400).send({
            success: false,
            error: 'No file provided',
          });
        }

        // Get form fields - they're available directly on the data object
        let uploadId: string | undefined;
        let chunkIndex: string | undefined;
        let totalChunks: string | undefined;

        // Extract fields from the multipart data
        if (data.fields) {
          const fields = data.fields as any;
          
          // Handle different field structures
          if (fields.uploadId) {
            uploadId = typeof fields.uploadId === 'object' ? fields.uploadId.value : fields.uploadId;
          }
          if (fields.chunkIndex) {
            chunkIndex = typeof fields.chunkIndex === 'object' ? fields.chunkIndex.value : fields.chunkIndex;
          }
          if (fields.totalChunks) {
            totalChunks = typeof fields.totalChunks === 'object' ? fields.totalChunks.value : fields.totalChunks;
          }
        }

        // Log for debugging
        fastify.log.info({ uploadId, chunkIndex, totalChunks, fields: data.fields }, 'Received chunk upload request');

        if (!uploadId || !chunkIndex || !totalChunks) {
          return reply.status(400).send({
            success: false,
            error: 'Missing required fields: uploadId, chunkIndex, or totalChunks',
            received: { uploadId, chunkIndex, totalChunks },
          });
        }

        // Convert chunk index to number
        const chunkIndexNum = parseInt(chunkIndex, 10);
        const totalChunksNum = parseInt(totalChunks, 10);

        if (isNaN(chunkIndexNum) || isNaN(totalChunksNum)) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid chunk index or total chunks',
          });
        }

        // Read the chunk data
        const chunks: Buffer[] = [];
        for await (const chunk of data.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // Upload the chunk
        const result = await uploadService.uploadChunk(uploadId, chunkIndexNum, buffer);

        return reply.status(200).send({
          success: true,
          data: {
            chunkIndex: chunkIndexNum,
            uploadId,
            etag: result.etag,
            partNumber: result.partNumber,
            message: 'Chunk uploaded successfully',
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to upload chunk',
        });
      }
    }
  );

  // Complete upload
  fastify.post('/upload/complete', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedData = completeUploadSchema.parse(request.body);

      const result = await uploadService.completeUpload(validatedData.uploadId);

      return reply.status(200).send({
        success: true,
        data: {
          uploadId: validatedData.uploadId,
          fileName: validatedData.fileName,
          fileSize: result.fileSize,
          s3Key: result.s3Key,
          s3Url: result.s3Url,
          completedAt: Date.now(),
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }

      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete upload',
      });
    }
  });

  // Get upload status
  fastify.get('/upload/status/:uploadId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { uploadId: string };
      const validatedData = getUploadStatusSchema.parse(params);

      const session = uploadService.getUploadStatus(validatedData.uploadId);

      if (!session) {
        return reply.status(404).send({
          success: false,
          error: 'Upload session not found',
        });
      }

      // Return uploaded chunks in 0-indexed format for frontend
      const uploadedChunks = session.uploadedParts.map((p) => p.partNumber - 1);
      
      fastify.log.info({
        uploadId: session.uploadId,
        uploadedChunks,
        totalChunks: session.totalChunks,
      }, 'Upload status requested');

      return reply.status(200).send({
        success: true,
        data: {
          uploadId: session.uploadId,
          fileName: session.fileName,
          fileSize: session.fileSize,
          uploadedChunks, // 0-indexed chunk numbers
          totalChunks: session.totalChunks,
          status: session.status,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }

      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get upload status',
      });
    }
  });

  // Cancel upload
  fastify.post('/upload/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedData = cancelUploadSchema.parse(request.body);

      await uploadService.cancelUpload(validatedData.uploadId);

      return reply.status(200).send({
        success: true,
        data: {
          uploadId: validatedData.uploadId,
          message: 'Upload cancelled successfully',
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }

      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel upload',
      });
    }
  });

  // Health check
  fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      data: {
        status: 'healthy',
        timestamp: Date.now(),
      },
    });
  });
}

