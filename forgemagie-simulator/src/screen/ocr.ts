import * as Tesseract from 'tesseract.js';

let workerPromise: Promise<Tesseract.Worker> | null = null;

// Le tout premier appel télécharge le moteur Tesseract (wasm + données de langue) depuis
// un CDN — sur un réseau qui le bloque (proxy d'entreprise, etc.), ça resterait sinon
// bloqué indéfiniment sur "Lecture en cours…" sans aucun message.
const WORKER_INIT_TIMEOUT_MS = 25000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function getWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    workerPromise = withTimeout(
      Tesseract.createWorker('eng').then(async (worker) => {
        await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE });
        return worker;
      }),
      WORKER_INIT_TIMEOUT_MS,
      "Le moteur de lecture n'a pas réussi à se charger (réseau lent ou bloqué). Réessaie, ou utilise la saisie manuelle en attendant."
    ).catch((err) => {
      // Permet une nouvelle tentative au prochain clic plutôt que de rester bloqué sur un
      // échec permanent.
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

// Le puits ("reliquat" dans Dofus) est la seule valeur décimale (ex: "0,2") ; les lignes de
// stats sont toujours des entiers. On bascule la liste de caractères autorisés juste avant
// chaque lecture plutôt que de la fixer une fois pour toutes sur le worker partagé.
//
// Le "%" est inclus dans la liste même si on ne le garde jamais au parsing (parseDigits le
// filtre) : sans lui dans la liste, Tesseract ne peut PAS afficher "%" (il est interdit par
// la liste blanche) et approxime son tracé par le chiffre autorisé qui lui ressemble le
// plus, ce qui colle un chiffre parasite après la vraie valeur (ex: "4%" lu "49"). Autoriser
// "%" lui permet de le reconnaître pour ce qu'il est, pour qu'on puisse ensuite le jeter.
async function setWhitelist(decimal: boolean): Promise<void> {
  const worker = await getWorker();
  await worker.setParameters({
    tessedit_char_whitelist: decimal ? '0123456789,.' : '0123456789%',
  });
}

export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  workerPromise = null;
  await worker.terminate();
}

/**
 * Ne garde que les chiffres d'un texte reconnu par l'OCR et le convertit en nombre.
 * Si la zone capturée contient un "valeur/max" (ex: "39/40"), on ne garde que la
 * valeur avant le "/" plutôt que de concaténer les deux nombres.
 */
export function parseDigits(rawText: string): number | null {
  const firstSegment = rawText.split('/')[0];
  const digits = firstSegment.replace(/[^0-9]/g, '');
  return digits.length > 0 ? Number(digits) : null;
}

/**
 * Comme parseDigits, mais pour une valeur décimale (le puits/"reliquat", ex: "0,2") : la
 * virgule française est normalisée en point avant conversion, et un seul séparateur est
 * conservé (le premier) pour éviter qu'un bruit de l'OCR n'en introduise un second.
 */
export function parseDecimal(rawText: string): number | null {
  const firstSegment = rawText.split('/')[0].replace(',', '.');
  const match = firstSegment.match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/** Lit un nombre entier sur une image déjà recadrée sur la zone concernée. */
export async function recognizeNumber(image: HTMLCanvasElement): Promise<{ rawText: string; value: number | null }> {
  await setWhitelist(false);
  const worker = await getWorker();
  const {
    data: { text },
  } = await worker.recognize(image);
  const rawText = text.trim();
  return { rawText, value: parseDigits(rawText) };
}

/** Comme recognizeNumber, mais autorise une virgule/point pour lire le puits ("reliquat"). */
export async function recognizeDecimal(image: HTMLCanvasElement): Promise<{ rawText: string; value: number | null }> {
  await setWhitelist(true);
  const worker = await getWorker();
  const {
    data: { text },
  } = await worker.recognize(image);
  const rawText = text.trim();
  return { rawText, value: parseDecimal(rawText) };
}
