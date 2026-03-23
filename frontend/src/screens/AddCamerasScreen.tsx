import React, { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Discovered = {
  id: number;
  name: string;
  xaddr?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export function AddCamerasScreen() {
  const [discovering, setDiscovering] = useState(false);
  const [results, setResults] = useState<Discovered[]>([]);
  const navigate = useNavigate();

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const res = await fetch(`${API_BASE}/cameras/discover`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error discovering cameras", e);
      setResults([]);
    } finally {
      setDiscovering(false);
    }
  };

  useEffect(() => {
    // descubrimiento inicial opcional
    handleDiscover().catch(() => undefined);
  }, []);

  const handleManualSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Guardamos la referencia al formulario ANTES de cualquier await,
    // porque React recicla el evento y deja currentTarget en null.
    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: formData.get("name") as string,
      ip: formData.get("ip") as string,
      port: Number(formData.get("port") || 554),
      username: (formData.get("username") as string) || undefined,
      password: (formData.get("password") as string) || undefined,
      protocol: (formData.get("protocol") as string) || "rtsp",
    };
    try {
      await fetch(`${API_BASE}/cameras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      form.reset();
      alert("Cámara guardada");
    } catch (e) {
      console.error("Error saving camera", e);
      alert("Error al guardar la cámara");
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
                backgroundColor: "#020617"
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
              {d.xaddr && (
                <div style={{ fontSize: 11, color: "#64748B" }}>{d.xaddr}</div>
              )}
            </div>
          ))}
          {results.length === 0 && (
            <p style={{ fontSize: 12, color: "#6B7280" }}>
              Aún no se han detectado cámaras ONVIF.
            </p>
          )}
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: 13, marginBottom: 8 }}>Agregar manualmente</h3>
        <form
          onSubmit={handleManualSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <Field label="Nombre de la cámara">
            <input name="name" placeholder="Ej: Cámara Entrada" />
          </Field>
          <Field label="IP / Host">
            <input name="ip" placeholder="192.168.1.50" />
          </Field>
          <Field label="Puerto">
            <input name="port" placeholder="554" />
          </Field>
          <Field label="Usuario">
            <input name="username" placeholder="admin" />
          </Field>
          <Field label="Clave">
            <input name="password" type="password" placeholder="••••••••" />
          </Field>
          <Field label="Protocolo">
            <input name="protocol" defaultValue="rtsp" />
          </Field>
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

