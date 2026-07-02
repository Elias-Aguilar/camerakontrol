import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

type Camera = {
  id: number;
  name: string;
  ip: string;
  port: number;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

const BLANK_IMG_SRC =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function abortMjpegStream(img: HTMLImageElement | null) {
  if (!img) return;
  img.onload = null;
  img.onerror = null;
  img.src = BLANK_IMG_SRC;
  img.removeAttribute("src");
}

function IconExpand() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCollapse() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 9L4 4M15 9l5-5M9 15l-5 5M15 15l5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CameraStreamTile({
  camera,
  streamKey,
  expanded,
  onExpand,
  onCollapse,
  onStreamError,
  showExpand = true,
  onRegisterAbort,
}: {
  camera: Camera;
  streamKey: number;
  expanded?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
  onStreamError?: () => void;
  showExpand?: boolean;
  onRegisterAbort?: (abort: () => void) => () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const streamUrl = `${API_BASE}/cameras/${camera.id}/stream?k=${streamKey}`;

  useEffect(() => {
    const abort = () => abortMjpegStream(imgRef.current);
    const unregister = onRegisterAbort?.(abort);
    return () => {
      abort();
      unregister?.();
    };
  }, [streamUrl, onRegisterAbort]);

  return (
    <div
      style={{
        position: "relative",
        borderRadius: expanded ? 0 : 16,
        overflow: "hidden",
        border: expanded ? "none" : "1px solid #1F2937",
        backgroundColor: "#020617",
        aspectRatio: expanded ? undefined : "16 / 9",
        width: "100%",
        height: expanded ? "100%" : undefined,
        flex: expanded ? 1 : undefined,
        minHeight: 0,
      }}
    >
      <img
        ref={imgRef}
        src={streamUrl}
        alt={camera.name}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
          cursor: expanded || !showExpand ? "default" : "pointer",
        }}
        onClick={() => {
          if (!expanded && showExpand && onExpand) onExpand();
        }}
        onError={() => onStreamError?.()}
      />
      {!expanded && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            padding: "4px 8px",
            borderRadius: 6,
            background: "rgba(2, 6, 23, 0.75)",
            fontSize: 11,
            fontWeight: 600,
            color: "#F9FAFB",
          }}
        >
          {camera.name}
        </div>
      )}
      {showExpand && (
        <button
          type="button"
          title={expanded ? "Salir de pantalla completa" : "Expandir"}
          aria-label={expanded ? "Salir de pantalla completa" : "Expandir"}
          onClick={(e) => {
            e.stopPropagation();
            if (expanded && onCollapse) onCollapse();
            else if (onExpand) onExpand();
          }}
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 8,
            border: "1px solid #374151",
            background: "rgba(2, 6, 23, 0.75)",
            color: "#E5E7EB",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {expanded ? <IconCollapse /> : <IconExpand />}
        </button>
      )}
    </div>
  );
}

