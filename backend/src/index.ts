import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
// @ts-ignore - la librer?a onvif no tiene tipos oficiales
import * as onvif from "onvif";
// @ts-ignore - fluent-ffmpeg tiene tipos pero pueden fallar en algunos casos
import ffmpeg from "fluent-ffmpeg";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as net from "net";
import { startRecordingService } from "./recordingService";

function checkCameraReachable(ip: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    socket.connect(port, ip, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const RECORDINGS_BASE = process.env.RECORDINGS_PATH || path.join(process.cwd(), "recordings");

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

app.get("/cameras", async (_req, res) => {
  const cameras = await prisma.camera.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(cameras);
});

app.get("/cameras/discover", async (_req, res) => {
  try {
    const devices = await new Promise<any[]>((resolve, reject) => {
      onvif.Discovery.probe((err: unknown, cams: any[]) => {
        if (err) return reject(err);
        const mapped = (cams || []).map((cam: any, index: number) => ({
          id: index,
          name: cam.name || cam.hostname || "Cámara ONVIF",
          address: cam.address,
          hostname: cam.hostname,
          port: cam.port,
          xaddr: cam.xaddrs?.[0],
        }));
        resolve(mapped);
      });
    });
    res.json(devices);
  } catch (err) {
    console.error("Error discovering cameras", err);
    res.status(500).json({ error: "Error buscando cámaras en la red" });
  }
});

app.post("/cameras", async (req, res) => {
  try {
    const { name, ip, port, username, password, protocol, recordingEnabled, recordingStartTime, recordingEndTime, recordingFragmentMinutes, retentionDays } = req.body;

    // Construimos la RTSP URL a partir de los datos
    const basePort = 554; // puerto RTSP t?pico
    const userPart =
      username && password
        ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
        : "";
    const rtspUrl =
      protocol === "rtsp" && ip
        ? `rtsp://${userPart}${ip}:${basePort}/`
        : null;

    const camera = await prisma.camera.create({
      data: {
        name,
        ip,
        port: port ? Number(port) : basePort,
        username,
        password,
        protocol: protocol || "rtsp",
        rtspUrl: rtspUrl ?? undefined,
        isOnline: true,
        ...(recordingEnabled !== undefined && { recordingEnabled: Boolean(recordingEnabled) }),
        ...(recordingStartTime !== undefined && { recordingStartTime: recordingStartTime || null }),
        ...(recordingEndTime !== undefined && { recordingEndTime: recordingEndTime || null }),
        ...(recordingFragmentMinutes !== undefined && {
          recordingFragmentMinutes:
            recordingFragmentMinutes == null || recordingFragmentMinutes === ""
              ? null
              : Math.max(1, Math.min(480, Number(recordingFragmentMinutes) || 1)),
        }),
        ...(retentionDays !== undefined && {
          retentionDays:
            retentionDays == null || retentionDays === ""
              ? null
              : Math.max(1, Math.min(365, Number(retentionDays) || 1)),
        }),
      },
    });
    res.status(201).json(camera);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "No se pudo crear la c?mara" });
  }
});

app.get("/cameras/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "ID inv?lido" });
  }
  const camera = await prisma.camera.findUnique({ where: { id } });
  if (!camera) {
    return res.status(404).json({ error: "C?mara no encontrada" });
  }
  res.json(camera);
});

app.get("/cameras/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "ID inv?lido" });
  }
  const camera = await prisma.camera.findUnique({ where: { id } });
  if (!camera) {
    return res.status(404).json({ error: "C?mara no encontrada" });
  }
  const port = camera.port || 554;
  const online = await checkCameraReachable(camera.ip, port, 3000);
  await prisma.camera.update({
    where: { id },
    data: { isOnline: online, lastSeenAt: online ? new Date() : undefined },
  });
  res.json({ online });
});

app.put("/cameras/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "ID inv?lido" });
  }
  try {
    const { name, ip, port, username, password, protocol, recordingEnabled, recordingStartTime, recordingEndTime, recordingFragmentMinutes, retentionDays } = req.body;

    const basePort = 554;
    const userPart =
      username && password
        ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
        : "";
    const rtspUrl =
      protocol === "rtsp" && ip
        ? `rtsp://${userPart}${ip}:${basePort}/`
        : null;

    const camera = await prisma.camera.update({
      where: { id },
      data: {
        name,
        ip,
        port: port ? Number(port) : basePort,
        username,
        password,
        protocol: protocol || "rtsp",
        rtspUrl: rtspUrl ?? undefined,
        ...(recordingEnabled !== undefined && { recordingEnabled: Boolean(recordingEnabled) }),
        ...(recordingStartTime !== undefined && { recordingStartTime: recordingStartTime || null }),
        ...(recordingEndTime !== undefined && { recordingEndTime: recordingEndTime || null }),
        ...(recordingFragmentMinutes !== undefined && {
          recordingFragmentMinutes:
            recordingFragmentMinutes == null || recordingFragmentMinutes === ""
              ? null
              : Math.max(1, Math.min(480, Number(recordingFragmentMinutes) || 1)),
        }),
        ...(retentionDays !== undefined && {
          retentionDays:
            retentionDays == null || retentionDays === ""
              ? null
              : Math.max(1, Math.min(365, Number(retentionDays) || 1)),
        }),
      },
    });
    res.json(camera);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "No se pudo actualizar la c?mara" });
  }
});

