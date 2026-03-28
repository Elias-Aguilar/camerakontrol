/** Ventana de grabación en formato HH:mm (API y DB) */
export type RecordingWindow = { start: string; end: string };

/** Ventana normalizada en minutos desde medianoche para la lógica de grabación */
export type WindowMinutes = { start: number; end: number; crossesMidnight: boolean };

export function timeToMinutes(s: string | null | undefined): number | null {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Normaliza start/end en minutos:
 * - 09:00–10:00: mismo día
 * - 22:00–06:00: cruza medianoche
 * - 20:00–00:00: hasta fin de día (tratamos 00:00 como 24:00 cuando el inicio es por la tarde)
 */
export function normalizeWindowMinutes(startMin: number, endMin: number): WindowMinutes | null {
  if (startMin === endMin) return null;
  // 20:00 → 00:00 = hasta medianoche del mismo día
  if (endMin === 0 && startMin > 0) {
    return { start: startMin, end: 24 * 60, crossesMidnight: false };
  }
  if (startMin < endMin) {
    return { start: startMin, end: endMin, crossesMidnight: false };
  }
  return { start: startMin, end: endMin, crossesMidnight: true };
}

export function isWithinWindow(nowMinutes: number, w: WindowMinutes): boolean {
  if (!w.crossesMidnight) {
    return nowMinutes >= w.start && nowMinutes < w.end;
  }
  return nowMinutes >= w.start || nowMinutes < w.end;
}

/** Parsea JSON de Prisma / API a ventanas válidas (máx. 3) */
export function parseRecordingWindowsJson(json: unknown): WindowMinutes[] {
  if (!json || !Array.isArray(json)) return [];
  const out: WindowMinutes[] = [];
  for (const item of json.slice(0, 3)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const sm = timeToMinutes(typeof o.start === "string" ? o.start : null);
    const em = timeToMinutes(typeof o.end === "string" ? o.end : null);
    if (sm === null || em === null) continue;
    const nw = normalizeWindowMinutes(sm, em);
    if (nw) out.push(nw);
  }
  return out;
}

export function parseHHmm(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}

/** Valida y normaliza el body de la API (máx. 3 ventanas) */
export function normalizeRecordingWindowsInput(raw: unknown): RecordingWindow[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const out: RecordingWindow[] = [];
  for (const x of raw.slice(0, 3)) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const start = parseHHmm(o.start);
    const end = parseHHmm(o.end);
    if (!start || !end) continue;
    if (start === end) continue;
    out.push({ start, end });
  }
  return out;
}

/** Ventana activa ahora, o null */
export function getActiveWindow(nowMinutes: number, windows: WindowMinutes[]): WindowMinutes | null {
  for (const w of windows) {
    if (isWithinWindow(nowMinutes, w)) return w;
  }
  return null;
}
