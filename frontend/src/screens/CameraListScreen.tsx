import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../ui/NotificationsProvider";

type Camera = {
  id: number;
  name: string;
  ip: string;
  port: number;
  isOnline: boolean;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4001";

function IconActionButton({
  title,
  onClick,
  color,
  borderColor,
  children,
}: {
  title: string;
  onClick: () => void;
  color: string;
  borderColor?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 8,
        border: `1px solid ${borderColor ?? "#374151"}`,
        background: "transparent",
        color,
        cursor: "pointer",
        flexShrink: 0,
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function IconLive() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CameraListScreen() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [statusMap, setStatusMap] = useState<Record<number, boolean | "loading">>({});
  const navigate = useNavigate();
  const { showToast, confirm } = useNotifications();

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
    const ok = await confirm({
      title: "Eliminar cámara",
      body: "¿Eliminar esta cámara definitivamente? Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      confirmVariant: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`${API_BASE}/cameras/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error del servidor");
      setCameras((prev) => prev.filter((c) => c.id !== id));
      showToast("Cámara eliminada.", "success");
    } catch (e) {
      console.error("Error deleting camera", e);
      showToast("No se pudo eliminar la cámara.", "danger");
    }
  };

  const statusLabel = (id: number) => {
    if (statusMap[id] === "loading" || statusMap[id] === undefined) return "Comprobando…";
    return statusMap[id] ? "Conectada" : "Sin conexión";
  };

  const statusColor = (id: number) => {
    if (statusMap[id] === "loading" || statusMap[id] === undefined) return "#9CA3AF";
    return statusMap[id] ? "#5CBD80" : "#EF4444";
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
            backgroundColor: "#5CBD80",
            color: "#022C22",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
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
            border: "1px solid #5CBD80",
            backgroundColor: "transparent",
            color: "#5CBD80",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
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
              padding: "12px 14px",
              borderRadius: 16,
              border: "1px solid #1F2937",
              backgroundColor: "#020617",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{cam.name}</div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                  {cam.ip}:{cam.port}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: statusColor(cam.id),
                    marginTop: 6,
                  }}
                  title={statusLabel(cam.id)}
                >
                  {statusLabel(cam.id)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <IconActionButton
                  title="Ver en vivo"
                  color="#5CBD80"
                  borderColor="#5CBD80"
                  onClick={() => navigate(`/cameras/${cam.id}/live`)}
                >
                  <IconLive />
                </IconActionButton>
                <IconActionButton
                  title="Editar"
                  color="#E5E7EB"
                  onClick={() => navigate(`/cameras/${cam.id}/edit`)}
                >
                  <IconEdit />
                </IconActionButton>
                <IconActionButton
                  title="Eliminar"
                  color="#F97373"
                  borderColor="#7F1D1D"
                  onClick={() => handleDelete(cam.id)}
                >
                  <IconTrash />
                </IconActionButton>
              </div>
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
