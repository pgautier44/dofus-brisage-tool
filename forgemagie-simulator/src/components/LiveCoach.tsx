import { useEffect, useRef, useState } from 'react';
import { LINES, LINE_ORDER, MON_ANNEAU_HDV_VALUES } from '../engine/config';
import type { GoalOverrides, LineKey, LineValues, ObjectState } from '../engine/types';
import { useLiveCoach } from '../hooks/useLiveCoach';
import { cropRegion, grabFrame, startScreenCapture, stopStream } from '../screen/capture';
import { recognizeNumber } from '../screen/ocr';
import type { Calibration, ReadResult, RegionKey } from '../screen/types';
import { loadCalibration, saveCalibration } from '../storage';
import { CalibrationEditor } from './CalibrationEditor';
import { CoachPanel } from './CoachPanel';
import { Gauges } from './Gauges';
import { RuneGrid } from './RuneGrid';

const REGION_KEYS: RegionKey[] = [...LINE_ORDER, 'puits'];

function labelFor(key: RegionKey): string {
  return key === 'puits' ? 'Puits' : LINES[key].label;
}

function ManualValuesPanel({
  state,
  onSetValue,
  onSetPuits,
  onReset,
}: {
  state: ObjectState;
  onSetValue: (line: LineKey, value: number) => void;
  onSetPuits: (value: number) => void;
  onReset: () => void;
}) {
  return (
    <details className="objectives-panel" open>
      <summary>Saisie / correction manuelle</summary>
      <p className="objectives-hint">
        Toujours disponible, que tu utilises la lecture d'écran ou non : tape directement ce que tu vois en
        jeu, ligne par ligne.
      </p>
      <div className="objectives-grid">
        {LINE_ORDER.map((line) => (
          <div className="objective-row" key={line}>
            <label>{LINES[line].label}</label>
            <input
              type="number"
              value={state.values[line]}
              onChange={(e) => onSetValue(line, Number(e.target.value))}
            />
          </div>
        ))}
        <div className="objective-row">
          <label>Puits</label>
          <input type="number" step="0.1" value={state.puits} onChange={(e) => onSetPuits(Number(e.target.value))} />
        </div>
      </div>
      <button type="button" onClick={onReset}>
        Réinitialiser (Mon anneau HDV)
      </button>
    </details>
  );
}

