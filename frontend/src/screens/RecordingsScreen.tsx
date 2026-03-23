import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Recording = {
  id: number;
  cameraId: number;
  fileName: string;
  startedAt: string;
  endedAt: string;
  durationSecs: number;
  fileSizeBytes: number | null;
  camera: { id: number; name: string };
};

type Camera = {
  id: number;
  name: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4001";

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecordingsScreen() {
  const navigate = useNavigate();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [dateFilter, setDateFilter] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [cameraFilter, setCameraFilter] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const loadRecordings = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFilter) params.set("date", dateFilter);
    if (cameraFilter !== "") params.set("cameraId", String(cameraFilter));
    fetch(`${API_BASE}/recordings?${params}`)
      .then((r) => r.json())
      .then((data: Recording[]) => setRecordings(data))
      .catch((e) => console.error("Error loading recordings", e))
      .finally(() => setLoading(false));
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === recordings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recordings.map((r) => r.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const msg =
      selectedIds.size === 1
        ? "¿Eliminar esta grabación? Se borrará el archivo y el registro."
        : `¿Eliminar ${selectedIds.size} grabaciones? Se borrarán los archivos y los registros.`;
    if (!confirm(msg)) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/recordings`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al borrar");
      }
      setSelectedIds(new Set());
      loadRecordings();
    } catch (e) {
      console.error(e);
      alert(typeof e === "object" && e && "message" in e ? (e as Error).message : "No se pudieron borrar las grabaciones");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetch(`${API_BASE}/cameras`)
      .then((r) => r.json())
      .then(setCameras)
      .catch((e) => console.error("Error loading cameras", e));
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
    loadRecordings();
  }, [dateFilter, cameraFilter]);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <button
        type="button"
        onClick={() => navigate(-1)}
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
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>Grabaciones</h2>
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>
            Busca y reproduce videos grabados por cámara y fecha
          </p>
        </div>
        {recordings.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "#9CA3AF",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.size === recordings.length && recordings.length > 0}
                onChange={toggleSelectAll}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              Todas
            </label>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0 || deleting}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid #EF4444",
                backgroundColor: selectedIds.size > 0 ? "#EF4444" : "transparent",
                color: selectedIds.size > 0 ? "#FFF" : "#EF4444",
                fontSize: 12,
                fontWeight: 600,
                cursor: selectedIds.size > 0 && !deleting ? "pointer" : "not-allowed",
                opacity: selectedIds.size === 0 || deleting ? 0.6 : 1,
              }}
            >
              {deleting ? "Borrando…" : `Borrar (${selectedIds.size})`}
            </button>
          </div>
        )}
      </header>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>Fecha</span>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{
              height: 38,
              borderRadius: 10,
              border: "1px solid #1F2937",
              backgroundColor: "#020617",
              color: "#F9FAFB",
              padding: "0 10px",
              fontSize: 13,
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>Cámara</span>
          <select
            value={cameraFilter}
            onChange={(e) =>
              setCameraFilter(e.target.value === "" ? "" : Number(e.target.value))
            }
            style={{
              height: 38,
              minWidth: 140,
              borderRadius: 10,
              border: "1px solid #1F2937",
              backgroundColor: "#020617",
              color: "#F9FAFB",
              padding: "0 10px",
              fontSize: 13,
            }}
          >
            <option value="">Todas</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p style={{ color: "#9CA3AF", fontSize: 13 }}>Cargando grabaciones...</p>
      ) : recordings.length === 0 ? (
        <p style={{ color: "#6B7280", fontSize: 13 }}>
          No hay grabaciones para los filtros seleccionados.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {recordings.map((r) => (
            <div
              key={r.id}
              style={{
                borderRadius: 16,
                border: "1px solid #1F2937",
                backgroundColor: "#020617",
                overflow: "hidden",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <label
                style={{
                  flexShrink: 0,
                  padding: 16,
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(r.id)}
                  onChange={() => toggleSelect(r.id)}
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
              </label>
              <div style={{ flex: 1, minWidth: 0 }}>
              <video
                controls
                style={{ width: "100%", maxHeight: 240, backgroundColor: "#000" }}
                src={`${API_BASE}/recordings/${r.id}/stream`}
                preload="metadata"
              />
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  {r.camera.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#9CA3AF",
                    marginBottom: 6,
                  }}
                >
                  {formatDateTime(r.startedAt)} – {formatDateTime(r.endedAt)} (
                  {formatDuration(r.durationSecs)})
                </div>
                <a
                  href={`${API_BASE}/recordings/${r.id}/download`}
                  download
                  style={{
                    fontSize: 12,
                    color: "#22C55E",
                    textDecoration: "none",
                  }}
                >
                  Descargar
                </a>
              </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
