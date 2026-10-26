import { useState, useRef, useCallback, useEffect } from 'react';

export function useWindowDrag() {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    screenX: number;
    screenY: number;
    posX: number;
    posY: number;
  } | null>(null);
  const hasMovedRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cachedPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const updateCachedPos = useCallback(async () => {
    try {
      if (window.electronAPI?.getFloatPosition) {
        const pos = await window.electronAPI.getFloatPosition();
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
          cachedPosRef.current = pos;
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    updateCachedPos();
  }, [updateCachedPos]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const startScreenX = e.screenX;
    const startScreenY = e.screenY;
    const startPos = { ...cachedPosRef.current };

    dragStartRef.current = {
      screenX: startScreenX,
      screenY: startScreenY,
      posX: startPos.x,
      posY: startPos.y,
    };
    hasMovedRef.current = false;

    if (window.electronAPI?.getFloatPosition) {
      window.electronAPI.getFloatPosition().then((pos) => {
        if (pos && dragStartRef.current) {
          dragStartRef.current.posX = pos.x;
          dragStartRef.current.posY = pos.y;
          cachedPosRef.current = pos;
        }
      }).catch(() => {});
    }

    holdTimerRef.current = setTimeout(() => {
      if (dragStartRef.current) {
        setIsDragging(true);
        document.body.style.cursor = 'grabbing';
      }
    }, 120);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;

      const deltaX = moveEvent.screenX - dragStartRef.current.screenX;
      const deltaY = moveEvent.screenY - dragStartRef.current.screenY;

      if (!hasMovedRef.current && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
        hasMovedRef.current = true;
        setIsDragging(true);
        document.body.style.cursor = 'grabbing';
      }

      if (hasMovedRef.current || Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        hasMovedRef.current = true;
        const newX = dragStartRef.current.posX + deltaX;
        const newY = dragStartRef.current.posY + deltaY;
        cachedPosRef.current = { x: newX, y: newY };

        if (window.electronAPI?.setFloatPosition) {
          window.electronAPI.setFloatPosition(newX, newY);
        }
      }
    };

    const onMouseUp = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }

      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const wasDragging = hasMovedRef.current;
      dragStartRef.current = null;
      hasMovedRef.current = false;
      setIsDragging(false);
      document.body.style.cursor = '';

      if (wasDragging && (window.electronAPI as any)?.saveFloatPosition) {
        (window.electronAPI as any).saveFloatPosition();
      }

      if (wasDragging) {
        const preventClick = (clickEvent: MouseEvent) => {
          clickEvent.stopPropagation();
          clickEvent.preventDefault();
          window.removeEventListener('click', preventClick, true);
        };
        window.addEventListener('click', preventClick, true);
        setTimeout(() => {
          window.removeEventListener('click', preventClick, true);
        }, 60);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  return {
    isDragging,
    handleMouseDown,
  };
}
