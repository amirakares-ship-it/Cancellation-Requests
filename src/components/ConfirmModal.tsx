import React from 'react';
import { AlertTriangle, Trash2, Key, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  icon?: 'trash' | 'key' | 'warning';
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  type = 'danger',
  icon = 'warning',
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    if (icon === 'trash') return <Trash2 className="h-7 w-7 text-rose-600" />;
    if (icon === 'key') return <Key className="h-7 w-7 text-amber-500" />;
    return <AlertTriangle className="h-7 w-7 text-amber-500" />;
  };

  const getBg = () => {
    if (type === 'danger') return 'bg-rose-50 border-rose-100';
    if (type === 'warning') return 'bg-amber-50 border-amber-100';
    return 'bg-sky-50 border-sky-100';
  };

  const getBtnBg = () => {
    if (type === 'danger') return 'bg-rose-600 hover:bg-rose-700 text-white';
    if (type === 'warning') return 'bg-amber-500 hover:bg-amber-600 text-white';
    return 'bg-emerald-600 hover:bg-emerald-700 text-white';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden text-right font-sans"
        dir="rtl"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl border ${getBg()} shrink-0`}>
              {getIcon()}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-slate-900 mb-1">{title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{message}</p>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2 text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 ${getBtnBg()}`}
          >
            {isLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
