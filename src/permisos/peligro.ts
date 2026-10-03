/**
 * Patrones claramente peligrosos. Solo sirven para resaltar la tarjeta: no
 * bloquean nada y no pretenden ser una lista completa.
 */
const PATRONES: readonly RegExp[] = [
  // Borrado recursivo forzado (Unix y PowerShell).
  /\brm\s+(-\w*r\w*f|-\w*f\w*r|-r\s+-f|-f\s+-r)/i,
  /\bRemove-Item\b.*-Recurse/i,
  // Borrado recursivo en cmd.
  /\b(del|erase)\b.*\s\/s\b/i,
  /\b(rd|rmdir)\b.*\s\/s\b/i,
  // Formateo y operaciones de disco.
  /\bformat(\.com)?\s+[a-z]:/i,
  /\b(Format-Volume|Clear-Disk|Initialize-Disk)\b/i,
  /\bdiskpart\b/i,
  /\bmkfs(\.\w+)?\b/i,
  /\bdd\s+.*\bof=\/dev\//i,
  // Archivos de credenciales.
  /(^|[\\/\s"'])\.env(\.[\w-]+)?($|[\s"'])/i,
  /(^|[\\/])(id_rsa|id_ed25519|id_ecdsa)(\.pub)?\b/i,
  /[\\/]\.ssh[\\/]/i,
  /[\\/]\.aws[\\/]credentials/i,
  /\.git-credentials\b/i,
  /(^|[\\/])\.npmrc\b/i,
  /(^|[\\/])\.netrc\b/i,
];

export function esPeligroso(texto: string): boolean {
  return PATRONES.some((patron) => patron.test(texto));
}
