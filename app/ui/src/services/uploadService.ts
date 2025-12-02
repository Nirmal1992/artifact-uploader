import type { FileChunk, UploadFile, UploadConfig } from '../types/upload';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/** Helper for JSON API calls */
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

/** Upload a single chunk */
async function uploadChunk(chunk: FileChunk, endpoint: string, uploadId: string): Promise<boolean> {
  const formData = new FormData();
  formData.append('uploadId', uploadId);
  formData.append('chunkIndex', chunk.chunkIndex.toString());
  formData.append('totalChunks', chunk.totalChunks.toString());
  formData.append('file', chunk.blob, chunk.fileName);

  const res = await fetch(`${API_URL}${endpoint}`, { method: 'POST', body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data.success;
}

/** Upload chunk with retry logic */
async function uploadWithRetry(
  chunk: FileChunk,
  config: UploadConfig,
  uploadId: string,
  onUpdate: () => void
): Promise<void> {
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      Object.assign(chunk, { status: 'uploading', retryCount: attempt });
      onUpdate();

      if (await uploadChunk(chunk, config.endpoint, uploadId)) {
        Object.assign(chunk, { status: 'success', progress: 100, retryCount: 0, error: undefined });
        onUpdate();
        return;
      }
    } catch (e) {
      chunk.error = (e as Error).message;
      if (attempt < config.maxRetries) {
        await new Promise(r => setTimeout(r, config.retryDelay * 2 ** attempt));
      }
    }
  }
  Object.assign(chunk, { status: 'error' });
  onUpdate();
  throw new Error(chunk.error || 'Upload failed after retries');
}

/** Manages parallel chunk uploads with concurrency control */
export class ChunkUploadManager {
  private config: UploadConfig;
  private queue: FileChunk[] = [];
  private paused = false;
  private uploadId?: string;
  private onChange?: (f: UploadFile) => void;

  constructor(config: Partial<UploadConfig> = {}) {
    const MIN_CHUNK = 5 * 1024 * 1024; // 5MB for S3
    this.config = {
      chunkSize: Math.max(config.chunkSize || MIN_CHUNK, MIN_CHUNK),
      maxParallelChunks: config.maxParallelChunks || 3,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      endpoint: config.endpoint || '/upload/chunk',
    };
  }

  setOnChange(cb: (f: UploadFile) => void) { this.onChange = cb; }

  private notify(file: UploadFile) { this.onChange?.(file); }

  /** Sync local state with backend */
  private async syncWithBackend(file: UploadFile, uploadId: string): Promise<void> {
    try {
      const { success, data } = await api<{ success: boolean; data?: { uploadedChunks: number[] } }>(
        `/upload/status/${uploadId}`,
        { method: 'GET' }
      );
      if (!success || !data) return;

      const uploaded = new Set(data.uploadedChunks);
      file.chunks.forEach(chunk => {
        if (uploaded.has(chunk.chunkIndex)) {
          Object.assign(chunk, { status: 'success', progress: 100, error: undefined, retryCount: 0 });
        } else if (chunk.status === 'success') {
          Object.assign(chunk, { status: 'pending', progress: 0 });
        }
      });
      this.updateProgress(file);
    } catch {
      // Continue with local state
    }
  }

  /** Start or resume file upload */
  async uploadFile(file: UploadFile): Promise<void> {
    try {
      // Reset state for new uploads
      if (!file.backendUploadId) {
        this.uploadId = undefined;
        this.paused = false;
      }

      // Initiate or resume
      if (!this.uploadId) {
        const { data } = await api<{ data: { uploadId: string } }>('/upload/initiate', {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.file.name,
            fileSize: file.file.size,
            fileType: file.file.type,
            chunkSize: this.config.chunkSize,
          }),
        });
        this.uploadId = file.backendUploadId = data.uploadId;
      } else {
        await this.syncWithBackend(file, this.uploadId);
      }

      file.status = 'uploading';
      file.startTime ||= Date.now();
      this.queue = file.chunks.filter(c => c.status !== 'success');

      // Process chunks in parallel
      await Promise.all(
        Array.from({ length: this.config.maxParallelChunks }, () => this.processQueue(file))
      );

      if (this.paused) {
        file.status = 'paused';
        this.notify(file);
        return;
      }

      const failed = file.chunks.filter(c => c.status === 'error');
      if (failed.length === 0) {
        await api('/upload/complete', {
          method: 'POST',
          body: JSON.stringify({
            uploadId: this.uploadId,
            totalChunks: file.chunks.length,
            fileName: file.file.name,
          }),
        });
        Object.assign(file, { status: 'completed', endTime: Date.now(), progress: 100 });
        this.uploadId = undefined;
        this.onChange?.(file);
      } else {
        file.status = 'failed';
        file.error = `${failed.length} chunk(s) failed`;
        this.uploadId = undefined;
        this.onChange?.(file);
      }
    } catch (e) {
      file.status = 'failed';
      file.error = (e as Error).message;
      this.uploadId = undefined;
      this.onChange?.(file);
    }
  }

  private async processQueue(file: UploadFile): Promise<void> {
    while (this.queue.length > 0 && !this.paused) {
      const chunk = this.queue.shift();
      if (!chunk) break;
      try {
        await uploadWithRetry(chunk, this.config, this.uploadId!, () => this.updateProgress(file));
      } catch {
        // Error handled in uploadWithRetry
      }
    }
  }

  private updateProgress(file: UploadFile): void {
    const done = file.chunks.filter(c => c.status === 'success').length;
    file.progress = (done / file.chunks.length) * 100;
    file.uploadedSize = done * this.config.chunkSize;
    this.notify(file);
  }

  pause() { this.paused = true; }

  async resume(file: UploadFile): Promise<void> {
    this.paused = false;
    file.status = 'uploading';
    this.notify(file);
    await this.uploadFile(file);
  }

  async retryFailed(file: UploadFile): Promise<void> {
    // Reset failed chunks
    file.chunks.filter(c => c.status === 'error').forEach(c => {
      Object.assign(c, { status: 'pending', retryCount: 0, error: undefined });
    });
    
    // Restore uploadId from file if it exists (to resume same session)
    if (file.backendUploadId) {
      this.uploadId = file.backendUploadId;
    }
    
    file.status = 'uploading';
    file.error = undefined;
    this.notify(file);
    
    await this.uploadFile(file);
  }

  async cancel(): Promise<void> {
    this.paused = true;
    this.queue = [];
    if (this.uploadId) {
      await api('/upload/cancel', {
        method: 'POST',
        body: JSON.stringify({ uploadId: this.uploadId }),
      }).catch(() => {});
      this.uploadId = undefined;
    }
  }

  getConfig(): UploadConfig { return { ...this.config }; }
}

