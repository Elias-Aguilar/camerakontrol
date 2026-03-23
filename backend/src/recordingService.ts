import { PrismaClient } from "@prisma/client";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

const prisma = new PrismaClient();

// Map: cameraId -> ChildProcess (FFmpeg activo)
const activeRecordings = new Map<number, { process: import("child_process").ChildProcess; startedAt: Date }>();

const RECORDINGS_BASE = process.env.RECORDINGS_PATH || path.join(process.cwd(), "recordings");
const FFMPEG_CMD = process.env.FFMPEG_PATH || "ffmpeg";
const CHECK_INTERVAL_MS = 30_000; // Revisar cada 30 segundos
const CLEANUP_INTERVAL_MS = 60_000; // Limpieza cada 1 minuto
let lastCleanupAt = 0;
// RECORDING_USE_COPY=1 usa -c copy (menos CPU, pero algunas cámaras H.265 no reproducen en Windows)
const USE_COPY = process.env.RECORDING_USE_COPY === "1";
// Reducir tamaño: CRF más alto = menor tamaño (28-30 típico para vigilancia)
const RECORDING_CRF = Number(process.env.RECORDING_CRF) || 28;
// preset: fast = mejor compresión que ultrafast, moderate = más lento pero archivos más pequeños
const RECORDING_PRESET = process.env.RECORDING_PRESET || "fast";
// Escalar a 720p (0 = sin escalar)
const RECORDING_SCALE = process.env.RECORDING_SCALE ? Number(process.env.RECORDING_SCALE) : 720;
// fps (0 = mantener del source)
const RECORDING_FPS = process.env.RECORDING_FPS ? Number(process.env.RECORDING_FPS) : 15;

function buildRtspUrl(camera: { ip: string; port: number; username: string | null; password: string | null; protocol: string; rtspUrl: string | null }): string | null {
  if (camera.protocol !== "rtsp" || !camera.ip) return camera.rtspUrl;
  const basePort = camera.port || 554;
  const userPart =
    camera.username && camera.password
      ? `${encodeURIComponent(camera.username)}:${encodeURIComponent(camera.password)}@`
      : "";
  return `rtsp://${userPart}${camera.ip}:${basePort}/`;
}

