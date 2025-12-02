import type { FileChunk, UploadFile } from '../types/upload';

/**
 * Creates chunks from a file
 */
export function createFileChunks(file: File, chunkSize: number): FileChunk[] {
  const chunks: FileChunk[] = [];
  const totalChunks = Math.ceil(file.size / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const startByte = i * chunkSize;
    const endByte = Math.min(startByte + chunkSize, file.size);
    const blob = file.slice(startByte, endByte);

    chunks.push({
      id: `${file.name}-chunk-${i}`,
      fileName: file.name,
      chunkIndex: i,
      totalChunks,
      blob,
      startByte,
      endByte,
      retryCount: 0,
      status: 'pending',
      progress: 0,
    });
  }

  return chunks;
}

/**
 * Creates an UploadFile object from a File
 */
export function createUploadFile(file: File, chunkSize: number): UploadFile {
  const chunks = createFileChunks(file, chunkSize);
  
  return {
    id: `${file.name}-${Date.now()}`,
    file,
    chunks,
    totalSize: file.size,
    uploadedSize: 0,
    status: 'pending',
    progress: 0,
  };
}

/**
 * Calculates overall progress of file upload
 */
export function calculateProgress(uploadFile: UploadFile): number {
  const completedChunks = uploadFile.chunks.filter(
    chunk => chunk.status === 'success'
  ).length;
  
  return (completedChunks / uploadFile.chunks.length) * 100;
}

/**
 * Formats bytes to human-readable format
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

