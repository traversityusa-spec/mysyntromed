import { useState, useEffect } from 'react';
import { X, MessageSquare } from 'lucide-react';

type ToastType = 'message' | 'request' | 'system';

type Toast = {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  timestamp: Date;
};

let toastCallback: ((toast: Toast) => void) | null = null;

export const showToast = (type: ToastType, title: string, message: string) => {
  const toast: Toast = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    type,
    title,
    message,
    timestamp: new Date(),
  };
  if (toastCallback) {
    toastCallback(toast);
  }
};

export const ToastContainer = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    toastCallback = (toast: Toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 5000);
    };
    return () => {
      toastCallback = null;
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-lg animate-in slide-in-from-right duration-300"
        >
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100">
            <MessageSquare size={16} className="text-teal-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{toast.message}</p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};