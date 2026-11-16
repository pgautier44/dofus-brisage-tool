/**
 * Schéma illustratif (pas une vraie capture du jeu) montrant quoi inclure dans une zone
 * de calibrage pour une ligne de stat : le chiffre (avec un peu de marge, un bout du nom
 * de la ligne toléré) en vert, les icônes Modif/Pa/Ra et le symbole % à éviter en rouge.
 */
export function CalibrationGuide() {
  return (
    <div className="calibration-guide">
      <svg viewBox="0 0 560 150" role="img" aria-label="Exemple de bon et mauvais cadrage d'une ligne de stat">
        <rect x="0" y="0" width="560" height="150" rx="8" fill="#2b2e52" />

        {/* En-tête de colonnes */}
        <text x="16" y="22" fill="#9aa0c7" fontSize="13" fontFamily="monospace">
          Min
        </text>
        <text x="56" y="22" fill="#9aa0c7" fontSize="13" fontFamily="monospace">
          Max
        </text>
        <text x="110" y="22" fill="#9aa0c7" fontSize="13" fontFamily="monospace">
          Effets / Carac
        </text>
        <text x="420" y="22" fill="#9aa0c7" fontSize="13" fontFamily="monospace">
          Modif.
        </text>
        <text x="482" y="22" fill="#9aa0c7" fontSize="13" fontFamily="monospace">
          Pa
        </text>
        <text x="518" y="22" fill="#9aa0c7" fontSize="13" fontFamily="monospace">
          Ra
        </text>

        {/* Ligne de données */}
        <rect x="8" y="34" width="544" height="34" rx="4" fill="#363a66" />
        <text x="16" y="56" fill="#dfe2f5" fontSize="16" fontFamily="monospace">
          5
        </text>
        <text x="56" y="56" fill="#dfe2f5" fontSize="16" fontFamily="monospace">
          7
        </text>
        <text x="110" y="56" fill="#f4c542" fontSize="16" fontFamily="monospace">
          0
        </text>
        <text x="128" y="56" fill="#dfe2f5" fontSize="16" fontFamily="monospace">
          Résistance Air
        </text>
        <circle cx="428" cy="51" r="11" fill="#5a8f4f" />
        <circle cx="490" cy="51" r="11" fill="#5a8f4f" />
        <circle cx="526" cy="51" r="11" fill="#c45a5a" />

        {/* Zone idéale (vert) : le chiffre + un peu de marge + un bout du nom */}
        <rect
          x="104"
          y="38"
          width="110"
          height="26"
          rx="4"
          fill="none"
          stroke="#5fd16a"
          strokeWidth="2.5"
          strokeDasharray="5 4"
        />
        <text x="104" y="92" fill="#5fd16a" fontSize="13" fontWeight="bold">
          ✅ zone idéale
        </text>
        <text x="104" y="108" fill="#aeb4d6" fontSize="11">
          le chiffre, un peu de marge,
        </text>
        <text x="104" y="122" fill="#aeb4d6" fontSize="11">
          un bout du nom toléré
        </text>

        {/* Zone à éviter (rouge) : icônes Modif/Pa/Ra */}
        <rect
          x="406"
          y="38"
          width="146"
          height="26"
          rx="4"
          fill="none"
          stroke="#e05a5a"
          strokeWidth="2.5"
          strokeDasharray="5 4"
        />
        <text x="406" y="92" fill="#e05a5a" fontSize="13" fontWeight="bold">
          ❌ jamais ça
        </text>
        <text x="406" y="108" fill="#aeb4d6" fontSize="11">
          icônes Modif / Pa / Ra,
        </text>
        <text x="406" y="122" fill="#aeb4d6" fontSize="11">
          badges +1/-1 après une pose
        </text>
      </svg>
      <p className="objectives-hint calibration-guide-caption">
        Pour une ligne en %, même logique : vise juste le chiffre (le "%" ne gêne plus la lecture, mais
        l'exclure reste la zone la plus sûre). Le principe ne change pas d'une ligne à l'autre : chiffre +
        marge d'abord, jamais les icônes à droite.
      </p>
    </div>
  );
}
