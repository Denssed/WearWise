export interface ParsedAuthUrl {
  accessToken?: string;
  refreshToken?: string;
  /** `recovery`, `signup`, `magiclink`, etc. (lo envía Supabase en el enlace). */
  type?: string;
  /** Código PKCE, si el flujo lo usa. */
  code?: string;
  error?: string;
}

function parsePairs(segment: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!segment) return out;
  for (const pair of segment.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawVal = eq === -1 ? '' : pair.slice(eq + 1);
    try {
      out[decodeURIComponent(rawKey)] = decodeURIComponent(rawVal.replace(/\+/g, ' '));
    } catch {
      // Parámetro mal codificado: se ignora.
    }
  }
  return out;
}

/** Extrae los datos de autenticación de un deep link (`wearwise://auth-callback#access_token=...`). */
export function parseAuthUrl(url: string): ParsedAuthUrl {
  const hashIdx = url.indexOf('#');
  const hash = hashIdx === -1 ? '' : url.slice(hashIdx + 1);
  const beforeHash = hashIdx === -1 ? url : url.slice(0, hashIdx);
  const qIdx = beforeHash.indexOf('?');
  const query = qIdx === -1 ? '' : beforeHash.slice(qIdx + 1);

  const params = { ...parsePairs(query), ...parsePairs(hash) };
  return {
    accessToken: params.access_token,
    refreshToken: params.refresh_token,
    type: params.type,
    code: params.code,
    error: params.error_description || params.error,
  };
}
