import { useRef, useCallback, useEffect } from "react";

interface DragCallbacks {
  onDragStart: () => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
}

export function useDrag(callbacks: DragCallbacks) {
  const isDragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Left click only
      isDragging.current = true;
      offset.current = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
      callbacks.onDragStart();
      e.preventDefault();
    },
    [callbacks]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      callbacks.onDragMove(e.clientX - offset.current.x, e.clientY - offset.current.y);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      callbacks.onDragEnd(e.clientX - offset.current.x, e.clientY - offset.current.y);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [callbacks]);

  return { handleMouseDown, isDragging: isDragging.current };
}
