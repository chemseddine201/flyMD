import { useState, useEffect, useCallback } from 'react';
import { MD_REGEX } from '../../../shared/constants';

interface UseFileDropOptions {
  onFileDrop: (filePath: string) => void;
  acceptRegex?: RegExp;
}

export function useFileDrop({ onFileDrop, acceptRegex = MD_REGEX }: UseFileDropOptions) {
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        const filePath = window.electronAPI.getPathForFile(file);
        if (filePath && acceptRegex.test(filePath)) {
          onFileDrop(filePath);
        }
      }
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [onFileDrop, acceptRegex]);

  const handleZoneDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleZoneDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleZoneDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        const filePath = window.electronAPI.getPathForFile(file);
        if (filePath && acceptRegex.test(filePath)) {
          onFileDrop(filePath);
        }
      }
    },
    [onFileDrop, acceptRegex]
  );

  return {
    isDragOver,
    dropZoneProps: {
      onDragOver: handleZoneDragOver,
      onDragLeave: handleZoneDragLeave,
      onDrop: handleZoneDrop,
    },
  };
}

