import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  History,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Compass,
  CheckCircle2,
  FolderGit2,
  Calendar,
  Layers
} from 'lucide-react';
import { UserProgressState, JourneyArchive } from '../types';

interface SettingsProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userState: UserProgressState;
  onOpenStartFresh: () => void;
}

export const SettingsProfileModal: React.FC<SettingsProfileModalProps> = ({
  isOpen,
  onClose,
  userState,
  onOpenStartFresh,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');
  const [selectedArchive, setSelectedArchive] = useState<JourneyArchive | null>(null);

  if (!isOpen) return null;

  const profile = userState.profile;
  const direction = userState.selectedDirection;
  const journeyHistory = userState.journeyHistory || [];
  const currentSessionNumber = userState.sessionNumber || journeyHistory.length + 1;

  return (
    <AnimatePresence>
      <div
        id="settings-profile-backdrop"
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          id="settings-profile-dialog"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="max-w-xl w-full max-h-[90vh] bg-[#FAF8F5] border border-[#E8E3DA] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Top Bar */}
          <div className="p-5 sm:p-6 border-b border-[#EAE5DE] flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 font-bold font-['Space_Grotesk'] text-base">
                {profile?.headline ? profile.headline.charAt(0).toUpperCase() : 'O'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[#111827] text-base font-['Space_Grotesk']">
                    Discovery Profile &amp; Settings
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                    Journey #{currentSessionNumber}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {direction?.directionName || 'Active Exploration'}
                </p>
              </div>
            </div>

            <button
              id="settings-close-btn"
              onClick={onClose}
              className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-[#EAE5DE] bg-[#FAF8F5] px-6 pt-2 gap-4 shrink-0 text-xs">
            <button
              onClick={() => {
                setActiveTab('profile');
                setSelectedArchive(null);
              }}
              className={`pb-2.5 font-medium transition flex items-center gap-1.5 border-b-2 ${
                activeTab === 'profile'
                  ? 'border-purple-600 text-purple-700 font-semibold'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Current Path &amp; Persona</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('history');
                setSelectedArchive(null);
              }}
              className={`pb-2.5 font-medium transition flex items-center gap-1.5 border-b-2 ${
                activeTab === 'history'
                  ? 'border-purple-600 text-purple-700 font-semibold'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Journey History ({journeyHistory.length})</span>
            </button>
          </div>

          {/* Body Content (Scrollable) */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-sm">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                {/* Active Direction Card */}
                <div className="p-4 rounded-2xl bg-white border border-[#E8E3DA] space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                      Active Direction
                    </span>
                    <span className="text-xs text-neutral-400">
                      Journey #{currentSessionNumber}
                    </span>
                  </div>

                  <h4 className="font-bold text-base text-[#111827]">
                    {direction?.directionName || 'Exploration in progress'}
                  </h4>

                  {direction?.tagline && (
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      {direction.tagline}
                    </p>
                  )}

                  {profile && (
                    <div className="pt-2 border-t border-[#F0EBE4] space-y-2 text-xs">
                      <p className="text-neutral-500">
                        <span className="font-medium text-neutral-700">Headline:</span> {profile.headline}
                      </p>
                      <p className="text-neutral-500 leading-relaxed">
                        <span className="font-medium text-neutral-700">Summary:</span> {profile.summary}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {profile.naturalStrengths?.map((str, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-[#FAF8F5] text-[11px] text-neutral-600 border border-[#EAE5DE]"
                          >
                            ✦ {str}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Start Fresh Notice & Action Card */}
                <div className="p-4 rounded-2xl bg-[#F4EFEB] border border-[#E2DDD5] space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Compass className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h5 className="font-bold text-xs text-[#111827]">
                        Change of Direction?
                      </h5>
                      <p className="text-xs text-neutral-600 leading-relaxed">
                        Growing means discovering what doesn’t fit just as much as what does. If your interests or goals have shifted, you can restart your discovery journey anytime.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-[#EAE5DE]">
                    <span className="text-[11px] text-neutral-500">
                      Your current journey will be safely archived.
                    </span>
                    <button
                      id="settings-start-fresh-btn"
                      onClick={() => {
                        onClose();
                        onOpenStartFresh();
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[#111827] hover:bg-neutral-800 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Sparkles className="w-3 h-3 text-purple-300" />
                      <span>Start Fresh</span>
                    </button>
                  </div>
                </div>

                {/* Data Safety Note */}
                <div className="flex items-center gap-2 text-xs text-neutral-500 px-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Your account and history are permanently safe. Nothing is erased without your explicit consent.</span>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4">
                {journeyHistory.length === 0 ? (
                  <div className="py-12 text-center space-y-2 text-neutral-500">
                    <History className="w-8 h-8 mx-auto text-neutral-300 stroke-[1.5]" />
                    <p className="text-xs font-medium text-neutral-700">No past journeys archived yet</p>
                    <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
                      You are currently on Journey #1. Whenever you choose to Start Fresh, your journey milestones will be safely archived here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-500">
                      Previous discovery paths are safely preserved. Changing direction is a normal, healthy part of finding the right fit.
                    </p>

                    <div className="space-y-2.5">
                      {journeyHistory.map((j) => (
                        <div
                          key={j.id}
                          className="p-4 rounded-2xl bg-white border border-[#E8E3DA] shadow-xs space-y-2 hover:border-[#D5CFC4] transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono uppercase font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                              Journey #{j.sessionNumber}
                            </span>
                            <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {j.formattedDate || new Date(j.archivedAt).toLocaleDateString()}
                            </span>
                          </div>

                          <h4 className="font-bold text-sm text-[#111827]">
                            {j.directionName}
                          </h4>

                          {j.tagline && (
                            <p className="text-xs text-neutral-500 line-clamp-1">
                              {j.tagline}
                            </p>
                          )}

                          <div className="flex items-center gap-3 pt-1 text-[11px] text-neutral-500">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {j.completedTasksCount || 0} tasks finished
                            </span>
                            {(j.completedProjectsCount || 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <FolderGit2 className="w-3 h-3 text-purple-600" />
                                {j.completedProjectsCount} project built
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-4 border-t border-[#EAE5DE] bg-white flex items-center justify-between text-xs text-neutral-500 shrink-0">
            <span>ORBIT • Non-destructive Discovery</span>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-[#E2DDD5] hover:bg-[#FAF8F5] text-neutral-700 font-medium transition"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