app.delete("/cameras/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "ID inv?lido" });
  }
  try {
    await prisma.camera.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: "C?mara no encontrada" });
  }
});

app.patch("/cameras/:id/online", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "ID inv?lido" });
  }
  try {
    const camera = await prisma.camera.update({
      where: { id },
      data: { isOnline: true },
    });
    res.json(camera);
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: "C?mara no encontrada" });
  }
});


// Endpoint para streaming MJPEG desde RTSP
app.get("/cameras/:id/stream", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "ID inv?lido" });
  }

  try {
    const camera = await prisma.camera.findUnique({ where: { id } });
    if (!camera) {
      return res.status(404).json({ error: "C?mara no encontrada" });
    }

    const basePort = 554;
    const userPart =
      camera.username && camera.password
        ? `${encodeURIComponent(camera.username)}:${encodeURIComponent(
            camera.password
          )}@`
        : "";
    const rtspUrl =
      camera.protocol === "rtsp"
        ? `rtsp://${userPart}${camera.ip}:${basePort}/`
        : camera.rtspUrl;

    if (!rtspUrl) {
      return res
        .status(400)
        .json({ error: "Esta c?mara no tiene RTSP URL configurada" });
    }

    // Configurar headers para MJPEG streaming
    res.setHeader(
      "Content-Type",
      "multipart/x-mixed-replace; boundary=ffmpeg"
    );
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const ffmpegCmd = process.env.FFMPEG_PATH || "ffmpeg";

    const ffmpegProcess = spawn(
      ffmpegCmd,
      [
        "-rtsp_transport",
        "tcp",
        "-i",
        rtspUrl,
        "-vf",
        "scale=480:-1",
        "-f",
        "mjpeg",
        "-q:v",
        "8",
        "-r",
        "8",
        "pipe:1",
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    ffmpegProcess.stdout.on("data", (chunk) => {
      try {
        res.write(chunk);
      } catch {
        ffmpegProcess.kill();
      }
    });

    ffmpegProcess.stderr.on("data", (data) => {
      console.error(`FFmpeg error para c?mara ${id}:`, data.toString());
    });

    req.on("close", () => {
      ffmpegProcess.kill();
      res.end();
    });

    ffmpegProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`FFmpeg termin? con c?digo ${code} para c?mara ${id}`);
      }
      res.end();
    });
  } catch (err) {
    console.error("Error streaming camera", err);
    res.status(500).json({ error: "Error al iniciar el stream" });
  }
});

app.get("/cameras/:id/snapshot", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "ID inv?lido" });
  }

  try {
    const camera = await prisma.camera.findUnique({ where: { id } });
    if (!camera) {
      return res.status(404).json({ error: "C?mara no encontrada" });
    }

    const basePort = 554;
    const userPart =
      camera.username && camera.password
        ? `${encodeURIComponent(camera.username)}:${encodeURIComponent(
            camera.password
          )}@`
        : "";
    const rtspUrl =
      camera.protocol === "rtsp"
        ? `rtsp://${userPart}${camera.ip}:${basePort}/`
        : camera.rtspUrl;

    if (!rtspUrl) {
      return res
        .status(400)
        .json({ error: "Esta c?mara no tiene RTSP URL configurada" });
    }

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "no-store");

    const ffmpegCmd = process.env.FFMPEG_PATH || "ffmpeg";

    const proc = spawn(ffmpegCmd, [
      "-rtsp_transport",
      "tcp",
      "-i",
      rtspUrl,
      "-frames:v",
      "1",
      "-vf",
      "scale=480:-1",
      "-f",
      "image2",
      "-q:v",
      "8",
      "pipe:1",
    ]);

    proc.stdout.pipe(res);

    proc.stderr.on("data", (data) => {
      console.error(`FFmpeg snapshot cam ${id}:`, data.toString());
    });

    proc.on("error", (err) => {
      console.error("FFmpeg process error", err);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    req.on("close", () => {
      proc.kill("SIGKILL");
    });
  } catch (err) {
    console.error("Error snapshot camera", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error al obtener snapshot" });
    }
  }
});

