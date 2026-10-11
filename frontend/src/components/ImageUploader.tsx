import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { uploadApi } from '../api/services';

interface ImageUploaderProps {
  currentImageUrl?: string | null;
  onUploadSuccess: (url: string) => void;
  folder: 'kaamsetu/workers' | 'kaamsetu/employers' | 'kaamsetu/jobs';
  className?: string;
  shape?: 'circle' | 'rectangle';
}

export default function ImageUploader({
  currentImageUrl,
  onUploadSuccess,
  folder,
  className = '',
  shape = 'circle',
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = preview || currentImageUrl;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local validation
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be under 5MB.');
      return;
    }

    setError(null);
    setIsUploading(true);

    // Create local preview instantly
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    try {
      const result = await uploadApi.uploadImage(file, folder);
      onUploadSuccess(result.url);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.detail || 'Failed to upload image. Please try again.');
      setPreview(null); // Revert preview on failure
    } finally {
      setIsUploading(false);
      // Clean up input value so the same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearImage = () => {
    setPreview(null);
    onUploadSuccess('');
  };

  const containerClasses = shape === 'circle' 
    ? 'w-32 h-32 rounded-full relative group cursor-pointer overflow-hidden border-2 border-gray-200 bg-gray-50 flex-shrink-0'
    : 'w-full h-48 rounded-xl relative group cursor-pointer overflow-hidden border-2 border-dashed border-gray-300 bg-gray-50';

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div 
        className={containerClasses}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        {displayUrl ? (
          <img 
            src={displayUrl} 
            alt="Uploaded image" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            {shape === 'circle' ? <Camera className="w-8 h-8 mb-1" /> : <ImageIcon className="w-10 h-10 mb-2" />}
            <span className="text-xs font-medium">{shape === 'rectangle' ? 'Click to upload image' : 'Upload'}</span>
          </div>
        )}

        {/* Overlay on hover */}
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 transition-opacity ${!isUploading ? 'group-hover:opacity-100' : ''}`}>
          <Camera className="w-8 h-8 text-white" />
        </div>

        {/* Loading overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin mb-1" />
            <span className="text-xs font-bold text-primary-700">Uploading...</span>
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg, image/png, image/webp"
        className="hidden"
      />

      <div className="flex flex-col items-center w-full">
        {error && <p className="text-red-500 text-xs mt-1 font-medium text-center">{error}</p>}
        {displayUrl && shape === 'rectangle' && (
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); clearImage(); }}
            className="text-red-500 text-xs font-medium mt-2 hover:text-red-700 flex items-center"
          >
            <X className="w-3 h-3 mr-1" /> Remove Image
          </button>
        )}
      </div>
    </div>
  );
}
