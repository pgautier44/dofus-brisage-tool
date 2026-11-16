import { useEffect, useRef, useState } from 'react';
import { LINES, LINE_ORDER, MON_ANNEAU_HDV_VALUES } from '../engine/config';
import type { GoalOverrides, LineKey, LineValues, ObjectState } from '../engine/types';
import { useLiveCoach } from '../hooks/useLiveCoach';
import { cropRegion, grabFrame, startScreenCapture, stopStream } from '../screen/capture';
import { recognizeDecimal, recognizeNumber } from '../screen/ocr';
import type { Calibration, ReadResult, RegionKey } from '../screen/types';
import { loadCalibration, saveCalibration } from '../storage';
import { CalibrationEditor } from './CalibrationEditor';
import { CalibrationGuide } from './CalibrationGuide';
import { CoachPanel } from './CoachPanel';
import { Gauges } from './Gauges';
import { RuneGrid } from './RuneGrid';

// Le PA (exo) n'apparaît jamais comme une valeur numérique affichée dans Dofus tant qu'il
// n'est pas obtenu (pas de ligne à cadrer) : il n'a donc pas sa place dans la liste des
// zones à calibrer/lire par OCR — seule la saisie manuelle (0 ou 1) a du sens pour lui.
const REGION_KEYS: RegionKey[] = [...LINE_ORDER.filter((k) => k !== 'pa'), 'puits'];