// --- Grabaciones ---
app.get("/recordings", async (req, res) => {
  try {
    const cameraId = req.query.cameraId ? Number(req.query.cameraId) : undefined;
    const dateStr = req.query.date as string | undefined; // YYYY-MM-DD
    const startTime = req.query.startTime as string | undefined; // HH:mm
    const endTime = req.query.endTime as string | undefined;   // HH:mm

    const where: Record<string, unknown> = {};

    if (cameraId && !Number.isNaN(cameraId)) where.cameraId = cameraId;

    if (dateStr) {
      const startOfDay = new Date(dateStr + "T00:00:00");
      const endOfDay = new Date(dateStr + "T23:59:59.999");
      if (!isNaN(startOfDay.getTime())) {
        where.startedAt = {
          gte: startOfDay,
          lt: new Date(endOfDay.getTime() + 1),
        };
      }
    }

    const recordings = await prisma.recording.findMany({
      where,
      include: { camera: { select: { id: true, name: true } } },
      orderBy: { startedAt: "desc" },
      take: 100,
    });

    let filtered = recordings;
    if (startTime || endTime) {
      const parseMin = (s: string) => {
        const m = s.match(/^(\d{1,2}):(\d{2})$/);
        return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
      };
      const startMin = startTime ? parseMin(startTime) : 0;
      const endMin = endTime ? parseMin(endTime) : 24 * 60;
      filtered = recordings.filter((r) => {
        const t = r.startedAt;
        const m = t.getHours() * 60 + t.getMinutes();
        if (startMin !== null && m < startMin) return false;
        if (endMin !== null && m >= endMin) return false;
        return true;
      });
    }

    res.json(filtered);
  } catch (err) {
    console.error("Error listing recordings", err);
    res.status(500).json({ error: "Error al listar grabaciones" });
  }
});

app.get("/recordings/:id/stream", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inv?lido" });
  try {
    const r = await prisma.recording.findUnique({ where: { id } });
    if (!r) return res.status(404).json({ error: "Grabaci?n no encontrada" });
    const fullPath = path.isAbsolute(r.filePath) ? r.filePath : path.join(RECORDINGS_BASE, r.filePath);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "Archivo no encontrado" });
    const stat = fs.statSync(fullPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", chunkSize);
      const stream = fs.createReadStream(fullPath, { start, end });
      stream.pipe(res);
    } else {
      res.setHeader("Content-Length", fileSize);
      const stream = fs.createReadStream(fullPath);
      stream.pipe(res);
    }
  } catch (err) {
    console.error("Error streaming recording", err);
    if (!res.headersSent) res.status(500).json({ error: "Error al reproducir" });
  }
});

app.delete("/recordings", async (req, res) => {
  try {
    const { ids } = req.body as { ids?: number[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Se requiere un array 'ids' con al menos un ID" });
    }
    const validIds = ids.filter((id) => typeof id === "number" && !Number.isNaN(id));
    if (validIds.length === 0) {
      return res.status(400).json({ error: "IDs inv?lidos" });
    }
    const recordings = await prisma.recording.findMany({
      where: { id: { in: validIds } },
      select: { id: true, filePath: true, fileName: true, cameraId: true, startedAt: true },
    });
    const baseDirs = [
      RECORDINGS_BASE,
      path.join(process.cwd(), "recordings"),
      path.join(__dirname, "..", "recordings"),
    ];

    for (const r of recordings) {
      const dateStr = r.startedAt.toISOString().slice(0, 10);
      const relPath = path.join(String(r.cameraId), dateStr, r.fileName);
      const candidates: string[] = baseDirs.map((base) => path.join(base, relPath));
      const storedPath = path.normalize(r.filePath);
      if (path.isAbsolute(storedPath)) {
        candidates.unshift(storedPath);
      }
      let fullPath: string | null = null;
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          fullPath = candidate;
          break;
        }
      }
      try {
        if (fullPath) {
          fs.unlinkSync(fullPath);
        }
      } catch (err) {
        console.warn(`[Recordings] No se pudo borrar ${fullPath}:`, err);
      }
      await prisma.recording.delete({ where: { id: r.id } });
    }
    res.json({ deleted: recordings.length });
  } catch (err) {
    console.error("Error deleting recordings", err);
    res.status(500).json({ error: "Error al borrar grabaciones" });
  }
});

app.get("/recordings/:id/download", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "ID inv?lido" });
  try {
    const r = await prisma.recording.findUnique({ where: { id } });
    if (!r) return res.status(404).json({ error: "Grabaci?n no encontrada" });
    const fullPath = path.isAbsolute(r.filePath) ? r.filePath : path.join(RECORDINGS_BASE, r.filePath);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "Archivo no encontrado" });
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${r.fileName}"`);
    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  } catch (err) {
    console.error("Error downloading recording", err);
    if (!res.headersSent) res.status(500).json({ error: "Error al descargar" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend escuchando en puerto ${PORT}`);
  startRecordingService();
});

