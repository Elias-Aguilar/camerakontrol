import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Toast from "react-bootstrap/Toast";
import ToastContainer from "react-bootstrap/ToastContainer";

export type ToastVariant = "success" | "danger" | "info" | "warning";

export type ConfirmOptions = {
  title: string;
  body: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "danger" | "primary";
};

type ToastItem = { id: number; message: string; variant: ToastVariant };

type NotificationsContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications debe usarse dentro de NotificationsProvider");
  }
  return ctx;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const showToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, variant }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ opts, resolve });
    });
  }, []);

  const closeConfirm = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  const bodyClassFor = (v: ToastVariant) =>
    v === "warning"
      ? "small d-flex align-items-center text-dark"
      : "small d-flex align-items-center text-white";

  return (
    <NotificationsContext.Provider value={{ showToast, confirm }}>
      {children}

      <ToastContainer
        className="p-3"
        position="top-end"
        style={{ zIndex: 10800 }}
      >
        {toasts.map((t) => (
          <Toast
            key={t.id}
            bg={t.variant}
            onClose={() => removeToast(t.id)}
            delay={4500}
            autohide
          >
            <Toast.Body className={bodyClassFor(t.variant)}>{t.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>

      <Modal
        show={confirmState !== null}
        onHide={() => closeConfirm(false)}
        centered
        data-bs-theme="dark"
        contentClassName="border border-secondary"
      >
        {confirmState && (
          <>
            <Modal.Header closeButton className="border-secondary">
              <Modal.Title className="fs-6">{confirmState.opts.title}</Modal.Title>
            </Modal.Header>
            <Modal.Body className="text-secondary">
              {confirmState.opts.body}
            </Modal.Body>
            <Modal.Footer className="border-secondary">
              <Button variant="outline-secondary" size="sm" onClick={() => closeConfirm(false)}>
                {confirmState.opts.cancelText ?? "Cancelar"}
              </Button>
              <Button
                variant={confirmState.opts.confirmVariant ?? "danger"}
                size="sm"
                onClick={() => closeConfirm(true)}
              >
                {confirmState.opts.confirmText ?? "Confirmar"}
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </NotificationsContext.Provider>
  );
}
