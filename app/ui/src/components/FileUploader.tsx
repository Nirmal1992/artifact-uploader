import { useState } from 'react';
import type { UploadFile } from '../types/upload';
import { createUploadFile } from '../utils/fileChunking';
import { ChunkUploadManager } from '../services/uploadService';
import UploadProgress from './UploadProgress';

const FileUploader = () => {
  const [file, setFile] = useState<UploadFile | null>(null);
  const [manager] = useState(() => new ChunkUploadManager());

  manager.setOnChange((f) => setFile({ ...f }));

  const uploading = file?.status === 'uploading';

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected || uploading) return;
    const uploadFile = createUploadFile(selected, manager.getConfig().chunkSize);
    setFile(uploadFile);
    manager.uploadFile(uploadFile);
  };

  const onPause = () => {
    manager.pause();
    if (file?.status === 'uploading') setFile({ ...file, status: 'paused' });
  };

  const onResume = () => file?.status === 'paused' && manager.resume(file);

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      {/* Upload Section */}
      <div className="border border-color-border rounded-lg p-8 text-center bg-color-background">
        <h2 className="text-lg font-semibold text-color-foreground mb-2">
          {uploading ? 'Upload in progress...' : 'Upload a File'}
        </h2>
        <p className="text-sm text-color-secondary mb-4">
          {uploading
            ? 'Please wait for the current upload to complete'
            : 'Select a file to upload with automatic chunking and retry'}
        </p>

        <input type="file" onChange={onFileSelect} disabled={uploading} id="file-input" className="hidden" />

        <button
          type="button"
          onClick={() => document.getElementById('file-input')?.click()}
          disabled={uploading}
          className="px-6 py-3 bg-color-primary text-white rounded-lg font-medium hover:opacity-90 hover:cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          <svg className="w-8 h-8 text-color-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          Choose File
        </button>
      </div>

      {/* Upload Progress */}
      {file && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-color-foreground">Current Upload</h2>
            <button
              onClick={() => {
                manager.cancel();
                setFile(null);
              }}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium text-color-secondary hover:text-color-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
          </div>
          <UploadProgress
            uploadFile={file}
            onRetry={(f) => manager.retryFailed(f)}
            onPause={onPause}
            onResume={onResume}
            onRemove={() => setFile(null)}
          />
        </div>
      )}

      {/* Empty State */}
      {!file && (
        <p className="text-center py-8 text-color-secondary">No file uploaded yet. Choose a file to get started.</p>
      )}
    </div>
  );
};

export default FileUploader;