function labelFor(key: RegionKey): string {
  return key === 'puits' ? 'Puits ("reliquat" dans Dofus)' : LINES[key].label;
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
  const [calibration, setCalibration] = useState<Calibration>(() => {
    const stored = loadCalibration();
    // Nettoie une éventuelle zone "pa" enregistrée avant ce correctif (plus valide).
    const cleaned: Calibration = {};
    REGION_KEYS.forEach((key) => {
      if (stored[key]) cleaned[key] = stored[key];
    });
    return cleaned;
  });
  const [activeKey, setActiveKey] = useState<RegionKey>(REGION_KEYS[0]);
  const [calibrationFrameUrl, setCalibrationFrameUrl] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [readResults, setReadResults] = useState<Partial<Record<RegionKey, ReadResult>>>({});
  const [draftValues, setDraftValues] = useState<Partial<Record<RegionKey, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [justValidated, setJustValidated] = useState(false);
  const [zoom, setZoom] = useState(100);

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
        // Capture tout de suite une image de calibrage dès que la vidéo a sa première
        // frame, pour ne pas laisser un clic de plus à deviner après le partage.
        const video = videoRef.current;
        const captureWhenReady = () => {
          if (video.videoWidth > 0) {
            const frame = grabFrame(video);
            setCalibrationFrameUrl(frame.toDataURL('image/png'));
          }
        };
        if (video.videoWidth > 0) captureWhenReady();
        else video.addEventListener('loadeddata', captureWhenReady, { once: true });
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

  function handleResetCalibration() {
    setCalibration({});
    setActiveKey(REGION_KEYS[0]);
  }

  function handleClearRegion(key: RegionKey) {
    setCalibration((c) => {
      const next = { ...c };
      delete next[key];
      return next;
    });
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
        const { rawText, value } = key === 'puits' ? await recognizeDecimal(crop) : await recognizeNumber(crop);
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
    setJustValidated(true);
    setTimeout(() => setJustValidated(false), 4000);
  }

  const calibratedCount = REGION_KEYS.filter((k) => calibration[k]).length;
  const hasRead = Object.keys(readResults).length > 0;

  return (
    <div className="live-coach">
      <div className="live-steps">
        <span className={`live-step ${stream ? 'live-step-done' : 'live-step-active'}`}>
          {stream ? '✓' : '①'} Partager l'écran
        </span>
        <span className={`live-step ${calibratedCount > 0 ? 'live-step-done' : stream ? 'live-step-active' : 'live-step-todo'}`}>
          {calibratedCount > 0 ? '✓' : '②'} Calibrer ({calibratedCount}/{REGION_KEYS.length})
        </span>
        <span className={`live-step ${hasRead ? 'live-step-done' : calibratedCount > 0 ? 'live-step-active' : 'live-step-todo'}`}>
          {hasRead ? '✓' : '③'} Lire puis valider
        </span>
      </div>

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
            {calibrationFrameUrl ? 'Reprendre une image (si la fenêtre a bougé)' : 'Capturer une image pour calibrer'}
          </button>
          <button type="button" onClick={handleReadScreen} disabled={!stream || reading || calibratedCount === 0}>
            {reading ? 'Lecture en cours…' : "Lire l'écran"}
          </button>
        </div>
        {stream && calibratedCount === 0 && (
          <p className="live-hint-inline">
            ⚠️ Calibre au moins une zone ci-dessous (étape 2) — le bouton "Lire l'écran" restera grisé
            tant qu'aucune zone n'est définie.
          </p>
        )}
        {error && <div className="live-error">{error}</div>}
        <video ref={videoRef} className="live-video-preview" muted playsInline />
      </section>

      {calibrationFrameUrl && (
        <section className="live-calibration-section">
          <div className="section-header-row">
            <h3>2. Calibrage des zones ({calibratedCount}/{REGION_KEYS.length})</h3>
            <button type="button" className="danger" onClick={handleResetCalibration} disabled={calibratedCount === 0}>
              Réinitialiser tout le calibrage
            </button>
          </div>
          <p className="objectives-hint">
            Choisis une ligne ci-dessous puis dessine un rectangle autour du nombre correspondant dans
            l'image — <strong>laisse un peu de marge</strong> (pas collé aux chiffres) : si la valeur passe
            de 2 à 3 chiffres (ex: 9 → 10) ou qu'un badge +1/-1 apparaît juste à côté après une pose, une
            zone trop serrée peut rater le nouveau texte ou capturer le badge par erreur. Inclure un bout du
            nom de la ligne (le mot, pas juste le chiffre) ne pose aucun problème : seuls les chiffres sont
            gardés, le reste est ignoré automatiquement. La zone est mémorisée tant que la fenêtre du jeu
            garde la même position à l'écran.{' '}
            <strong>Pas besoin de toutes les faire</strong> : seules les zones calibrées seront lues par
            "Lire l'écran" ; les autres restent modifiables à la main dans "Saisie / correction manuelle"
            ci-dessous. Le PA (exo) n'apparaît pas ici — il ne s'affiche comme valeur nulle part dans Dofus
            tant qu'il n'est pas obtenu, donc il se renseigne uniquement à la main (0 ou 1). Le "Puits" est
            appelé <strong>"reliquat"</strong> dans Dofus (affiché en haut du panneau). Pour refaire une
            seule zone, redessine simplement par-dessus, ou efface-la avec le ✕.
          </p>
          <details className="objectives-panel calibration-guide-details">
            <summary>Voir un exemple de bon/mauvais cadrage</summary>
            <CalibrationGuide />
          </details>
          <div className="region-picker">
            {REGION_KEYS.map((key) => (
              <span className="region-chip-wrap" key={key}>
                <button
                  type="button"
                  className={`region-chip ${key === activeKey ? 'region-chip-active' : ''} ${calibration[key] ? 'region-chip-done' : ''}`}
                  onClick={() => setActiveKey(key)}
                >
                  {labelFor(key)}
                </button>
                {calibration[key] && (
                  <button
                    type="button"
                    className="region-chip-clear-btn"
                    aria-label={`Effacer la zone ${labelFor(key)}`}
                    title="Effacer cette zone"
                    onClick={() => handleClearRegion(key)}
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
          <p className="objectives-hint">
            Seule la zone de la ligne sélectionnée ci-dessus s'affiche sur l'image (pour ne pas se gêner avec
            les autres) — les zones déjà faites ne sont pas perdues, clique leur chip pour les revoir.
          </p>
          <div className="calibration-zoom-controls">
            <span>Zoom :</span>
            {[100, 150, 200, 300].map((z) => (
              <button
                key={z}
                type="button"
                className={zoom === z ? 'active' : ''}
                onClick={() => setZoom(z)}
              >
                {z}%
              </button>
            ))}
            <span>utilise l'ascenseur de l'image pour te déplacer une fois zoomé.</span>
          </div>
          <CalibrationEditor
            frameDataUrl={calibrationFrameUrl}
            calibration={calibration}
            activeKey={activeKey}
            onRegionDrawn={handleRegionDrawn}
            labelFor={labelFor}
            zoom={zoom}
          />
          {calibratedCount > 0 && (
            <div className="live-next-step">
              <p className="live-success">
                {calibratedCount === REGION_KEYS.length
                  ? '✅ Toutes les zones sont calibrées.'
                  : `${calibratedCount} zone(s) calibrée(s) — tu peux déjà tester, ou continuer à en ajouter.`}{' '}
                Teste maintenant la lecture pour voir si l'OCR reconnaît bien tes valeurs :
              </p>
              <button type="button" className="coach-apply-btn" onClick={handleReadScreen} disabled={reading}>
                {reading ? 'Lecture en cours…' : "Lire l'écran maintenant"}
              </button>
              {reading && (
                <p className="objectives-hint">
                  La toute première lecture télécharge le moteur de reconnaissance (quelques Mo) —
                  ça peut prendre 10-20 secondes la première fois, puis c'est rapide ensuite.
                </p>
              )}
              {error && <div className="live-error">{error}</div>}
            </div>
          )}
        </section>
      )}

      {hasRead && (
        <section className="live-results-section">
          <h3>3. Valeurs lues (corrige si besoin)</h3>
          <p className="live-success">
            ✅ Lecture terminée — les champs en rouge n'ont pas pu être lus (tape la valeur à la main),
            corrige le reste si besoin, puis clique "Valider ces valeurs" pour que le coach en tienne compte.
          </p>
          <div className="read-results-grid">
            {REGION_KEYS.filter((k) => readResults[k]).map((key) => {
              const result = readResults[key]!;
              return (
                <div className="read-result-row" key={key}>
                  <label>{labelFor(key)}</label>
                  <input
                    type="number"
                    step={key === 'puits' ? '0.1' : '1'}
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
          {justValidated && (
            <p className="live-success">✅ Valeurs appliquées — le coach ci-contre est à jour.</p>
          )}
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
