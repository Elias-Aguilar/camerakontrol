import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type Camera = {
  id: number;
  name: string;
  ip: string;
  port: number;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

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

export function LiveViewScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const cameraId = Number(id);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamKey, setStreamKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  const streamContainerRef = useRef<HTMLDivElement>(null);

  const exitExpanded = useCallback(() => setExpanded(false), []);

  useEffect(() => {
    if (Number.isNaN(cameraId)) {
      setError("Cámara no válida");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/cameras/${cameraId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Cámara no encontrada");
        return r.json();
      })
      .then((data: Camera) => {
        setCamera(data);
        setStreamKey((k) => k + 1);
      })
      .catch(() => setError("No se pudo cargar la cámara"))
      .finally(() => setLoading(false));
  }, [cameraId]);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!expanded) return;

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
  }, [expanded, exitExpanded]);

  const streamUrl =
    camera && !error
      ? `${API_BASE}/cameras/${camera.id}/stream?k=${streamKey}`
      : null;

  const streamPlayer = streamUrl ? (
    <div
      ref={streamContainerRef}
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
        key={streamKey}
        src={streamUrl}
        alt={camera?.name ?? "Vista en vivo"}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
          cursor: expanded ? "default" : "pointer",
        }}
        onClick={() => {
          if (!expanded) setExpanded(true);
        }}
        onError={() => setError("No se pudo iniciar la transmisión en vivo")}
      />
      <button
        type="button"
        title={expanded ? "Salir de pantalla completa" : "Expandir"}
        aria-label={expanded ? "Salir de pantalla completa" : "Expandir"}
        onClick={(e) => {
          e.stopPropagation();
          if (expanded) exitExpanded();
          else setExpanded(true);
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
    </div>
  ) : null;

  if (expanded && streamUrl) {
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
              {camera?.name ?? "Vista en vivo"}
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
        {streamPlayer}
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: isDesktop ? 1280 : "100%",
        margin: "0 auto",
        padding: isDesktop ? "2rem 1.5rem" : "1rem",
      }}
    >
      <button
        type="button"
        onClick={() => navigate("/cameras")}
        style={{
          marginBottom: 8,
          fontSize: 12,
          color: "#9CA3AF",
          background: "none",
          border: "none",
          cursor: "pointer",
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
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>Vista en vivo</h2>
          <p style={{ fontSize: 12, color: "#9CA3AF" }}>
            {camera ? camera.name : "Cargando…"}
          </p>
        </div>
        {streamUrl && (
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

      {error && (
        <p style={{ fontSize: 13, color: "#F87171" }}>{error}</p>
      )}

      {streamPlayer}

      {streamUrl && (
        <p style={{ marginTop: 12, fontSize: 11, color: "#64748B" }}>
          Toca la imagen o el botón de expandir para ver en pantalla completa.
        </p>
      )}
    </div>
  );
}
