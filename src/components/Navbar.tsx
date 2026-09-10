import React, { useState, useEffect } from 'react';
import {
  Compass,
  Sparkles,
  MessageSquare,
  RotateCcw,
  Download,
  Upload,
  Database,
  CheckCircle2,
  X,
  Menu,
  User,
  Settings
} from 'lucide-react';
import { UserProgressState } from '../types';

interface NavbarProps {
  currentView: 'landing' | 'onboarding' | 'recommendations' | 'dashboard';
  setCurrentView: (view: 'landing' | 'onboarding' | 'recommendations' | 'dashboard') => void;
  userState: UserProgressState;
  onOpenMentor: () => void;
  onReset?: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenSettings?: () => void;
  onOpenStartFresh?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  userState,
  onOpenMentor,
  onReset,
  onExport,
  onImport,
  onOpenSettings,
  onOpenStartFresh,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [showDbModal, setShowDbModal] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/db/status')
      .then(res => res.json())
      .then(data => setDbStatus(data))
      .catch(() => setDbStatus({ connected: false, message: 'Offline' }));
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#EAE5DE] bg-[#FAF8F5]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setCurrentView('landing')}
            className="flex items-center gap-2.5 text-left focus:outline-none focus:ring-2 focus:ring-neutral-400 rounded-full pr-2"
          >
            {/* Elegant Orbit Logo Mark */}
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-500 to-indigo-400 flex items-center justify-center shadow-sm relative">
              <div className="w-2.5 h-2.5 rounded-full bg-white shadow-xs" />
              <div className="absolute inset-0 rounded-full border border-white/30 scale-125" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-[#111827] lowercase font-['Space_Grotesk']">
                orbit
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-600 font-medium">
                / ADITYAX
              </span>
            </div>
          </button>
        </div>

        {/* Center Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-600">
          <button
            onClick={() => setCurrentView('landing')}
            className={`transition hover:text-[#111827] ${
              currentView === 'landing' ? 'text-[#111827] font-semibold' : ''
            }`}
          >
            How it works
          </button>

          {userState.onboardingCompleted && (
            <button
              onClick={() => setCurrentView('recommendations')}
              className={`transition hover:text-[#111827] ${
                currentView === 'recommendations' ? 'text-[#111827] font-semibold' : ''
              }`}
            >
              Explore
            </button>
          )}

          {userState.selectedDirection && (
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`flex items-center gap-1.5 transition hover:text-[#111827] ${
                currentView === 'dashboard' ? 'text-[#111827] font-semibold' : ''
              }`}
            >
              <span>Roadmap</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </button>
          )}

          {/* Database verification pill */}
          {dbStatus && (
            <button
              onClick={() => setShowDbModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F3EFEA] hover:bg-[#EBE5DE] text-xs font-mono text-neutral-700 transition border border-[#E2DDD5]"
              title="PostgreSQL status & migration details"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dbStatus.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>PostgreSQL</span>
            </button>
          )}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Hidden File Picker */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={onImport}
            accept=".json"
            className="hidden"
          />

          {/* AI Mentor Quick Trigger */}
          <button
            onClick={onOpenMentor}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-neutral-100 border border-[#E2DDD5] text-neutral-700 text-xs font-medium transition shadow-xs"
            title="Ask AI Mentor"
          >
            <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">Ask Mentor</span>
            <span className="sm:hidden">Mentor</span>
          </button>

          {/* Profile & Settings Trigger */}
          {onOpenSettings && (
            <button
              id="navbar-settings-btn"
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-neutral-100 border border-[#E2DDD5] text-neutral-700 text-xs font-medium transition shadow-xs"
              title="Profile & Settings"
            >
              <Settings className="w-3.5 h-3.5 text-neutral-600" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}

          {/* Understated Start Fresh secondary action */}
          {userState.onboardingCompleted && onOpenStartFresh && (
            <button
              id="navbar-start-fresh-btn"
              onClick={onOpenStartFresh}
              className="hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-full bg-transparent hover:bg-black/5 text-neutral-500 hover:text-neutral-900 text-xs font-medium transition"
              title="Start a new discovery journey with fresh eyes"
            >
              <Sparkles className="w-3 h-3 text-purple-600" />
              <span>Start Fresh</span>
            </button>
          )}

          {/* Primary CTA (Pill Button) */}
          {!userState.onboardingCompleted ? (
            <button
              onClick={() => setCurrentView('onboarding')}
              className="flex items-center gap-1.5 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full bg-[#111827] hover:bg-black text-white text-xs sm:text-sm font-medium transition shadow-xs group"
            >
              <span>Start exploring</span>
              <span className="group-hover:translate-x-0.5 transition">→</span>
            </button>
          ) : !userState.selectedDirection ? (
            <button
              onClick={() => setCurrentView('recommendations')}
              className="flex items-center gap-1.5 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full bg-[#111827] hover:bg-black text-white text-xs sm:text-sm font-medium transition shadow-xs group"
            >
              <span>3 Possibilities</span>
              <span className="group-hover:translate-x-0.5 transition">→</span>
            </button>
          ) : (
            <button
              onClick={() => setCurrentView('dashboard')}
              className="flex items-center gap-1.5 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full bg-[#111827] hover:bg-black text-white text-xs sm:text-sm font-medium transition shadow-xs group"
            >
              <span>Dashboard</span>
              <span className="group-hover:translate-x-0.5 transition">→</span>
            </button>
          )}

          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="md:hidden p-1.5 rounded-lg text-neutral-700 hover:bg-[#F3EFEA] transition"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#EAE5DE] bg-[#FAF8F5] px-4 py-3 space-y-2 text-sm font-medium text-neutral-700 animate-in fade-in slide-in-from-top-2">
          <button
            onClick={() => {
              setCurrentView('landing');
              setMobileMenuOpen(false);
            }}
            className="w-full text-left py-2 px-3 rounded-lg hover:bg-[#F3EFEA]"
          >
            How it works
          </button>

          {userState.onboardingCompleted && (
            <button
              onClick={() => {
                setCurrentView('recommendations');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left py-2 px-3 rounded-lg hover:bg-[#F3EFEA]"
            >
              Explore 3 Paths
            </button>
          )}

          {userState.selectedDirection && (
            <button
              onClick={() => {
                setCurrentView('dashboard');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left py-2 px-3 rounded-lg hover:bg-[#F3EFEA] flex items-center justify-between"
            >
              <span>Roadmap &amp; Progress</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </button>
          )}

          {/* Profile & Settings (Mobile) */}
          {onOpenSettings && (
            <button
              id="mobile-settings-btn"
              onClick={() => {
                onOpenSettings();
                setMobileMenuOpen(false);
              }}
              className="w-full text-left py-2 px-3 rounded-lg hover:bg-[#F3EFEA] flex items-center justify-between text-neutral-800"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-neutral-600" />
                <span>Profile &amp; Settings</span>
              </div>
              {userState.journeyHistory && userState.journeyHistory.length > 0 && (
                <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-mono">
                  {userState.journeyHistory.length} archived
                </span>
              )}
            </button>
          )}

          {/* Start Fresh (Mobile) */}
          {userState.onboardingCompleted && onOpenStartFresh && (
            <button
              id="mobile-start-fresh-btn"
              onClick={() => {
                onOpenStartFresh();
                setMobileMenuOpen(false);
              }}
              className="w-full text-left py-2 px-3 rounded-lg hover:bg-purple-50/50 text-neutral-700 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Start Fresh</span>
              </div>
              <span className="text-[10px] text-neutral-400">Keep history safe</span>
            </button>
          )}

          <div className="pt-2 border-t border-[#EAE5DE] flex items-center justify-between text-xs text-neutral-500 px-3">
            <button
              onClick={() => {
                setShowDbModal(true);
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-1.5 font-mono text-neutral-700"
            >
              <Database className="w-3.5 h-3.5 text-purple-600" />
              <span>PostgreSQL Active</span>
            </button>

            {userState.onboardingCompleted && (
              <div className="flex items-center gap-2">
                <button onClick={onExport} title="Save backup" className="hover:text-neutral-900">
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => fileInputRef.current?.click()} title="Load backup" className="hover:text-neutral-900">
                  <Upload className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onOpenStartFresh || onReset}
                  title="Start Fresh (archive current path)"
                  className="hover:text-purple-600"
                >
                  <Sparkles className="w-3.5 h-3.5 text-neutral-500 hover:text-purple-600" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Database Schema & Status Modal */}
      {showDbModal && dbStatus && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#E2DDD5] rounded-3xl p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#F0EBE4] pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-[#111827] font-['Space_Grotesk'] text-base">
                  PostgreSQL Status
                </h3>
              </div>
              <button
                onClick={() => setShowDbModal(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EAE5DE]">
                <span className="text-neutral-500">Connection State</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active &amp; Ready
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EAE5DE]">
                <span className="text-neutral-500">Database Engine</span>
                <span className="text-neutral-800 font-mono font-medium">
                  {dbStatus.engine === 'remote_postgres' ? 'Supabase PostgreSQL' : 'Embedded PostgreSQL'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EAE5DE] space-y-1.5">
                <span className="text-neutral-600 block font-semibold">
                  Verified Relational Tables ({dbStatus.tables?.length || 0}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {dbStatus.tables?.map((tbl: string) => (
                    <span
                      key={tbl}
                      className="px-2 py-0.5 rounded bg-white border border-[#E2DDD5] text-purple-700 font-mono text-[10px]"
                    >
                      {tbl}
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-neutral-500 leading-relaxed pt-1">
                {dbStatus.message}
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowDbModal(false)}
                className="px-4 py-2 rounded-full bg-[#111827] hover:bg-black text-white text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
