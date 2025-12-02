import FileUploader from './components/FileUploader';
import DarkModeToggle from './components/DarkModeToggle';

function App() {
  return (
    <div className="min-h-screen bg-color-background transition-colors duration-200">
      <DarkModeToggle />
      <div className="flex flex-row items-center justify-center h-full">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-color-foreground mb-2">Artifact Uploader</h1>
            <p className="text-lg text-color-secondary">
              Upload large files to Amazon S3 with parallel chunking, automatic retry, and network failure recovery
            </p>
          </div>
          <FileUploader />
        </div>
      </div>
    </div>
  );
}

export default App;
