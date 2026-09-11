import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  History,
  Sparkles,
  ShieldCheck,
  Compass,
  CheckCircle2,
  FolderGit2,
  Calendar,
  Edit3,
  Save,
  Copy,
  Check,
  KeyRound,
  GraduationCap,
  Briefcase,
  Layers,
  BookOpen
} from 'lucide-react';
import { UserProgressState, JourneyArchive, UserProfile } from '../types';

interface SettingsProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userState: UserProgressState;
  userId: string;
  onOpenStartFresh: () => void;
  onProfileUpdated: (updatedState: UserProgressState) => void;
  onSwitchUser: (newUserId: string, state: UserProgressState) => void;
}

export const SettingsProfileModal: React.FC<SettingsProfileModalProps> = ({
  isOpen,
  onClose,
  userState,
  userId,
  onOpenStartFresh,
  onProfileUpdated,
  onSwitchUser,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'history' | 'account'>('profile');
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Form Fields
  const user = userState.user;
  const [editName, setEditName] = useState<string>(user?.fullName || user?.name || '');
  const [editEmail, setEditEmail] = useState<string>(user?.email || '');
  const [editAge, setEditAge] = useState<string>(user?.ageRange || '18–21');
  const [editEducation, setEditEducation] = useState<string>(user?.educationLevel || 'College / University Student');
  const [editField, setEditField] = useState<string>(user?.fieldOfStudy || '');
  const [editGoal, setEditGoal] = useState<string>(user?.targetGoal || '');
  const [editLearningStyle, setEditLearningStyle] = useState<string>(user?.learningStyle || '');

  // Account Switch / Retrieval state
  const [lookupInput, setLookupInput] = useState<string>('');
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  if (!isOpen) return null;

  const profile = userState.profile;
  const direction = userState.selectedDirection;
  const journeyHistory = userState.journeyHistory || [];
  const currentSessionNumber = userState.sessionNumber || journeyHistory.length + 1;
  const displayName = user?.fullName || user?.name || profile?.headline || 'Explorer';

  const handleCopyId = () => {
    navigator.clipboard.writeText(userId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const response = await fetch('/api/user/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          fullName: editName.trim(),
          name: editName.trim(),
          email: editEmail.trim() || undefined,
          ageRange: editAge,
          educationLevel: editEducation,
          fieldOfStudy: editField.trim(),
          targetGoal: editGoal.trim(),
          learningStyle: editLearningStyle.trim(),
        }),
      });

      if (!response.ok) throw new Error('Failed to update profile');
      const data = await response.json();
      if (data?.state) {
        onProfileUpdated(data.state);
        setSaveSuccess(true);
        setIsEditing(false);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err: any) {
      console.error('Error saving profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleLookupAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupInput.trim()) return;

    setLookupLoading(true);
    setLookupError(null);

    try {
      const response = await fetch('/api/user/session/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: lookupInput.trim() }),
      });

      const data = await response.json();
      if (data?.found && data?.state) {
        onSwitchUser(data.userId, data.state);
        onClose();
      } else {
        setLookupError('No account found matching this Email or Account ID.');
      }
    } catch (err: any) {
      setLookupError('Error looking up account. Please check your connection.');
    } finally {
      setLookupLoading(false);
    }
  };

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
          className="max-w-xl w-full max-h-[92vh] bg-[#FAF8F5] border border-[#E8E3DA] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Top Bar */}
          <div className="p-5 sm:p-6 border-b border-[#EAE5DE] flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 font-bold font-['Space_Grotesk'] text-base">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[#111827] text-base font-['Space_Grotesk']">
                    {displayName}
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
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
              onClick={() => setActiveTab('profile')}
              className={`pb-2.5 font-medium transition flex items-center gap-1.5 border-b-2 ${
                activeTab === 'profile'
                  ? 'border-purple-600 text-purple-700 font-semibold'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Profile &amp; Career</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`pb-2.5 font-medium transition flex items-center gap-1.5 border-b-2 ${
                activeTab === 'history'
                  ? 'border-purple-600 text-purple-700 font-semibold'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Journey History ({journeyHistory.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('account')}
              className={`pb-2.5 font-medium transition flex items-center gap-1.5 border-b-2 ${
                activeTab === 'account'
                  ? 'border-purple-600 text-purple-700 font-semibold'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Account &amp; Sync</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-sm">
            {/* TAB 1: PROFILE & CAREER */}
            {activeTab === 'profile' && (
              <div className="space-y-5">
                {/* Profile Header & Edit Action */}
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-[#111827]">Personal Profile</h4>
                    <p className="text-xs text-neutral-500">Stored persistently in your PostgreSQL user record.</p>
                  </div>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E2DDD5] bg-white hover:bg-neutral-50 text-xs font-medium text-neutral-700 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Edit Profile</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#111827] hover:bg-black text-xs font-medium text-white transition disabled:opacity-50 shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5 text-purple-300" />
                      <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  )}
                </div>

                {saveSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Profile successfully updated in PostgreSQL database.</span>
                  </div>
                )}

                {/* Profile Form (Edit Mode vs View Mode) */}
                {isEditing ? (
                  <div className="p-4 rounded-2xl bg-white border border-[#E8E3DA] space-y-3 shadow-xs">
                    <div>
                      <label className="text-xs font-semibold text-neutral-700 block mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-[#EAE5DE] bg-[#FAF8F5] focus:outline-none focus:border-purple-600 text-[#111827]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-700 block mb-1">Email Address</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={e => setEditEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-[#EAE5DE] bg-[#FAF8F5] focus:outline-none focus:border-purple-600 text-[#111827]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-neutral-700 block mb-1">Age Range</label>
                        <select
                          value={editAge}
                          onChange={e => setEditAge(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-[#EAE5DE] bg-[#FAF8F5] text-[#111827]"
                        >
                          <option value="Under 18">Under 18</option>
                          <option value="18–21">18–21</option>
                          <option value="22–25">22–25</option>
                          <option value="26–30">26–30</option>
                          <option value="30+">30+</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-neutral-700 block mb-1">Education Stage</label>
                        <input
                          type="text"
                          value={editEducation}
                          onChange={e => setEditEducation(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-[#EAE5DE] bg-[#FAF8F5] text-[#111827]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-700 block mb-1">Field of Study / Major</label>
                      <input
                        type="text"
                        value={editField}
                        onChange={e => setEditField(e.target.value)}
                        placeholder="e.g., Computer Science, Commerce, Design..."
                        className="w-full px-3 py-2 text-sm rounded-xl border border-[#EAE5DE] bg-[#FAF8F5] text-[#111827]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-700 block mb-1">Target Career Goal</label>
                      <input
                        type="text"
                        value={editGoal}
                        onChange={e => setEditGoal(e.target.value)}
                        placeholder="e.g., Land a high-growth tech internship..."
                        className="w-full px-3 py-2 text-sm rounded-xl border border-[#EAE5DE] bg-[#FAF8F5] text-[#111827]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-700 block mb-1">Preferred Learning Style</label>
                      <input
                        type="text"
                        value={editLearningStyle}
                        onChange={e => setEditLearningStyle(e.target.value)}
                        placeholder="e.g., Hands-on building & mini-projects..."
                        className="w-full px-3 py-2 text-sm rounded-xl border border-[#EAE5DE] bg-[#FAF8F5] text-[#111827]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-white border border-[#E8E3DA] space-y-3 shadow-xs text-xs">
                    <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[#F0EBE4]">
                      <div>
                        <span className="text-neutral-400 block text-[11px]">Full Name</span>
                        <span className="font-semibold text-neutral-800 text-sm">{displayName}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[11px]">Email</span>
                        <span className="font-semibold text-neutral-800">{user?.email || 'Not provided'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[11px]">Age Range</span>
                        <span className="text-neutral-700 font-medium">{user?.ageRange || '18–21'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[11px]">Education</span>
                        <span className="text-neutral-700 font-medium">{user?.educationLevel || 'Undergrad Student'}</span>
                      </div>
                    </div>

                    {user?.fieldOfStudy && (
                      <div>
                        <span className="text-neutral-400 block text-[11px]">Field / Background</span>
                        <span className="text-neutral-700 font-medium">{user.fieldOfStudy}</span>
                      </div>
                    )}

                    {user?.targetGoal && (
                      <div>
                        <span className="text-neutral-400 block text-[11px]">Primary Goal</span>
                        <span className="text-neutral-700 font-medium">{user.targetGoal}</span>
                      </div>
                    )}

                    {user?.learningStyle && (
                      <div>
                        <span className="text-neutral-400 block text-[11px]">Learning Style</span>
                        <span className="text-neutral-700 font-medium">{user.learningStyle}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Profile Synthesis Snapshot */}
                {profile && (
                  <div className="p-4 rounded-2xl bg-white border border-[#E8E3DA] space-y-2.5 shadow-xs text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                        AI Persona Analysis
                      </span>
                    </div>
                    <p className="font-semibold text-[#111827] text-sm">{profile.headline}</p>
                    <p className="text-neutral-600 leading-relaxed">{profile.summary}</p>
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

                {/* Start Fresh Notice */}
                <div className="p-4 rounded-2xl bg-[#F4EFEB] border border-[#E2DDD5] space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Compass className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h5 className="font-bold text-xs text-[#111827]">
                        Change of Direction?
                      </h5>
                      <p className="text-xs text-neutral-600 leading-relaxed">
                        If your goals have shifted, you can restart discovery anytime with zero bias. Previous roadmaps and tasks are preserved in Journey History.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-[#EAE5DE]">
                    <span className="text-[11px] text-neutral-500">
                      Archive current journey &amp; start new
                    </span>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenStartFresh();
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-medium transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Sparkles className="w-3 h-3 text-purple-300" />
                      <span>Start Fresh</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: JOURNEY HISTORY */}
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
                      Previous discovery paths are safely preserved in PostgreSQL.
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

            {/* TAB 3: ACCOUNT & SYNC */}
            {activeTab === 'account' && (
              <div className="space-y-5">
                {/* Account ID Card */}
                <div className="p-4 rounded-2xl bg-white border border-[#E8E3DA] space-y-3 shadow-xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                      Persistent Account
                    </span>
                    <h4 className="font-bold text-sm text-[#111827] mt-1.5">
                      Your Unique Explorer Account ID
                    </h4>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Use this ID or your registered email to resume your exact progress on another computer or browser.
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] border border-[#EAE5DE]">
                    <span className="font-mono text-xs text-neutral-800 select-all break-all">{userId}</span>
                    <button
                      onClick={handleCopyId}
                      className="ml-2 px-3 py-1.5 rounded-lg bg-white border border-[#E2DDD5] text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition shrink-0 flex items-center gap-1"
                    >
                      {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-neutral-500" />}
                      <span>{copiedId ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Cross-device retrieval form */}
                <div className="p-4 rounded-2xl bg-white border border-[#E8E3DA] space-y-3 shadow-xs">
                  <h4 className="font-bold text-sm text-[#111827]">
                    Access Profile on Another Device
                  </h4>
                  <p className="text-xs text-neutral-500">
                    Switch to an existing ORBIT account by entering your Account ID or email:
                  </p>

                  <form onSubmit={handleLookupAccount} className="space-y-2.5">
                    <input
                      type="text"
                      value={lookupInput}
                      onChange={e => setLookupInput(e.target.value)}
                      placeholder="Enter Account ID or Email address..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE5DE] text-xs text-[#111827] focus:outline-none focus:border-purple-600 bg-[#FAF8F5]"
                    />
                    {lookupError && (
                      <p className="text-xs text-red-600">{lookupError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={lookupLoading || !lookupInput.trim()}
                      className="w-full py-2.5 rounded-xl bg-[#111827] hover:bg-black text-white text-xs font-semibold transition disabled:opacity-40"
                    >
                      {lookupLoading ? 'Locating Account...' : 'Retrieve & Load Profile'}
                    </button>
                  </form>
                </div>

                <div className="flex items-center gap-2 text-xs text-neutral-500 px-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>All state is verified and stored in PostgreSQL database with zero risk of loss.</span>
                </div>
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
