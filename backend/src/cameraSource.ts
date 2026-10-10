export const CAMERA_PROTOCOLS = ["rtsp", "http"] as const;
export type CameraProtocol = (typeof CAMERA_PROTOCOLS)[number];

export const DEFAULT_RTSP_PORT = 554;
export const DEFAULT_HTTP_PORT = 8081;

export type CameraSourceFields = {
  ip: string;
  port: number | null;
  username: string | null;
  password: string | null;
  protocol: string;
  rtspUrl: string | null;
  streamPath?: string | null;
  /** Ruta ONVIF del XAddr, usada por cámaras RTSP descubiertas en la red. */
  onvifPath?: string | null;
};

export function isHttpCamera(camera: { protocol: string }): boolean {
  return camera.protocol === "http";
}

export function normalizeStreamPath(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

/** URL de origen de la cámara: rtsp://user:pass@ip:port/ o http://ip:port/ruta. */
export function buildSourceUrl(camera: CameraSourceFields): string | null {
  if (!camera.ip) return camera.rtspUrl;
  if (camera.protocol === "http") {
    const port = camera.port || DEFAULT_HTTP_PORT;
    return `http://${camera.ip}:${port}${normalizeStreamPath(camera.streamPath)}`;
  }
  if (camera.protocol === "rtsp") {
    const port = camera.port || DEFAULT_RTSP_PORT;
    const userPart =
      camera.username && camera.password
        ? `${encodeURIComponent(camera.username)}:${encodeURIComponent(camera.password)}@`
        : "";
    const pathPart = camera.onvifPath && camera.onvifPath !== "/" ? camera.onvifPath : "/";
    return `rtsp://${userPart}${camera.ip}:${port}${pathPart}`;
  }
  return camera.rtspUrl;
}

/** Argumentos de entrada de FFmpeg previos a `-i` según el protocolo. */
export function transportArgs(camera: { protocol: string }): string[] {
  return isHttpCamera(camera) ? ["-f", "mpjpeg"] : ["-rtsp_transport", "tcp"];
}
