'use client';

import { useRef } from 'react';
import { Upload } from 'lucide-react';

interface UploadZoneProps {
  title: string;
  hint: string;
  accept?: string;
  onFiles?: (files: FileList) => void;
}

export function UploadZone({ title, hint, accept, onFiles }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="upload-zone"
      onClick={() => inputRef.current?.click()}
    >
      <Upload size={24} />
      <span className="upload-zone__title">{title}</span>
      <span className="upload-zone__hint">{hint}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && onFiles) onFiles(e.target.files);
        }}
      />
    </div>
  );
}
