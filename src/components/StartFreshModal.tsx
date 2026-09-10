import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, ShieldCheck, X, Compass, History } from 'lucide-react';

interface StartFreshModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  currentDirectionName?: string;
}

export const StartFreshModal: React.FC<StartFreshModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentDirectionName,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleStartFresh = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Error starting fresh:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        id="start-fresh-backdrop"
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSubmitting) onClose();
        }}
      >
        <motion.div
          id="start-fresh-dialog"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="max-w-md w-full bg-[#FAF8F5] border border-[#E8E3DA] rounded-3xl p-6 sm:p-7 shadow-2xl relative space-y-6"
        >
          {/* Close button */}
          <button
            id="start-fresh-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            className="absolute top-5 right-5 p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-black/5 transition disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Gentle Header Tag */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-100/80 text-[11px] font-medium text-purple-800">
              <Compass className="w-3.5 h-3.5 text-purple-600" />
              <span>Changing direction is allowed</span>
            </span>
          </div>

          {/* Core Content */}
          <div className="space-y-2.5">
            <h2
              id="start-fresh-title"
              className="text-2xl font-bold text-[#111827] tracking-tight font-['Space_Grotesk']"
            >
              Changed your mind?
            </h2>
            <p
              id="start-fresh-desc"
              className="text-sm text-neutral-600 leading-relaxed"
            >
              That's completely okay. Start a new discovery journey and we'll look at your direction with fresh eyes.
            </p>
          </div>

          {/* Preserved History Guarantee Card */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#EAE5DE] space-y-2">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-[#111827]">
                  Your previous journey stays safely preserved
                </p>
                <p className="text-neutral-500 leading-normal">
                  {currentDirectionName ? (
                    <>
                      Your progress on <span className="font-medium text-neutral-700">"{currentDirectionName}"</span> and completed projects are archived in your Journey History. You are free to restart discovery without losing past accomplishments.
                    </>
                  ) : (
                    <>
                      Starting fresh will never delete your account or erase past history. Your previous responses are safely archived.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <button
              id="start-fresh-confirm-btn"
              onClick={handleStartFresh}
              disabled={isSubmitting}
              className="w-full py-3 px-5 rounded-2xl bg-[#111827] hover:bg-neutral-800 active:scale-[0.99] text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Preparing fresh journey...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-purple-300" />
                  <span>Start Fresh</span>
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </>
              )}
            </button>

            <button
              id="start-fresh-cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-2xl bg-transparent hover:bg-black/5 active:scale-[0.99] text-neutral-600 hover:text-neutral-900 text-sm font-medium transition text-center"
            >
              Keep my current path
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
