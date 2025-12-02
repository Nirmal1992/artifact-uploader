import type { UploadFile } from '../types/upload';
import { formatBytes } from '../utils/fileChunking';

interface UploadProgressProps {
  uploadFile: UploadFile;
  onRetry: (uploadFile: UploadFile) => void;
  onPause: () => void;
  onResume: () => void;
  onRemove: () => void;
}

const UploadProgress = ({ uploadFile, onRetry, onPause, onResume, onRemove }: UploadProgressProps) => {
  const { file, chunks, progress, status, totalSize } = uploadFile;
  
  const successChunks = chunks.filter(c => c.status === 'success').length;
  const failedChunks = chunks.filter(c => c.status === 'error').length;
  const uploadingChunks = chunks.filter(c => c.status === 'uploading').length;
  const pendingChunks = chunks.filter(c => c.status === 'pending').length;

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'uploading':
        return 'text-[var(--color-primary)]';
      default:
        return 'text-[var(--color-secondary)]';
    }
  };

  const getStatusIcon = () => {
    if (status === 'completed') {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
    
    if (status === 'failed') {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      );
    }

    return (
      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );
  };

  return (
    <div className="border border-color-border rounded-lg p-4 bg-color-background shadow-sm">
      {/* File Info Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <div className={`mt-0.5 ${getStatusColor()}`}>
            {getStatusIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-color-foreground truncate">
              {file.name}
            </p>
            <p className="text-sm text-color-secondary mt-0.5">
              {formatBytes(totalSize)} • {chunks.length} chunks
            </p>
            {uploadFile.backendUploadId ? (
              <p className="text-xs text-color-secondary mt-1 font-mono">
                Upload ID: {uploadFile.backendUploadId}
              </p>
            ) : (
              <p className="text-xs text-color-secondary mt-1 italic">
                Initializing upload...
              </p>
            )}
          </div>
        </div>

        <button
          onClick={onRemove}
          className="ml-4 text-color-secondary hover:text-color-foreground transition-colors"
          aria-label="Remove file"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="w-full bg-color-muted rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-color-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Status Details */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4">
          <span className={getStatusColor()}>
            {status === 'completed' && 'Completed'}
            {status === 'failed' && 'Failed'}
            {status === 'uploading' && `Uploading ${Math.round(progress)}%`}
            {status === 'pending' && 'Pending'}
            {status === 'paused' && 'Paused'}
          </span>
          
          <span className="text-color-secondary">
            {successChunks}/{chunks.length} chunks
          </span>

          {uploadingChunks > 0 && (
            <span className="text-color-secondary">
              {uploadingChunks} uploading
            </span>
          )}

          {failedChunks > 0 && (
            <span className="text-red-600">
              {failedChunks} failed
            </span>
          )}
        </div>

      </div>

      {/* Chunk Status Grid */}
      {chunks.length > 0 && (
        <div className="mt-3 pt-3 border-t border-color-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-color-foreground">
              Chunk Status
            </span>
            {chunks.some(c => c.retryCount > 0 && c.status !== 'success') && (
              <span className="text-xs text-orange-600">
                {chunks.filter(c => c.retryCount > 0 && c.status !== 'success').length} retrying
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-10 gap-1">
            {chunks.map(chunk => {
              const isUploaded = chunk.status === 'success';
              const isFailed = chunk.status === 'error';
              const isUploading = chunk.status === 'uploading';
              // Only show retry count if NOT successful (even if it had retries before)
              const showRetryCount = !isUploaded && !isFailed && chunk.retryCount > 0;
              
              return (
                <div
                  key={chunk.id}
                  className={`h-6 rounded relative ${
                    isUploaded
                      ? 'bg-green-500'
                      : isFailed
                      ? 'bg-red-500'
                      : showRetryCount
                      ? 'bg-orange-400'
                      : isUploading
                      ? 'bg-blue-500 animate-pulse'
                      : 'bg-gray-300'
                  }`}
                  title={`Chunk ${chunk.chunkIndex + 1}${
                    showRetryCount ? ` (retry ${chunk.retryCount})` : ''
                  }${isFailed ? ' - Failed' : ''}${isUploaded ? ' - Success' : ''}${
                    chunk.error ? ` - ${chunk.error}` : ''
                  }`}
                >
                  {showRetryCount && (
                    <div className="absolute inset-0 flex items-center justify-center text-[8px] text-white font-bold">
                      {chunk.retryCount}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="flex gap-4 text-xs text-color-secondary mt-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Uploaded</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>Uploading</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-orange-400 rounded"></div>
              <span>Retrying</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>Failed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-300 rounded"></div>
              <span>Pending</span>
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      {(status === 'uploading' || status === 'paused' || failedChunks > 0) && (
        <div className="mt-3 pt-3 border-t border-color-border flex gap-2">
          {status === 'uploading' && (
            <button
              onClick={onPause}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Pause
            </button>
          )}
          
          {status === 'paused' && (
            <button
              onClick={onResume}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Resume
            </button>
          )}
          
          {failedChunks > 0 && status !== 'uploading' && (
            <button
              onClick={() => onRetry(uploadFile)}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Retry Failed ({failedChunks})
            </button>
          )}
        </div>
      )}

      {/* Status Messages */}
      {status === 'paused' && (
        <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            <strong>Upload paused.</strong> Click "Resume" to continue uploading remaining chunks ({pendingChunks + failedChunks} chunks left).
          </p>
        </div>
      )}

      {status === 'uploading' && chunks.some(c => c.retryCount > 0) && (
        <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-sm text-orange-800">
            <strong>Auto-retry in progress.</strong> Some chunks encountered errors and are being automatically retried with exponential backoff.
          </p>
        </div>
      )}

    </div>
  );
};

export default UploadProgress;

