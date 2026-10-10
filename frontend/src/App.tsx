import { Routes, Route, Navigate } from "react-router-dom";
import { CameraListScreen } from "./screens/CameraListScreen";
import { RecordingsScreen } from "./screens/RecordingsScreen";
import { AddCamerasScreen } from "./screens/AddCamerasScreen";
import { EditCameraScreen } from "./screens/EditCameraScreen";
import { LiveViewScreen } from "./screens/LiveViewScreen";

export function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#082610",
        color: "#F9FAFB",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <main style={{ flex: 1 }}>
      <Routes>
        <Route path="/cameras" element={<CameraListScreen />} />
        <Route path="/recordings" element={<RecordingsScreen />} />
        <Route path="/cameras/add" element={<AddCamerasScreen />} />
        <Route path="/cameras/live" element={<LiveViewScreen />} />
        <Route path="/cameras/:id/live" element={<LiveViewScreen />} />
        <Route path="/cameras/:id/edit" element={<EditCameraScreen />} />
        <Route path="*" element={<Navigate to="/cameras" replace />} />
      </Routes>
      </main>
      <footer
        style={{
          padding: "12px 16px",
          textAlign: "center",
          fontSize: 11,
          color: "#6B7280",
          borderTop: "1px solid #1F2937",
        }}
      >
        © 2026 Aguilar Global Tech - Elias Aguilar - Todos los derechos reservados.
      </footer>
    </div>
  );
}

