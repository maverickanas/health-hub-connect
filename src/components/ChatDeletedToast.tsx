import React, { useEffect } from 'react';
import { Trash2, X } from 'lucide-react';

interface ChatDeletedToastProps {
  message?: string;
  onClose: () => void;
}

const ChatDeletedToast: React.FC<ChatDeletedToastProps> = ({
  message = 'Chat deleted',
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-4 right-4 z-[100] bg-[#1A1A1A] border border-white/10 text-white p-4 rounded-2xl flex items-center shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-5 fade-in max-w-md mx-auto"
    >
      <div className="w-9 h-9 rounded-xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center mr-3 shrink-0">
        <Trash2 className="w-4 h-4 text-[#CCFF00]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium tracking-wide">{message}</p>
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mt-0.5">
          Conversation removed
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="ml-auto pl-3 text-zinc-500 hover:text-white cursor-pointer transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default ChatDeletedToast;
