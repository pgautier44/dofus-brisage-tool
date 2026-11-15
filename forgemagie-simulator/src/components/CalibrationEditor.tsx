import { useRef, useState } from 'react';
import type { Calibration, RegionKey } from '../screen/types';

interface CalibrationEditorProps {
  frameDataUrl: string;
  calibration: Calibration;
  activeKey: RegionKey;
  onRegionDrawn: (key: RegionKey, region: { x: number; y: number; width: number; height: number }) => void;
  labelFor: (key: RegionKey) => string;
  /** Pourcentage de zoom (100 = taille de base) : agrandit l'image pour dessiner un
   * rectangle plus précis sur un petit chiffre, sans changer le calcul des coordonnées
   * (toujours en fractions 0..1, donc indépendant de la taille affichée). */
  zoom: number;
}

interface DragState {
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const BASE_WIDTH_PX = 900;

export function CalibrationEditor({ frameDataUrl, calibration, activeKey, onRegionDrawn, labelFor, zoom }: CalibrationEditorProps) {
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
    <div className="calibration-scroll">
      <div
        ref={containerRef}
        className="calibration-editor"
        style={{ width: `${(BASE_WIDTH_PX * zoom) / 100}px` }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <img src={frameDataUrl} alt="Calibration" draggable={false} />
        {/* Seule la zone en cours de calibrage est affichée : les autres, une fois faites,
            se superposaient et gênaient pour dessiner un nouveau rectangle précis. Clique
            un autre chip pour voir/retoucher sa propre zone. */}
        {calibration[activeKey] && (
          <div
            className="calibration-rect calibration-rect-active"
            style={{
              left: `${calibration[activeKey]!.x * 100}%`,
              top: `${calibration[activeKey]!.y * 100}%`,
              width: `${calibration[activeKey]!.width * 100}%`,
              height: `${calibration[activeKey]!.height * 100}%`,
            }}
          >
            <span className="calibration-rect-label">{labelFor(activeKey)}</span>
          </div>
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
    </div>
  );
}
