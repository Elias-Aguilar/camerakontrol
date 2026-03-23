import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4001";

type Camera = {
  id: number;
  name: string;
  ip: string;
  port: number;
  username?: string | null;
  password?: string | null;
  protocol: string;
  recordingEnabled?: boolean;
  recordingStartTime?: string | null;
  recordingEndTime?: string | null;
  recordingFragmentMinutes?: number | null;
  retentionDays?: number | null;
};

export function EditCameraScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [camera, setCamera] = useState<Camera | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/cameras/${id}`)
      .then((r) => r.json())
      .then(setCamera)
      .catch((e) => console.error("Error loading camera", e));
  }, [id]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!id) return;
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name") as string,
      ip: formData.get("ip") as string,
      port: Number(formData.get("port") || 554),
      username: (formData.get("username") as string) || undefined,
      password: (formData.get("password") as string) || undefined,
      protocol: (formData.get("protocol") as string) || "rtsp",
      recordingEnabled: (formData.get("recordingEnabled") as string) === "on",
      recordingStartTime: (formData.get("recordingStartTime") as string) || undefined,
      recordingEndTime: (formData.get("recordingEndTime") as string) || undefined,
      recordingFragmentMinutes: (() => {
        const v = formData.get("recordingFragmentMinutes");
        if (v === "" || v === null || v === undefined) return null;
        const n = Number(v);
        return isNaN(n) || n < 1 ? 1 : Math.min(480, n);
      })(),
      retentionDays: (() => {
        const v = formData.get("retentionDays");
        if (v === "" || v === null || v === undefined) return null;
        const n = Number(v);
        return isNaN(n) || n < 1 ? null : Math.min(365, n);
      })(),
    };
    await fetch(`${API_BASE}/cameras/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    navigate("/cameras");
  };

  if (!camera) {
    return <div style={{ padding: "2rem" }}>Cargando cámara...</div>;
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
          cursor: "pointer",
        }}
      >
        ← Volver
      </button>
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>Editar cámara</h2>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        <Field label="Nombre de la cámara">
          <input name="name" defaultValue={camera.name} />
        </Field>
        <Field label="IP / Host">
          <input name="ip" defaultValue={camera.ip} />
        </Field>
        <Field label="Puerto">
          <input name="port" defaultValue={String(camera.port)} />
        </Field>
        <Field label="Usuario">
          <input name="username" defaultValue={camera.username ?? ""} />
        </Field>
        <Field label="Clave">
          <input
            name="password"
            type="password"
            defaultValue={camera.password ?? ""}
          />
        </Field>
        <Field label="Protocolo">
          <input name="protocol" defaultValue={camera.protocol} />
        </Field>

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1F2937" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Grabación programada</div>
          <Field label="Activar grabación">
            <input
              type="checkbox"
              name="recordingEnabled"
              defaultChecked={camera.recordingEnabled ?? false}
              style={{ width: "auto", marginRight: 8 }}
            />
          </Field>
          <Field label="Hora inicio (HH:mm)">
            <input
              type="time"
              name="recordingStartTime"
              defaultValue={camera.recordingStartTime ?? "08:00"}
              style={{ width: "100%" }}
            />
          </Field>
          <Field label="Hora fin (HH:mm)">
            <input
              type="time"
              name="recordingEndTime"
              defaultValue={camera.recordingEndTime ?? "18:00"}
              style={{ width: "100%" }}
            />
          </Field>
          <Field label="Fragmento por archivo (minutos)">
            <input
              type="number"
              name="recordingFragmentMinutes"
              min={1}
              max={480}
              placeholder="1 = 1 min por video"
              defaultValue={camera.recordingFragmentMinutes ?? 1}
              style={{ width: "100%" }}
            />
          </Field>
          <p style={{ fontSize: 11, color: "#6B7280", marginTop: -4 }}>
            Duración de cada video. Si no se define o es 1, cada minuto = 1 archivo. Ej: 5 = un video cada 5 min.
          </p>
          <Field label="Retención (días)">
            <input
              type="number"
              name="retentionDays"
              min={1}
              max={365}
              placeholder="Sin límite"
              defaultValue={camera.retentionDays ?? ""}
              style={{ width: "100%" }}
            />
          </Field>
          <p style={{ fontSize: 11, color: "#6B7280", marginTop: -4 }}>
            Días a conservar las grabaciones. Vacío = sin límite.
          </p>
        </div>

        <button
          type="submit"
          style={{
            marginTop: 4,
            height: 40,
            borderRadius: 999,
            border: "none",
            backgroundColor: "#22C55E",
            color: "#022C22",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Guardar cambios
        </button>
      </form>
    </div>
  );
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

function Field({ label, children }: FieldProps) {
  return (
    <label style={{ display: "block", fontSize: 11, color: "#9CA3AF" }}>
      {label}
      <div
        style={{
          marginTop: 4,
          minHeight: 40,
          borderRadius: 10,
          border: "1px solid #1F2937",
          padding: "0 10px",
          display: "flex",
          alignItems: "center",
          backgroundColor: "#020617",
          color: "#F9FAFB",
        }}
      >
        {children}
      </div>
    </label>
  );
}

