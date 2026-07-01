import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type Camera = {
  id: number;
  name: string;
  ip: string;
  port: number;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export function LiveViewScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const cameraId = Number(id);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamKey, setStreamKey] = useState(0);

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

  const streamUrl =
    camera && !error
      ? `${API_BASE}/cameras/${camera.id}/stream?k=${streamKey}`
      : null;

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "2rem 1.5rem" }}>
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

      {streamUrl && (
        <div
          style={{
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid #1F2937",
            backgroundColor: "#020617",
            aspectRatio: "16 / 9",
          }}
        >
          <img
            key={streamKey}
            src={streamUrl}
            alt={camera?.name ?? "Vista en vivo"}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            onError={() => setError("No se pudo iniciar la transmisión en vivo")}
          />
        </div>
      )}

      {streamUrl && (
        <p style={{ marginTop: 12, fontSize: 11, color: "#64748B" }}>
          La transmisión no se guarda. Al salir de esta pantalla se detiene automáticamente.
        </p>
      )}
    </div>
  );
}
