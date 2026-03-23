import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Camera = {
  id: number;
  name: string;
  ip: string;
  port: number;
  isOnline: boolean;
  isSelected: boolean;
  rtspUrl?: string | null;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export function LiveViewScreen() {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [tick, setTick] = useState(0);

  // Cargar cámaras
  useEffect(() => {
    fetch(`${API_BASE}/cameras`)
      .then((r) => r.json())
      .then((data: Camera[]) => {
        const selected = data.filter((c) => c.isSelected);
        const online = data.filter((c) => c.isOnline);
        const toShow =
          selected.length > 0 ? selected.slice(0, 4) : online.slice(0, 4);
        setCameras(toShow);
      })
      .catch((e) => console.error("Error loading cameras", e));
  }, []);

  // Refrescar snapshot periódicamente (pseudo-video)
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000); // 1 fps aprox., menos carga
    return () => clearInterval(id);
  }, []);

  const selectedCount = cameras.filter((c) => c.isSelected).length;
  const effectiveCount = selectedCount > 0 ? selectedCount : cameras.length;

  let gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
  let gridTemplateRows = "repeat(2, minmax(0, 1fr))";

  if (effectiveCount === 1) {
    gridTemplateColumns = "1fr";
    gridTemplateRows = "1fr";
  } else if (effectiveCount === 2) {
    gridTemplateColumns = "1fr";
    gridTemplateRows = "repeat(2, minmax(0, 1fr))";
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          marginBottom: 8,
          fontSize: 12,
          color: "#9CA3AF",
          background: "none",
          border: "none",
          cursor: "pointer"
        }}
      >
        ← Volver
      </button>
      <header
        style={{
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>Vista en vivo</h2>
          <p style={{ fontSize: 12, color: "#9CA3AF" }}>
            {cameras.length} cámaras
          </p>
        </div>
        <div
          style={{
            borderRadius: 999,
            border: "1px solid #5CBD80",
            padding: "4px 10px",
            fontSize: 12,
            color: "#5CBD80"
          }}
        >
          2 x 2
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns,
          gridTemplateRows,
          gap: 8,
          aspectRatio: "3 / 4"
        }}
      >
        {cameras.map((cam) => {
          const snapshotUrl =
            cam.isOnline && cam.rtspUrl
              ? `${API_BASE}/cameras/${cam.id}/snapshot?ts=${tick}`
              : null;

          return (
            <div
              key={cam.id}
              style={{
                borderRadius: 16,
                overflow: "hidden",
                border: "1px solid #1F2937",
                backgroundColor: "#020617",
              }}
            >
              {snapshotUrl && (
                <img
                  src={snapshotUrl}
                  alt={cam.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}