export function LiveViewScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isMultiRoute = !id;
  const multiIds = isMultiRoute
    ? (searchParams.get("ids") ?? "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n) && n > 0)
    : [];
  const singleCameraId = id ? Number(id) : null;

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamKey, setStreamKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  const streamContainerRef = useRef<HTMLDivElement>(null);
  const streamAbortFns = useRef(new Set<() => void>());

  const registerStreamAbort = useCallback((abort: () => void) => {
    streamAbortFns.current.add(abort);
    return () => {
      streamAbortFns.current.delete(abort);
    };
  }, []);

  const abortAllStreams = useCallback(() => {
    for (const abort of streamAbortFns.current) {
      abort();
    }
    streamAbortFns.current.clear();
  }, []);

  const exitExpanded = useCallback(() => setExpanded(false), []);
  const cameraCount = cameras.length;
  const isSingleView = cameraCount === 1;

  useEffect(() => {
    if (isMultiRoute) {
      if (multiIds.length === 0) {
        setError("No se seleccionaron cámaras");
        setLoading(false);
        return;
      }
      if (multiIds.length > 4) {
        setError("Máximo 4 cámaras en vista en vivo");
        setLoading(false);
        return;
      }
    } else if (singleCameraId === null || Number.isNaN(singleCameraId)) {
      setError("Cámara no válida");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const idsToLoad = isMultiRoute ? multiIds : [singleCameraId!];

    Promise.all(
      idsToLoad.map((camId) =>
        fetch(`${API_BASE}/cameras/${camId}`).then((r) => {
          if (!r.ok) throw new Error(`Cámara ${camId} no encontrada`);
          return r.json() as Promise<Camera>;
        })
      )
    )
      .then((loaded) => {
        const sorted = [...loaded].sort((a, b) =>
          a.name.localeCompare(b.name, "es", { sensitivity: "base" })
        );
        setCameras(sorted);
        setStreamKey((k) => k + 1);
      })
      .catch(() => setError("No se pudieron cargar las cámaras"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, searchParams.toString()]);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!expanded || !isSingleView) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitExpanded();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded, exitExpanded, isSingleView]);

  useEffect(() => {
    return () => {
      abortAllStreams();
    };
  }, [abortAllStreams]);

  const handleBack = useCallback(() => {
    abortAllStreams();
    navigate("/cameras");
  }, [abortAllStreams, navigate]);

  const handleStreamError = () => {
    setError("No se pudo iniciar la transmisión en vivo");
  };

  const renderStreamLayout = () => {
    if (cameras.length === 0) return null;

    if (cameraCount === 1) {
      return (
        <div ref={streamContainerRef}>
          <CameraStreamTile
            camera={cameras[0]}
            streamKey={streamKey}
            expanded={expanded}
            onExpand={() => setExpanded(true)}
            onCollapse={exitExpanded}
            onStreamError={handleStreamError}
            onRegisterAbort={registerStreamAbort}
          />
        </div>
      );
    }

    if (cameraCount === 2) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: "100%",
          }}
        >
          {cameras.map((cam) => (
            <CameraStreamTile
              key={cam.id}
              camera={cam}
              streamKey={streamKey}
              onStreamError={handleStreamError}
              showExpand={false}
              onRegisterAbort={registerStreamAbort}
            />
          ))}
        </div>
      );
    }

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 8,
          width: "100%",
          aspectRatio: isDesktop ? "16 / 9" : undefined,
          minHeight: isDesktop ? undefined : 280,
        }}
      >
        {cameras.map((cam) => (
          <CameraStreamTile
            key={cam.id}
            camera={cam}
            streamKey={streamKey}
            onStreamError={handleStreamError}
            showExpand={false}
            onRegisterAbort={registerStreamAbort}
          />
        ))}
      </div>
    );
  };

  const subtitle =
    cameraCount === 1
      ? cameras[0]?.name ?? "Cargando…"
      : `${cameraCount} cámaras seleccionadas`;

  if (expanded && isSingleView && cameras.length === 1) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#000",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 16px",
            borderBottom: "1px solid #1F2937",
            backgroundColor: "#020617",
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#F9FAFB" }}>
              {cameras[0].name}
            </p>
            <p style={{ fontSize: 11, margin: "2px 0 0", color: "#5CBD80" }}>En vivo</p>
          </div>
          <button
            type="button"
            onClick={exitExpanded}
            style={{
              fontSize: 12,
              color: "#E5E7EB",
              background: "#1F2937",
              border: "1px solid #374151",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Salir
          </button>
        </div>
        <CameraStreamTile
          camera={cameras[0]}
          streamKey={streamKey}
          expanded
          onCollapse={exitExpanded}
          onStreamError={handleStreamError}
          onRegisterAbort={registerStreamAbort}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: isDesktop ? 1280 : "100%",
        margin: "0 auto",
        padding: isDesktop ? "2rem 1.5rem" : "1rem",
        height: cameraCount >= 3 && isDesktop ? "calc(100vh - 4rem)" : undefined,
        display: cameraCount >= 3 && isDesktop ? "flex" : undefined,
        flexDirection: cameraCount >= 3 && isDesktop ? "column" : undefined,
      }}
    >
      <button
        type="button"
        onClick={handleBack}
        style={{
          marginBottom: 8,
          fontSize: 12,
          color: "#9CA3AF",
          background: "none",
          border: "none",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        ← Volver
      </button>

      <header
        style={{
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>Vista en vivo</h2>
          <p style={{ fontSize: 12, color: "#9CA3AF" }}>{subtitle}</p>
        </div>
        {cameras.length > 0 && !error && (
          <div
            style={{
              borderRadius: 999,
              border: "1px solid #5CBD80",
              padding: "4px 10px",
              fontSize: 12,
              color: "#5CBD80",
            }}
          >
            En vivo
          </div>
        )}
      </header>

      {loading && (
        <p style={{ fontSize: 13, color: "#9CA3AF" }}>Conectando con la cámara…</p>
      )}

      {error && <p style={{ fontSize: 13, color: "#F87171" }}>{error}</p>}

      {!loading && !error && (
        <div
          style={{
            flex: cameraCount >= 3 ? 1 : undefined,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {renderStreamLayout()}
        </div>
      )}

      {isSingleView && cameras.length > 0 && !error && (
        <p style={{ marginTop: 12, fontSize: 11, color: "#64748B", flexShrink: 0 }}>
          Toca la imagen o el botón de expandir para ver en pantalla completa.
        </p>
      )}

      {cameraCount >= 2 && cameras.length > 0 && !error && (
        <p style={{ marginTop: 12, fontSize: 11, color: "#64748B", flexShrink: 0 }}>
          Transmitiendo en tiempo real desde cámaras conectadas.
        </p>
      )}
    </div>
  );
}