export function LiveCoach({ goals }: { goals: GoalOverrides }) {
  const liveCoach = useLiveCoach(goals);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [calibration, setCalibration] = useState<Calibration>(() => loadCalibration());
  const [activeKey, setActiveKey] = useState<RegionKey>('pa');
  const [calibrationFrameUrl, setCalibrationFrameUrl] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [readResults, setReadResults] = useState<Partial<Record<RegionKey, ReadResult>>>({});
  const [draftValues, setDraftValues] = useState<Partial<Record<RegionKey, string>>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    saveCalibration(calibration);
  }, [calibration]);

  useEffect(
    () => () => {
      stopStream(stream);
    },
    [stream]
  );

  async function handleShare() {
    setError(null);
    try {
      const s = await startScreenCapture();
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
      s.getVideoTracks()[0]?.addEventListener('ended', () => setStream(null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de démarrer le partage d'écran.");
    }
  }

  function handleStop() {
    stopStream(stream);
    setStream(null);
  }

  function handleCaptureCalibrationFrame() {
    if (!videoRef.current || videoRef.current.videoWidth === 0) {
      setError("Le flux vidéo n'est pas encore prêt — attends une seconde puis réessaie.");
      return;
    }
    const frame = grabFrame(videoRef.current);
    setCalibrationFrameUrl(frame.toDataURL('image/png'));
  }

  function handleRegionDrawn(key: RegionKey, region: { x: number; y: number; width: number; height: number }) {
    setCalibration((c) => ({ ...c, [key]: { key, ...region } }));
    const idx = REGION_KEYS.indexOf(key);
    setActiveKey(REGION_KEYS[(idx + 1) % REGION_KEYS.length]);
  }

  async function handleReadScreen() {
    if (!videoRef.current || videoRef.current.videoWidth === 0) {
      setError("Le flux vidéo n'est pas prêt.");
      return;
    }
    const calibratedKeys = REGION_KEYS.filter((k) => calibration[k]);
    if (calibratedKeys.length === 0) {
      setError("Calibre d'abord au moins une zone (bouton « Capturer une image pour calibrer »).");
      return;
    }
    setReading(true);
    setError(null);
    try {
      const frame = grabFrame(videoRef.current);
      const results: Partial<Record<RegionKey, ReadResult>> = {};
      const drafts: Partial<Record<RegionKey, string>> = {};
      for (const key of calibratedKeys) {
        const region = calibration[key]!;
        const crop = cropRegion(frame, region);
        const { rawText, value } = await recognizeNumber(crop);
        results[key] = { key, rawText, value };
        drafts[key] = value !== null ? String(value) : '';
      }
      setReadResults((r) => ({ ...r, ...results }));
      setDraftValues((d) => ({ ...d, ...drafts }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la lecture OCR.');
    } finally {
      setReading(false);
    }
  }

  function handleValidate() {
    const values: Partial<LineValues> = {};
    let puits: number | undefined;
    for (const key of REGION_KEYS) {
      const raw = draftValues[key];
      if (raw === undefined || raw.trim() === '') continue;
      const n = Number(raw);
      if (Number.isNaN(n)) continue;
      if (key === 'puits') puits = n;
      else values[key as LineKey] = n;
    }
    liveCoach.applyReadValues(values, puits);
  }

  const calibratedCount = REGION_KEYS.filter((k) => calibration[k]).length;

  return (
    <div className="live-coach">
      <section className="live-capture-section">
        <h3>1. Partage d'écran</h3>
        <p className="objectives-hint">
          Partage la fenêtre ou l'écran où Dofus affiche la forgemagie. Rien ne quitte ton navigateur : la
          lecture (OCR) tourne entièrement en local.
        </p>
        <div className="controls">
          {!stream ? (
            <button type="button" onClick={handleShare}>
              Partager mon écran
            </button>
          ) : (
            <button type="button" className="danger" onClick={handleStop}>
              Arrêter le partage
            </button>
          )}
          <button type="button" onClick={handleCaptureCalibrationFrame} disabled={!stream}>
            Capturer une image pour calibrer
          </button>
          <button type="button" onClick={handleReadScreen} disabled={!stream || reading || calibratedCount === 0}>
            {reading ? 'Lecture en cours…' : 'Lire l\'écran'}
          </button>
        </div>
        {error && <div className="live-error">{error}</div>}
        <video ref={videoRef} className="live-video-preview" muted playsInline />
      </section>

      {calibrationFrameUrl && (
        <section className="live-calibration-section">
          <h3>2. Calibrage des zones ({calibratedCount}/{REGION_KEYS.length})</h3>
          <p className="objectives-hint">
            Choisis une ligne ci-dessous puis dessine un rectangle serré autour du nombre correspondant
            dans l'image. La zone est mémorisée (même après fermeture du navigateur) tant que la fenêtre du
            jeu garde la même position à l'écran.
          </p>
          <div className="region-picker">
            {REGION_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`region-chip ${key === activeKey ? 'region-chip-active' : ''} ${calibration[key] ? 'region-chip-done' : ''}`}
                onClick={() => setActiveKey(key)}
              >
                {labelFor(key)}
              </button>
            ))}
          </div>
          <CalibrationEditor
            frameDataUrl={calibrationFrameUrl}
            calibration={calibration}
            activeKey={activeKey}
            onRegionDrawn={handleRegionDrawn}
            labelFor={labelFor}
          />
        </section>
      )}

      {Object.keys(readResults).length > 0 && (
        <section className="live-results-section">
          <h3>3. Valeurs lues (corrige si besoin)</h3>
          <div className="read-results-grid">
            {REGION_KEYS.filter((k) => readResults[k]).map((key) => {
              const result = readResults[key]!;
              return (
                <div className="read-result-row" key={key}>
                  <label>{labelFor(key)}</label>
                  <input
                    type="number"
                    value={draftValues[key] ?? ''}
                    onChange={(e) => setDraftValues((d) => ({ ...d, [key]: e.target.value }))}
                  />
                  {result.value === null && <span className="read-raw-hint">brut: "{result.rawText}"</span>}
                </div>
              );
            })}
          </div>
          <button type="button" className="coach-apply-btn" onClick={handleValidate}>
            Valider ces valeurs
          </button>
        </section>
      )}

      <div className="live-coaching-layout">
        <section className="sheet-column">
          <h3>Objet suivi</h3>
          <Gauges state={liveCoach.state} goals={goals} />
          <ManualValuesPanel
            state={liveCoach.state}
            onSetValue={liveCoach.setValue}
            onSetPuits={liveCoach.setPuits}
            onReset={() => liveCoach.resetTo(MON_ANNEAU_HDV_VALUES)}
          />
        </section>
        <section className="action-column">
          <CoachPanel advice={liveCoach.advice} />
          <RuneGrid state={liveCoach.state} recommendedRuneId={liveCoach.advice.rune?.id ?? null} onPose={() => {}} readOnly />
        </section>
      </div>
    </div>
  );
}
