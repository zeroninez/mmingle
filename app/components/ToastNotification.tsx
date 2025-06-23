// components/ToastNotification.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { X, CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, "id">) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = Date.now().toString();
      const newToast = { ...toast, id };

      setToasts((prev) => [...prev, newToast]);

      // 자동 제거
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 5000);
    },
    [removeToast],
  );

  const showSuccess = useCallback(
    (title: string, message?: string) => {
      showToast({ type: "success", title, message });
    },
    [showToast],
  );

  const showError = useCallback(
    (title: string, message?: string) => {
      showToast({ type: "error", title, message, duration: 7000 });
    },
    [showToast],
  );

  const showWarning = useCallback(
    (title: string, message?: string) => {
      showToast({ type: "warning", title, message });
    },
    [showToast],
  );

  const showInfo = useCallback(
    (title: string, message?: string) => {
      showToast({ type: "info", title, message });
    },
    [showToast],
  );

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
      }}
    >
      {children}

      {/* Toast 컨테이너 */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  };

  const colors = {
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };

  const iconColors = {
    success: "text-green-500",
    error: "text-red-500",
    warning: "text-yellow-500",
    info: "text-blue-500",
  };

  const Icon = icons[toast.type];

  return (
    <div
      className={`
      max-w-sm w-full border rounded-lg p-4 shadow-lg
      transform transition-all duration-300 ease-in-out
      ${colors[toast.type]}
    `}
    >
      <div className="flex items-start">
        <Icon className={`w-5 h-5 mt-0.5 mr-3 ${iconColors[toast.type]}`} />

        <div className="flex-1">
          <p className="font-medium">{toast.title}</p>
          {toast.message && (
            <p className="mt-1 text-sm opacity-90">{toast.message}</p>
          )}
        </div>

        <button
          onClick={onClose}
          className="ml-3 opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

// 기존 alert() 대체를 위한 유틸리티
export const toast = {
  success: (title: string, message?: string) => {
    // ToastProvider 외부에서도 사용할 수 있는 전역 함수
    const event = new CustomEvent("show-toast", {
      detail: { type: "success", title, message },
    });
    window.dispatchEvent(event);
  },
  error: (title: string, message?: string) => {
    const event = new CustomEvent("show-toast", {
      detail: { type: "error", title, message },
    });
    window.dispatchEvent(event);
  },
  warning: (title: string, message?: string) => {
    const event = new CustomEvent("show-toast", {
      detail: { type: "warning", title, message },
    });
    window.dispatchEvent(event);
  },
  info: (title: string, message?: string) => {
    const event = new CustomEvent("show-toast", {
      detail: { type: "info", title, message },
    });
    window.dispatchEvent(event);
  },
};
