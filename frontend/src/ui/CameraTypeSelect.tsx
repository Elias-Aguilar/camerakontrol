import type { CSSProperties } from "react";

const selectStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: 36,
  border: "none",
  outline: "none",
  backgroundColor: "transparent",
  color: "#F9FAFB",
  fontSize: 14,
  cursor: "pointer",
};

const optionStyle: CSSProperties = { backgroundColor: "#020617" };

type Props = {
  value: string;
  onChange: (protocol: string) => void;
};

export function CameraTypeSelect({ value, onChange }: Props) {
  return (
    <select name="protocol" value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
      <option value="rtsp" style={optionStyle}>
        Cámara IP (RTSP)
      </option>
      <option value="http" style={optionStyle}>
        Webcam (HTTP / MJPEG, solo vista en vivo)
      </option>
    </select>
  );
}
