import { useNavigate } from "react-router-dom";

export function LoginScreen() {
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: integrar auth real; por ahora simulamos login exitoso.
    navigate("/cameras");
  };

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>CameraKontrol</h1>
      <p style={{ color: "#9CA3AF", marginBottom: 24 }}>
        Inicia sesión para continuar
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "#9CA3AF" }}>Correo electrónico</label>
          <input
            type="email"
            placeholder="tu@email.com"
            value="eaguilar@camerakontrol.com"
            style={{
              height: 44,
              borderRadius: 999,
              border: "1px solid #1F2937",
              padding: "0 14px",
              backgroundColor: "#020617",
              color: "#F9FAFB"
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, color: "#9CA3AF" }}>Contraseña</label>
          <input
            type="password"
            placeholder="••••••••"
            value="e4guilar123**"
            style={{
              height: 44,
              borderRadius: 999,
              border: "1px solid #1F2937",
              padding: "0 14px",
              backgroundColor: "#020617",
              color: "#F9FAFB"
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            marginTop: 8,
            height: 48,
            borderRadius: 999,
            border: "none",
            backgroundColor: "#22C55E",
            color: "#022C22",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Iniciar sesión
        </button>
      </form>
    </div>
  );
}

