import React from 'react';
import { Sparkles, ExternalLink, Mail, Instagram, ArrowUpRight } from 'lucide-react';

interface FooterProps {
  onStartOnboarding: () => void;
  onOpenMentor: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onStartOnboarding, onOpenMentor }) => {
  return (
    <footer className="w-full border-t border-[#EAE5DE] bg-[#FAF8F5] text-neutral-600">
      {/* 1. Subtle, Premium Signature Section: Built by Aetherix & Owner Showcase */}
      <div className="w-full border-b border-[#EAE5DE] py-10 px-4 sm:px-6 bg-white/60">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-md">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200/60 px-2 py-0.5 rounded-full font-semibold">
                Creator &amp; Studio
              </span>
              <span className="text-xs text-neutral-400">·</span>
              <span className="text-xs text-neutral-500 font-medium">Built by Aetherix</span>
            </div>
            <h4 className="text-base font-bold text-[#111827] tracking-tight">
              Designed &amp; Developed by Aditya
            </h4>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Crafted as part of the{' '}
              <a
                href="https://aetherix.oneapp.dev"
                target="_blank"
                rel="noreferrer"
                className="text-purple-700 hover:text-purple-900 font-semibold underline underline-offset-2 inline-flex items-center gap-0.5"
              >
                Aetherix Showcase
                <ArrowUpRight className="w-3 h-3 inline" />
              </a>{' '}
              — building calm, contextual digital instruments to help young explorers find direction without noise.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 shrink-0">
            <a
              href="https://aetherix.oneapp.dev"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#111827] hover:bg-black text-white text-xs font-medium transition shadow-xs"
            >
              <span>Visit Aetherix</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <a
              href="mailto:adityax2276@gmail.com"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E2DDD5] text-neutral-700 hover:text-black hover:border-black text-xs font-medium transition"
              title="Email Aditya"
            >
              <Mail className="w-3 h-3 text-purple-600" />
              <span>Email</span>
            </a>

            <a
              href="https://instagram.com/adixanarchy"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E2DDD5] text-neutral-700 hover:text-black hover:border-black text-xs font-medium transition"
              title="Instagram @adixanarchy"
            >
              <Instagram className="w-3 h-3 text-pink-600" />
              <span>@adixanarchy</span>
            </a>
          </div>
        </div>
      </div>

      {/* 2. Final Minimal Footer Links & Brand */}
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
        {/* Brand info */}
        <div className="flex flex-col items-center sm:items-start gap-1">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-500 to-indigo-400 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <span className="font-bold text-[#111827] lowercase tracking-tight font-['Space_Grotesk'] text-base">
              orbit
            </span>
            <span className="text-[10px] font-mono uppercase text-neutral-400">/ ADITYAX</span>
          </div>
          <p className="text-xs text-neutral-500 max-w-xs">
            "Everyone is running. But where are you going?" • A calmer path to discovery.
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-medium text-neutral-600">
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
            href="https://aetherix.oneapp.dev"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[#111827] transition"
          >
            Aetherix
          </a>
          <span className="text-[11px] text-neutral-400 font-mono">
            © {new Date().getFullYear()} ORBIT
          </span>
        </div>
      </div>
    </footer>
  );
};
