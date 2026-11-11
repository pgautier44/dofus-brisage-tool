import { useRef, useState } from 'react';
import type { Calibration, RegionKey } from '../screen/types';

interface CalibrationEditorProps {
  frameDataUrl: string;
  calibration: Calibration;
  activeKey: RegionKey;
  onRegionDrawn: (key: RegionKey, region: { x: number; y: number; width: number; height: number }) => void;
  labelFor: (key: RegionKey) => string;
}

interface DragState {
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function CalibrationEditor({ frameDataUrl, calibration, activeKey, onRegionDrawn, labelFor }: CalibrationEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  function fractionsFromEvent(e: React.MouseEvent): { x: number; y: number } {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }

  function onMouseDown(e: React.MouseEvent) {
    const { x, y } = fractionsFromEvent(e);
    setDrag({ startX: x, startY: y, x, y, width: 0, height: 0 });
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drag) return;
    const { x, y } = fractionsFromEvent(e);
    const nx = Math.min(drag.startX, x);
    const ny = Math.min(drag.startY, y);
    setDrag({ ...drag, x: nx, y: ny, width: Math.abs(x - drag.startX), height: Math.abs(y - drag.startY) });
  }

  function onMouseUp() {
    if (!drag) return;
    if (drag.width > 0.003 && drag.height > 0.003) {
      onRegionDrawn(activeKey, { x: drag.x, y: drag.y, width: drag.width, height: drag.height });
    }
    setDrag(null);
  }

  return (
    <div
      ref={containerRef}
      className="calibration-editor"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <img src={frameDataUrl} alt="Calibration" draggable={false} />
      {Object.values(calibration).map((region) =>
        region ? (
          <div
            key={region.key}
            className={`calibration-rect ${region.key === activeKey ? 'calibration-rect-active' : ''}`}
            style={{
              left: `${region.x * 100}%`,
              top: `${region.y * 100}%`,
              width: `${region.width * 100}%`,
              height: `${region.height * 100}%`,
            }}
          >
            <span className="calibration-rect-label">{labelFor(region.key)}</span>
          </div>
        ) : null
      )}
      {drag && (
        <div
          className="calibration-rect calibration-rect-dragging"
          style={{
            left: `${drag.x * 100}%`,
            top: `${drag.y * 100}%`,
            width: `${drag.width * 100}%`,
            height: `${drag.height * 100}%`,
          }}
        />
      )}
    </div>
  );
}
