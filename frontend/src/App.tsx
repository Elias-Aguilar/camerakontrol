import { Routes, Route, Navigate } from "react-router-dom";
import { CameraListScreen } from "./screens/CameraListScreen";
import { RecordingsScreen } from "./screens/RecordingsScreen";
import { AddCamerasScreen } from "./screens/AddCamerasScreen";
import { EditCameraScreen } from "./screens/EditCameraScreen";

export function App() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#082610", color: "#F9FAFB", fontFamily: "Inter, sans-serif" }}>
      <Routes>
        <Route path="/cameras" element={<CameraListScreen />} />
        <Route path="/recordings" element={<RecordingsScreen />} />
        <Route path="/cameras/add" element={<AddCamerasScreen />} />
        <Route path="/cameras/:id/edit" element={<EditCameraScreen />} />
        <Route path="*" element={<Navigate to="/cameras" replace />} />
      </Routes>
    </div>
  );
}

