import React from 'react';
import { Compass, Sparkles } from 'lucide-react';

interface FooterProps {
  onStartOnboarding: () => void;
  onOpenMentor: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onStartOnboarding, onOpenMentor }) => {
  return (
    <footer className="w-full border-t border-[#EAE5DE] bg-[#FAF8F5] text-neutral-600 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
        {/* Brand info */}
        <div className="flex flex-col items-center sm:items-start gap-1">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-500 to-indigo-400 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <span className="font-bold text-[#111827] lowercase tracking-tight font-['Space_Grotesk'] text-base">
              orbit
            </span>
            <span className="text-[10px] font-mono uppercase text-neutral-600">/ ADITYAX</span>
          </div>
          <p className="text-xs text-neutral-600 max-w-xs">
            A calmer way to discover skills and build a future you actually want.
          </p>
        </div>

        {/* Links */}
        <div className="flex items-center gap-5 text-xs font-medium text-neutral-600">
          <button
            onClick={onStartOnboarding}
            className="hover:text-[#111827] transition"
          >
            Find My Direction
          </button>
          <button
            onClick={onOpenMentor}
            className="hover:text-[#111827] transition"
          >
            AI Mentor
          </button>
          <a
            href="#how-it-works"
            className="hover:text-[#111827] transition"
          >
            How It Works
          </a>
        </div>
      </div>
    </footer>
  );
};
