import React, { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useNotifications } from "../ui/NotificationsProvider";
import { Time24Select } from "../ui/Time24Select";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4001";

type RecordingWindow = { start: string; end: string };

type Camera = {
  id: number;
  name: string;
  ip: string;
  port: number;
  username?: string | null;
  password?: string | null;
  protocol: string;
  recordingEnabled?: boolean;
  recordingWindows?: RecordingWindow[] | null;
  recordingFragmentMinutes?: number | null;
  retentionDays?: number | null;
};

const DEFAULT_SLOT: RecordingWindow = { start: "08:00", end: "18:00" };

function parseWindowsFromCamera(raw: unknown): RecordingWindow[] {
  if (!raw || !Array.isArray(raw)) return [{ ...DEFAULT_SLOT }];
  const out: RecordingWindow[] = [];
  for (const x of raw.slice(0, 3)) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const start = typeof o.start === "string" ? o.start : "";
    const end = typeof o.end === "string" ? o.end : "";
    if (start && end) out.push({ start, end });
  }
  return out.length > 0 ? out : [{ ...DEFAULT_SLOT }];
}

export function EditCameraScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useNotifications();
  const [camera, setCamera] = useState<Camera | null>(null);
  const [recordingWindows, setRecordingWindows] = useState<RecordingWindow[]>([{ ...DEFAULT_SLOT }]);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/cameras/${id}`)
      .then((r) => r.json())
      .then((c: Camera) => {
        setCamera(c);
        setRecordingWindows(parseWindowsFromCamera(c.recordingWindows));
      })
      .catch((e) => console.error("Error loading camera", e));
  }, [id]);

  const addWindow = () => {
    if (recordingWindows.length >= 3) return;
    setRecordingWindows((w) => [...w, { start: "09:00", end: "10:00" }]);
  };

  const removeWindow = (index: number) => {
    if (recordingWindows.length <= 1) return;
    setRecordingWindows((w) => w.filter((_, i) => i !== index));
  };

  const setWindow = (index: number, field: "start" | "end", value: string) => {
    setRecordingWindows((w) =>
      w.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot))
    );
  };

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
      recordingWindows: recordingWindows
        .filter((s) => s.start && s.end && s.start !== s.end)
        .map((s) => ({ start: s.start, end: s.end }))
        .slice(0, 3),
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
    try {
      const res = await fetch(`${API_BASE}/cameras/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      showToast("Cámara actualizada correctamente.", "success");
      navigate("/cameras");
    } catch (e) {
      console.error(e);
      showToast("No se pudieron guardar los cambios.", "danger");
    }
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

          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 6 }}>
            Horarios de grabación (máx. 3), siempre en formato 24 h. Ej.: 09:00–10:00, 14:00–15:00,
            20:00–00:00 (hasta medianoche).
          </div>

          {recordingWindows.map((slot, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 10,
                paddingBottom: 10,
                borderBottom: index < recordingWindows.length - 1 ? "1px solid #1F2937" : "none",
              }}
            >
              <div style={{ fontSize: 11, color: "#64748B" }}>Franja {index + 1}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <label style={{ flex: 1, fontSize: 12, color: "#9CA3AF" }}>
                  Inicio (24 h)
                  <div
                    style={{
                      marginTop: 4,
                      minHeight: 44,
                      borderRadius: 999,
                      border: "1px solid #1F2937",
                      padding: "6px 10px",
                      display: "flex",
                      alignItems: "center",
                      backgroundColor: "#020617",
                    }}
                  >
                    <Time24Select
                      value={slot.start}
                      onChange={(v) => setWindow(index, "start", v)}
                      showCaption={false}
                      embedded
                    />
                  </div>
                </label>
                <label style={{ flex: 1, fontSize: 12, color: "#9CA3AF" }}>
                  Fin (24 h)
                  <div
                    style={{
                      marginTop: 4,
                      minHeight: 44,
                      borderRadius: 999,
                      border: "1px solid #1F2937",
                      padding: "6px 10px",
                      display: "flex",
                      alignItems: "center",
                      backgroundColor: "#020617",
                    }}
                  >
                    <Time24Select
                      value={slot.end}
                      onChange={(v) => setWindow(index, "end", v)}
                      showCaption={false}
                      embedded
                    />
                  </div>
                </label>
                {recordingWindows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeWindow(index)}
                    style={{
                      height: 44,
                      padding: "0 12px",
                      borderRadius: 999,
                      border: "1px solid #475569",
                      background: "transparent",
                      color: "#94A3B8",
                      fontSize: 12,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          ))}

          {recordingWindows.length < 3 && (
            <button
              type="button"
              onClick={addWindow}
              style={{
                marginBottom: 8,
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid #334155",
                background: "transparent",
                color: "#94A3B8",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              + Añadir otro horario
            </button>
          )}

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
            backgroundColor: "#5CBD80",
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

const inputFillStyle: React.CSSProperties = {
  width: "100%",
  flex: 1,
  minWidth: 0,
  background: "transparent",
  border: "none",
  outline: "none",
  color: "#F9FAFB",
  fontSize: 14,
  padding: 0,
};

function Field({ label, children }: FieldProps) {
  const child = React.Children.only(children);
  const styledChild =
    React.isValidElement(child) && child.type === "input" && child.props.type !== "checkbox"
      ? React.cloneElement(child as React.ReactElement<{ style?: React.CSSProperties }>, {
          style: { ...inputFillStyle, ...(child.props.style ?? {}) },
        })
      : children;

  return (
    <label style={{ display: "block", fontSize: 12, color: "#9CA3AF" }}>
      {label}
      <div
        style={{
          marginTop: 4,
          minHeight: 44,
          borderRadius: 999,
          border: "1px solid #1F2937",
          padding: "0 14px",
          display: "flex",
          alignItems: "center",
          backgroundColor: "#020617",
          color: "#F9FAFB",
        }}
      >
        {styledChild}
      </div>
    </label>
  );
}
