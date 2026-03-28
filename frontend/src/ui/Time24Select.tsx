import type { CSSProperties } from "react";

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

function parseHHmm(value: string): [string, string] {
  const m = value?.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return ["08", "00"];
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10))).toString().padStart(2, "0");
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10))).toString().padStart(2, "0");
  return [h, min];
}

const selectStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: 44,
  borderRadius: 999,
  border: "1px solid #1F2937",
  backgroundColor: "#020617",
  color: "#F9FAFB",
  fontSize: 14,
  padding: "0 10px",
  cursor: "pointer",
};

type Props = {
  value: string;
  onChange: (hhmm: string) => void;
  /** Si false, solo muestra selectores HH : MM (el padre pone la etiqueta). */
  showCaption?: boolean;
  /** Sin borde propio (dentro de un contenedor ya enmarcado). */
  embedded?: boolean;
};

/** Selector siempre en formato 24 h (evita AM/PM del navegador). */
export function Time24Select({ value, onChange, showCaption = true, embedded = false }: Props) {
  const [h, min] = parseHHmm(value);
  const sel = embedded
    ? { ...selectStyle, border: "none", backgroundColor: "transparent", height: 36 }
    : selectStyle;

  const row = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
      <select
        aria-label="Hora (0–23)"
        value={h}
        onChange={(e) => onChange(`${e.target.value}:${min}`)}
        style={sel}
      >
        {HOURS.map((hh) => (
          <option key={hh} value={hh}>
            {hh}
          </option>
        ))}
      </select>
      <span style={{ color: "#94A3B8", fontWeight: 600, userSelect: "none" }}>:</span>
      <select
        aria-label="Minutos (0–59)"
        value={min}
        onChange={(e) => onChange(`${h}:${e.target.value}`)}
        style={sel}
      >
        {MINUTES.map((mm) => (
          <option key={mm} value={mm}>
            {mm}
          </option>
        ))}
      </select>
    </div>
  );

  if (!showCaption) return row;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
      <span style={{ fontSize: 10, color: "#64748B" }}>Formato 24 horas</span>
      {row}
    </div>
  );
}
