import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Camera = {
  id: number;
  name: string;
  ip: string;
  port: number;
  isOnline: boolean;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4001";

export function CameraListScreen() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [statusMap, setStatusMap] = useState<Record<number, boolean | "loading">>({});
  const navigate = useNavigate();

  useEffect(() => {
    loadCameras();
  }, []);

  useEffect(() => {
    if (cameras.length === 0) return;
    setStatusMap((prev) => {
      const next = { ...prev };
      cameras.forEach((c) => {
        next[c.id] = "loading";
      });
      return next;
    });
    const ids = cameras.map((c) => c.id);
    Promise.all(
      cameras.map((cam) =>
        fetch(`${API_BASE}/cameras/${cam.id}/status`)
          .then((r) => r.json())
          .then((data: { online: boolean }) => data.online)
          .catch(() => false)
      )
    ).then((results) => {
      setStatusMap((prev) => {
        const next = { ...prev };
        ids.forEach((id, i) => {
          next[id] = results[i];
        });
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameras]);

  const loadCameras = () => {
    fetch(`${API_BASE}/cameras`)
      .then((r) => r.json())
      .then(setCameras)
      .catch((e) => console.error("Error loading cameras", e));
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta cámara definitivamente?")) return;
    try {
      await fetch(`${API_BASE}/cameras/${id}`, { method: "DELETE" });
      setCameras((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error("Error deleting camera", e);
      alert("No se pudo eliminar la cámara");
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <header style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 24, marginBottom: 4 }}>Tus cámaras</h2>
        <p style={{ color: "#9CA3AF", fontSize: 13 }}>
          Gestiona tus cámaras y configura la grabación
        </p>
      </header>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => navigate("/cameras/add")}
          style={{
            flex: 1,
            height: 40,
            borderRadius: 999,
            border: "none",
            backgroundColor: "#22C55E",
            color: "#022C22",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Agregar cámara
        </button>
        <button
          onClick={() => navigate("/recordings")}
          style={{
            flex: 1,
            height: 40,
            borderRadius: 999,
            border: "1px solid #22C55E",
            backgroundColor: "transparent",
            color: "#22C55E",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Ver grabaciones
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {cameras.map((cam) => (
          <div
            key={cam.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderRadius: 16,
              border: "1px solid #1F2937",
              backgroundColor: "#020617"
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{cam.name}</div>
              <div style={{ fontSize: 12, color: "#64748B" }}>
                {cam.ip}:{cam.port}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  color:
                    statusMap[cam.id] === "loading" || statusMap[cam.id] === undefined
                      ? "#9CA3AF"
                      : statusMap[cam.id]
                        ? "#22C55E"
                        : "#EF4444",
                }}
              >
                {statusMap[cam.id] === "loading" || statusMap[cam.id] === undefined
                  ? "Comprobando…"
                  : statusMap[cam.id]
                    ? "Conectada"
                    : "Sin conexión"}
              </span>
              <button
                onClick={() => navigate(`/cameras/${cam.id}/edit`)}
                style={{
                  marginLeft: 8,
                  borderRadius: 999,
                  border: "1px solid #4B5563",
                  background: "transparent",
                  color: "#E5E7EB",
                  fontSize: 11,
                  padding: "4px 8px",
                  cursor: "pointer"
                }}
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(cam.id)}
                style={{
                  marginLeft: 8,
                  borderRadius: 999,
                  border: "1px solid #4B5563",
                  background: "transparent",
                  color: "#F97373",
                  fontSize: 11,
                  padding: "4px 8px",
                  cursor: "pointer"
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {cameras.length === 0 && (
          <p style={{ color: "#6B7280", fontSize: 13 }}>
            Aún no tienes cámaras registradas.
          </p>
        )}
      </div>
    </div>
  );
}

