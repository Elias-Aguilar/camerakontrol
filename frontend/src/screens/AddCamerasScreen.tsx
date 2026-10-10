import React, { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useNotifications } from "../ui/NotificationsProvider";
import { CameraTypeSelect } from "../ui/CameraTypeSelect";

type Discovered = {
  id: number;
  name: string;
  hostname?: string;
  port?: number;
  path?: string;
  xaddr?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export function AddCamerasScreen() {
  const [discovering, setDiscovering] = useState(false);
  const [results, setResults] = useState<Discovered[]>([]);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState("rtsp");
  const isHttp = protocol === "http";
  const navigate = useNavigate();
  const { showToast } = useNotifications();

  const handleDiscover = async () => {
    setDiscovering(true);
    setDiscoverError(null);
    try {
      const res = await fetch(`${API_BASE}/cameras/discover`);
      const data = await res.json();
      if (!res.ok) {
        setResults([]);
        setDiscoverError(data?.error || "No se pudo buscar cámaras en la red");
        return;
      }
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error discovering cameras", e);
      setResults([]);
      setDiscoverError("No se pudo buscar cámaras en la red");
    } finally {
      setDiscovering(false);
    }
  };

  useEffect(() => {
    // descubrimiento inicial opcional
    handleDiscover().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [searchParams] = useSearchParams();
  const prefill = {
    name: searchParams.get("name") ?? "",
    ip: searchParams.get("ip") ?? "",
    port: searchParams.get("port") ?? "",
    path: searchParams.get("path") ?? "",
  };
  const formKey = searchParams.toString();

  const prefillForm = (d: Discovered) => {
    const params = new URLSearchParams();
    if (d.name) params.set("name", d.name);
    if (d.hostname) params.set("ip", d.hostname);
    if (d.port) params.set("port", String(d.port));
    if (d.path) params.set("path", d.path);
    navigate(`/cameras/add?${params.toString()}`);
  };

  const handleManualSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Guardamos la referencia al formulario ANTES de cualquier await,
    // porque React recicla el evento y deja currentTarget en null.
    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: formData.get("name") as string,
      ip: formData.get("ip") as string,
      port: Number(formData.get("port") || (isHttp ? 8081 : 554)),
      username: isHttp ? undefined : (formData.get("username") as string) || undefined,
      password: isHttp ? undefined : (formData.get("password") as string) || undefined,
      protocol,
      streamPath: isHttp ? (formData.get("streamPath") as string) || "/" : undefined,
      onvifPath: isHttp ? undefined : prefill.path || undefined,
    };
    try {
      const res = await fetch(`${API_BASE}/cameras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("No se pudo crear la cámara");
      form.reset();
      if (prefill.ip) navigate("/cameras/add", { replace: true });
      showToast("Cámara guardada correctamente.", "success");
    } catch (e) {
      console.error("Error saving camera", e);
      showToast("Error al guardar la cámara.", "danger");
    }
  };

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
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>Agregar cámaras</h2>
      <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>
        Busca en la red o añade una cámara manualmente.
      </p>

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, marginBottom: 8 }}>Buscar en la red</h3>
        <button
          onClick={handleDiscover}
          disabled={discovering}
          style={{
            width: "100%",
            height: 40,
            borderRadius: 999,
            border: "none",
            backgroundColor: "#5CBD80",
            color: "#022C22",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: 12
          }}
        >
          {discovering ? "Buscando..." : "Buscar cámaras en la red"}
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {results.map((d) => (
            <div
              key={d.id}
              style={{
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid #1F2937",
                backgroundColor: "#020617",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                {d.xaddr && (
                  <div style={{ fontSize: 11, color: "#64748B", overflowWrap: "anywhere" }}>{d.xaddr}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => prefillForm(d)}
                style={{
                  height: 32,
                  padding: "0 14px",
                  borderRadius: 999,
                  border: "none",
                  backgroundColor: "#5CBD80",
                  color: "#022C22",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Agregar
              </button>
            </div>
          ))}
          {discoverError && (
            <p style={{ fontSize: 12, color: "#F87171" }}>{discoverError}</p>
          )}
          {!discoverError && results.length === 0 && (
            <p style={{ fontSize: 12, color: "#6B7280" }}>
              Aún no se han detectado cámaras ONVIF.
            </p>
          )}
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: 13, marginBottom: 8 }}>Agregar manualmente</h3>
        <form
          key={formKey}
          onSubmit={handleManualSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          {prefill.ip && (
            <p style={{ fontSize: 12, color: "#5CBD80", margin: 0 }}>
              Cámara detectada en la red. Completa usuario y clave para guardarla.
            </p>
          )}
          <Field label="Nombre de la cámara">
            <input name="name" placeholder="Ej: Cámara Entrada" defaultValue={prefill.name} />
          </Field>
          <Field label="Tipo de cámara">
            <CameraTypeSelect value={protocol} onChange={setProtocol} />
          </Field>
          <Field label="IP / Host">
            <input name="ip" placeholder={isHttp ? "192.168.1.33" : "192.168.1.50"} defaultValue={prefill.ip} />
          </Field>
          <Field label="Puerto">
            <input name="port" placeholder={isHttp ? "8081" : "554"} defaultValue={prefill.port} />
          </Field>
          {isHttp ? (
            <Field label="Ruta del stream">
              <input name="streamPath" placeholder="/" />
            </Field>
          ) : (
            <>
              <Field label="Usuario">
                <input name="username" placeholder="admin" />
              </Field>
              <Field label="Clave">
                <input name="password" type="password" placeholder="••••••••" />
              </Field>
            </>
          )}
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
              cursor: "pointer"
            }}
          >
            Guardar cámara
          </button>
        </form>
      </section>
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
          height: 44,
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