/** Parsea "HH:mm" a minutos desde medianoche */
function timeToMinutes(s: string | null | undefined): number | null {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** ¿Está la hora actual dentro de [start, end]? (minutos desde medianoche) */
function isWithinTimeWindow(nowMinutes: number, start: number, end: number): boolean {
  if (start <= end) return nowMinutes >= start && nowMinutes < end;
  // Cruza medianoche: ej. 22:00 - 06:00
  return nowMinutes >= start || nowMinutes < end;
}

function resolveRecordingPath(r: { filePath: string; cameraId: number; fileName: string; startedAt: Date }): string | null {
  const dateStr = r.startedAt.toISOString().slice(0, 10);
  const relPath = path.join(String(r.cameraId), dateStr, r.fileName);
  const bases = [
    RECORDINGS_BASE,
    path.join(process.cwd(), "recordings"),
    path.join(__dirname, "..", "recordings"),
  ];
  const storedPath = path.normalize(r.filePath);
  if (path.isAbsolute(storedPath) && fs.existsSync(storedPath)) return storedPath;
  for (const base of bases) {
    const candidate = path.join(base, relPath);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Duración en segundos hasta que termine la ventana */
function secondsUntilEnd(nowMinutes: number, endMinutes: number, now: Date): number {
  const nowSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  let endSecs = Math.floor(endMinutes / 60) * 3600 + (endMinutes % 60) * 60;
  if (endMinutes * 60 <= nowSecs) endSecs += 24 * 3600; // siguiente día
  return Math.max(1, endSecs - nowSecs);
}

async function startRecording(camera: { id: number; name: string; ip: string; port: number; username: string | null; password: string | null; protocol: string; rtspUrl: string | null }): Promise<void> {
  const rtspUrl = buildRtspUrl(camera);
  if (!rtspUrl) {
    console.warn(`[Recording] Cámara ${camera.id} sin RTSP URL, omitiendo`);
    return;
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const timeStr = now.toTimeString().slice(0, 5).replace(":", "-"); // HH-mm
  const dir = path.join(RECORDINGS_BASE, String(camera.id), dateStr);
  const fileName = `cam_${camera.id}_${timeStr}.mp4`;
  const filePath = path.join(dir, fileName);

  fs.mkdirSync(dir, { recursive: true });

  const cameraData = await prisma.camera.findUnique({
    where: { id: camera.id },
    select: { recordingEndTime: true, recordingStartTime: true, recordingFragmentMinutes: true },
  });
  if (!cameraData?.recordingEndTime) return;

  const endMinutes = timeToMinutes(cameraData.recordingEndTime) ?? 24 * 60;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const totalUntilEnd = secondsUntilEnd(nowMinutes, endMinutes, now);
  const fragmentMins = cameraData.recordingFragmentMinutes ?? 1;
  const fragmentSecs = Math.max(1, fragmentMins) * 60;
  const durationSecs = Math.min(totalUntilEnd, fragmentSecs);

  // Opciones para compatibilidad: timestamps, timeouts. Re-encode a H.264 para Windows/navegadores.
  const inputArgs = [
    "-rtsp_transport", "tcp",
    "-analyzeduration", "2000000",
    "-probesize", "2000000",
    "-use_wallclock_as_timestamps", "1",
    "-fflags", "+genpts",
    "-i", rtspUrl,
    "-t", String(durationSecs),
  ];
  const outputArgs = ["-movflags", "+faststart", "-y", filePath];
  const codecArgs = USE_COPY
    ? ["-c", "copy"]
    : [
        "-c:v", "libx264",
        "-preset", RECORDING_PRESET,
        "-crf", String(RECORDING_CRF),
        ...(RECORDING_SCALE > 0 ? ["-vf", `scale=-2:${RECORDING_SCALE}`] : []),
        ...(RECORDING_FPS > 0 ? ["-r", String(RECORDING_FPS)] : []),
        "-an",
      ];
  const args = [...inputArgs, ...codecArgs, ...outputArgs];

  const proc = spawn(FFMPEG_CMD, args, { stdio: ["ignore", "pipe", "pipe"] });

  activeRecordings.set(camera.id, { process: proc, startedAt: now });

  proc.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg.includes("error") || msg.includes("Error") || msg.includes("Invalid")) {
      console.error(`[Recording] FFmpeg cam ${camera.id}:`, msg);
    }
  });

  proc.on("exit", async (code, signal) => {
    activeRecordings.delete(camera.id);
    const endedAt = new Date();
    const actualDuration = Math.round((endedAt.getTime() - now.getTime()) / 1000);
    if (code !== 0 && code !== null) {
      console.warn(`[Recording] FFmpeg cam ${camera.id} terminó con código ${code} (señal ${signal}). Duración real: ${actualDuration}s (esperada: ${durationSecs}s)`);
    }
    let fileSizeBytes: number | null = null;
    try {
      const stat = fs.statSync(filePath);
      fileSizeBytes = stat.size;
    } catch {
      // archivo no existe o error
    }

    try {
      await prisma.recording.create({
        data: {
          cameraId: camera.id,
          filePath,
          fileName,
          startedAt: now,
          endedAt,
          durationSecs: actualDuration,
          fileSizeBytes,
        },
      });
      console.log(`[Recording] Grabación guardada: ${fileName} (cámara ${camera.id})`);
    } catch (err) {
      console.error(`[Recording] Error guardando metadata para cámara ${camera.id}:`, err);
    }
  });
}

async function runCleanup(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  const cameras = await prisma.camera.findMany({
    where: { retentionDays: { not: null, gt: 0 } },
    select: { id: true, retentionDays: true },
  });
  if (cameras.length === 0) return;

  for (const cam of cameras) {
    const days = cam.retentionDays!;
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    const oldRecordings = await prisma.recording.findMany({
      where: { cameraId: cam.id, startedAt: { lt: cutoff } },
      select: { id: true, filePath: true, fileName: true, cameraId: true, startedAt: true },
    });
    for (const r of oldRecordings) {
      const fullPath = resolveRecordingPath(r);
      if (fullPath) {
        try {
          fs.unlinkSync(fullPath);
        } catch (err) {
          console.warn(`[Recording] No se pudo borrar ${fullPath}:`, err);
        }
      }
      await prisma.recording.delete({ where: { id: r.id } });
    }
    if (oldRecordings.length > 0) {
      console.log(`[Recording] Retención: ${oldRecordings.length} grabaciones eliminadas (cámara ${cam.id}, >${days} días)`);
    }
  }
}

async function tick(): Promise<void> {
  await runCleanup();

  const cameras = await prisma.camera.findMany({
    where: {
      recordingEnabled: true,
      isOnline: true,
      recordingStartTime: { not: null },
      recordingEndTime: { not: null },
    },
  });

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const cam of cameras) {
    const start = timeToMinutes(cam.recordingStartTime!) ?? 0;
    const end = timeToMinutes(cam.recordingEndTime!) ?? 24 * 60;

    if (!isWithinTimeWindow(nowMinutes, start, end)) {
      if (activeRecordings.has(cam.id)) {
        const { process: proc } = activeRecordings.get(cam.id)!;
        proc.kill("SIGTERM");
        activeRecordings.delete(cam.id);
      }
      continue;
    }

    if (!activeRecordings.has(cam.id)) {
      await startRecording(cam);
    }
  }
}

export function startRecordingService(): void {
  console.log("[Recording] Servicio de grabación iniciado");
  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
}
