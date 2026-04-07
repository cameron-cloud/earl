import { useRef, useCallback, useEffect } from "react";

interface DragCallbacks {
  onDragStart: () => Promise<void>;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number, velocityX: number, velocityY: number) => void;
}

interface VelocitySample {
  x: number;
  y: number;
  time: number;
}

const VELOCITY_SAMPLES = 5;
const DRAG_THRESHOLD = 4; // px movement to distinguish drag from click

export function useDrag(callbacks: DragCallbacks) {
  const isDragging = useRef(false);
  const dragReady = useRef(false);
  const didDrag = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const samples = useRef<VelocitySample[]>([]);
  const cbRef = useRef(callbacks);
  const targetEl = useRef<HTMLElement | null>(null);
  cbRef.current = callbacks;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      isDragging.current = true;
      dragReady.current = false;
      didDrag.current = false;
      offset.current = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
      startPos.current = { x: e.clientX, y: e.clientY };
      samples.current = [{ x: e.clientX, y: e.clientY, time: performance.now() }];

      // Capture pointer so events keep flowing even if cursor leaves the window
      const el = e.currentTarget as HTMLElement;
      targetEl.current = el;
      el.setPointerCapture(e.pointerId);

      e.preventDefault();

      cbRef.current.onDragStart().then(() => {
        dragReady.current = true;
      }).catch(() => {
        dragReady.current = true;
      });
    },
    []
  );

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current || !dragReady.current) return;

      // Check if movement exceeds drag threshold
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (!didDrag.current && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
        didDrag.current = true;
      }

      const x = e.clientX - offset.current.x;
      const y = e.clientY - offset.current.y;
      cbRef.current.onDragMove(x, y);

      const now = performance.now();
      samples.current.push({ x: e.clientX, y: e.clientY, time: now });
      if (samples.current.length > VELOCITY_SAMPLES) {
        samples.current.shift();
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      dragReady.current = false;

      // Release pointer capture
      if (targetEl.current) {
        try { targetEl.current.releasePointerCapture(e.pointerId); } catch { /* ok */ }
        targetEl.current = null;
      }

      const x = e.clientX - offset.current.x;
      const y = e.clientY - offset.current.y;

      let vx = 0;
      let vy = 0;
      const s = samples.current;
      if (s.length >= 2) {
        const first = s[0];
        const last = s[s.length - 1];
        const dt = (last.time - first.time) / 1000;
        if (dt > 0.001) {
          vx = (last.x - first.x) / dt;
          vy = (last.y - first.y) / dt;
        }
      }
      samples.current = [];

      cbRef.current.onDragEnd(x, y, vx, vy);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  return { handlePointerDown, didDrag };
}
