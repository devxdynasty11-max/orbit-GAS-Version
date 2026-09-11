import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Circle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  FolderGit2,
  ExternalLink,
  MessageSquare,
  RotateCcw,
  Check,
  ChevronRight,
  GraduationCap,
  Award,
  Clock,
  HelpCircle,
  FastForward,
  Loader2,
  Compass,
  AlertCircle
} from 'lucide-react';
import { UserProgressState, RoadmapStage, ProjectItem, LearningResource, Recommendation } from '../types';

interface DashboardViewProps {
  userState: UserProgressState;
  onToggleTask: (taskId: string) => void;
  onToggleProject: (projectId: string) => void;
  onOpenMentor: () => void;
  onChangeDirection: () => void;
  onStartFresh?: () => void;
  onGenerateCustomPathway?: (careerGoal: string) => Promise<boolean>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  userState,
  onToggleTask,
  onToggleProject,
  onOpenMentor,
  onChangeDirection,
  onStartFresh,
  onGenerateCustomPathway,
}) => {
  const [activeTab, setActiveTab] = useState<'roadmap' | 'requirements' | 'projects' | 'resources'>('roadmap');
  const [currentStageIdx, setCurrentStageIdx] = useState<number>(0);
  const [customGoalInput, setCustomGoalInput] = useState('');
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);
  const [customError, setCustomError] = useState('');

  const direction = userState.selectedDirection;
  const roadmap = userState.roadmap || [];
  const projects = userState.projects || [];
  const resources = userState.resources || [];
  const completedTasks = userState.completedTaskIds || [];
  const completedProjects = userState.completedProjectIds || [];

  const isRegulated = Boolean(direction?.isRegulatedProfession);
  const formalReqs = direction?.formalRequirements;

  // Calculate overall progress
  const allTasks = roadmap.flatMap(s => s.tasks || []);
  const totalTasks = allTasks.length || 1;
  const completedCount = allTasks.filter(t => completedTasks.includes(t.id)).length;
  const progressPercent = Math.min(100, Math.round((completedCount / totalTasks) * 100));

  // Current active stage
  const currentStage = roadmap[currentStageIdx] || roadmap[0];

  // Today's focus: first incomplete task in the current or upcoming stages
  const todaysFocusTask = allTasks.find(t => !completedTasks.includes(t.id)) || allTasks[0];

  const handleTaskClick = (taskId: string) => {
    const isNowDone = !completedTasks.includes(taskId);
    onToggleTask(taskId);
    if (isNowDone) {
      confetti({
        particleCount: 25,
        spread: 45,
        origin: { y: 0.7 },
      });
    }
  };

  const handleProjectClick = (projId: string) => {
    const isNowDone = !completedProjects.includes(projId);
    onToggleProject(projId);
    if (isNowDone) {
      confetti({
        particleCount: 35,
        spread: 55,
        origin: { y: 0.6 },
      });
    }
  };

  const handleCustomGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoalInput.trim() || isGeneratingCustom || !onGenerateCustomPathway) return;

    setIsGeneratingCustom(true);
    setCustomError('');
    try {
      const success = await onGenerateCustomPathway(customGoalInput.trim());
      if (success) {
        setCustomGoalInput('');
        setCurrentStageIdx(0);
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.5 },
        });
      } else {
        setCustomError('Could not generate pathway. Please try a simpler career name.');
      }
    } catch (err: any) {
      setCustomError('Brief network issue. Please try again.');
    } finally {
      setIsGeneratingCustom(false);
    }
  };

  if (!direction) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-4">
        <h3 className="text-xl font-bold text-[#111827]">No direction chosen yet</h3>
        <p className="text-sm text-neutral-600">
          Discover your possibilities first to generate your custom roadmap.
        </p>
        <button
          onClick={onChangeDirection}
          className="px-6 py-2.5 rounded-full bg-[#111827] text-white text-sm font-medium"
        >
          Explore Possibilities
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-6 sm:py-12 px-3.5 sm:px-6 space-y-6 sm:space-y-8 pb-28 sm:pb-16">
      {/* 1. TOP BAR: Greeting & Direction Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-500">
            Good day 👋
          </span>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onChangeDirection}
              className="text-xs text-neutral-600 hover:text-neutral-900 transition flex items-center gap-1 font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Switch path</span>
            </button>
            {onStartFresh && (
              <>
                <span className="text-neutral-300">·</span>
                <button
                  id="header-start-fresh-btn"
                  onClick={onStartFresh}
                  className="text-xs text-neutral-500 hover:text-neutral-800 transition flex items-center gap-1 font-medium"
                >
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  <span>Start Fresh</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-semibold">
              Current Direction
            </span>
            {isRegulated && (
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                <GraduationCap className="w-3 h-3" />
                Regulated Profession
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111827] tracking-tight">
            {direction.directionName}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1 leading-relaxed">
            {direction.tagline || direction.simpleExplanation}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs text-neutral-600 font-medium">
            <span>Overall Roadmap Progress</span>
            <span className="font-mono font-bold text-[#111827]">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 bg-[#EAE5DE] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#111827] rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 1b. DYNAMIC CAREER GENERATOR BAR: Any Custom Career (Doctor, Pilot, AI, Law, etc.) */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-[#E8E3DA] shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#111827]">
            <Compass className="w-3.5 h-3.5 text-purple-600" />
            <span>Targeting a specific profession or specialty?</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-400 hidden sm:inline">AI Custom Architect</span>
        </div>
        <form onSubmit={handleCustomGoalSubmit} className="flex flex-col sm:flex-row items-center gap-2">
          <input
            type="text"
            value={customGoalInput}
            onChange={e => setCustomGoalInput(e.target.value)}
            placeholder="e.g. Commercial Pilot, Neurosurgeon, AI Engineer, Corporate Lawyer..."
            className="w-full flex-1 px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-[#E2DDD5] text-xs sm:text-sm text-[#111827] placeholder:text-neutral-400 focus:outline-none focus:border-purple-600"
          />
          <button
            type="submit"
            disabled={!customGoalInput.trim() || isGeneratingCustom}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#111827] hover:bg-black disabled:opacity-40 text-white text-xs font-medium transition flex items-center justify-center gap-1.5 shrink-0"
          >
            {isGeneratingCustom ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Architecting Pathway...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                <span>Generate Pathway</span>
              </>
            )}
          </button>
        </form>
        {customError && (
          <p className="text-[11px] text-rose-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>{customError}</span>
          </p>
        )}
      </div>

      {/* 2. TODAY'S FOCUS: One single clear task (No overwhelm!) */}
      {todaysFocusTask && (
        <div className="p-4 sm:p-6 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-purple-700">
              Today's Focus
            </span>
            <button
              onClick={onOpenMentor}
              className="text-xs text-purple-700 hover:text-purple-900 font-medium inline-flex items-center gap-1"
            >
              <MessageSquare className="w-3 h-3" />
              <span>Ask Mentor</span>
            </button>
          </div>

          <div className="flex items-start gap-3 pt-1">
            <button
              onClick={() => handleTaskClick(todaysFocusTask.id)}
              className={`mt-0.5 w-6 h-6 rounded-full border flex items-center justify-center transition shrink-0 ${
                completedTasks.includes(todaysFocusTask.id)
                  ? 'bg-[#111827] border-[#111827] text-white'
                  : 'border-neutral-300 hover:border-neutral-500 bg-white text-transparent'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <div className="flex-1 min-w-0">
              <p
                onClick={() => handleTaskClick(todaysFocusTask.id)}
                className={`text-sm sm:text-base font-semibold cursor-pointer select-none leading-snug break-words ${
                  completedTasks.includes(todaysFocusTask.id)
                    ? 'line-through text-neutral-400'
                    : 'text-[#111827]'
                }`}
              >
                {todaysFocusTask.text}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Estimated time: ~15-30 minutes • Tap checkmark when done
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. NAVIGATION TABS (Roadmap, Formal Requirements if regulated, Projects, Resources) */}
      <div className="flex items-center gap-1.5 sm:gap-2 border-b border-[#EAE5DE] pb-2 text-xs font-medium overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('roadmap')}
          className={`px-3 py-1.5 rounded-full shrink-0 transition ${
            activeTab === 'roadmap'
              ? 'bg-[#111827] text-white'
              : 'text-neutral-600 hover:text-black hover:bg-[#F3EFEA]'
          }`}
        >
          Roadmap ({currentStageIdx + 1}/{roadmap.length || 1})
        </button>

        {isRegulated && (
          <button
            onClick={() => setActiveTab('requirements')}
            className={`px-3 py-1.5 rounded-full shrink-0 transition flex items-center gap-1 ${
              activeTab === 'requirements'
                ? 'bg-[#111827] text-white'
                : 'text-amber-800 bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/60'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Formal Requirements</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('projects')}
          className={`px-3 py-1.5 rounded-full shrink-0 transition ${
            activeTab === 'projects'
              ? 'bg-[#111827] text-white'
              : 'text-neutral-600 hover:text-black hover:bg-[#F3EFEA]'
          }`}
        >
          Projects ({projects.length})
        </button>

        <button
          onClick={() => setActiveTab('resources')}
          className={`px-3 py-1.5 rounded-full shrink-0 transition ${
            activeTab === 'resources'
              ? 'bg-[#111827] text-white'
              : 'text-neutral-600 hover:text-black hover:bg-[#F3EFEA]'
          }`}
        >
          Tools &amp; Links
        </button>
      </div>

      {/* TAB CONTENT 1: ROADMAP (Current Phase with Why Learning This, Career Benefit, & Next Steps) */}
      {activeTab === 'roadmap' && currentStage && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-purple-700 uppercase tracking-wider font-semibold">
                  Stage 0{currentStage.stageNumber} • {currentStage.stageKey || 'MILESTONE'}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-[#111827] mt-0.5">
                {currentStage.title}
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                <span>{currentStage.estimatedTime || '2-4 weeks'}</span>
              </p>
            </div>

            {/* Stage Selector Pagination */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setCurrentStageIdx(prev => Math.max(0, prev - 1))}
                disabled={currentStageIdx === 0}
                className="p-1.5 rounded-full border border-[#E2DDD5] text-neutral-600 hover:text-black disabled:opacity-30 disabled:hover:text-neutral-600 transition"
                title="Previous phase"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono px-1.5 text-neutral-600">
                {currentStageIdx + 1}/{roadmap.length}
              </span>
              <button
                onClick={() => setCurrentStageIdx(prev => Math.min(roadmap.length - 1, prev + 1))}
                disabled={currentStageIdx === roadmap.length - 1}
                className="p-1.5 rounded-full border border-[#E2DDD5] text-neutral-600 hover:text-black disabled:opacity-30 disabled:hover:text-neutral-600 transition"
                title="Next phase"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Contextual Mentorship Insights for this Stage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(currentStage.whyLearningThis || currentStage.whyItMatters) && (
              <div className="p-3.5 rounded-2xl bg-white border border-[#E8E3DA] space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold flex items-center gap-1">
                  <HelpCircle className="w-3 h-3 text-purple-600" />
                  Why am I learning this?
                </span>
                <p className="text-xs text-neutral-700 leading-relaxed">
                  {currentStage.whyLearningThis || currentStage.whyItMatters}
                </p>
              </div>
            )}

            {currentStage.howItHelpsCareer && (
              <div className="p-3.5 rounded-2xl bg-white border border-[#E8E3DA] space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold flex items-center gap-1">
                  <Award className="w-3 h-3 text-emerald-600" />
                  How it helps my career
                </span>
                <p className="text-xs text-neutral-700 leading-relaxed">
                  {currentStage.howItHelpsCareer}
                </p>
              </div>
            )}
          </div>

          {/* Simple Checklist for Current Phase */}
          <div className="rounded-3xl bg-white border border-[#E8E3DA] p-4 sm:p-6 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between pb-1 border-b border-[#F0ECE6]">
              <span className="text-xs font-semibold text-neutral-700">Stage Action Items</span>
              <span className="text-[11px] text-neutral-400 font-mono">
                {currentStage.tasks.filter(t => completedTasks.includes(t.id)).length} of{' '}
                {currentStage.tasks.length} done
              </span>
            </div>

            {currentStage.tasks.map(task => {
              const isCompleted = completedTasks.includes(task.id);
              return (
                <div
                  key={task.id}
                  className="p-3 rounded-2xl hover:bg-[#FAF8F5] transition flex items-center justify-between gap-3 group"
                >
                  <div
                    onClick={() => handleTaskClick(task.id)}
                    className="flex items-start gap-3 cursor-pointer select-none flex-1 min-w-0"
                  >
                    <button
                      className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center transition shrink-0 ${
                        isCompleted
                          ? 'bg-[#111827] border-[#111827] text-white'
                          : 'border-neutral-300 bg-white text-transparent group-hover:border-neutral-500'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <div className="min-w-0">
                      <span
                        className={`text-xs sm:text-sm leading-relaxed block break-words ${
                          isCompleted ? 'line-through text-neutral-400' : 'text-[#111827] font-medium'
                        }`}
                      >
                        {task.text}
                      </span>
                      {task.category && (
                        <span className="text-[10px] font-mono text-neutral-400 uppercase mt-0.5 block">
                          {task.category}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Skip option for advanced learners */}
                  {!isCompleted && (
                    <button
                      onClick={() => handleTaskClick(task.id)}
                      className="text-[11px] text-neutral-400 hover:text-neutral-700 font-medium px-2 py-1 rounded-md hover:bg-neutral-100 transition shrink-0"
                      title="Mark as already understood"
                    >
                      Skip
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* What Comes Next / Navigation */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-neutral-600 pt-1">
            {currentStage.whatComesAfter && (
              <span className="text-[11px] text-neutral-500 leading-normal">
                <strong>Next Horizon:</strong> {currentStage.whatComesAfter}
              </span>
            )}
            {currentStageIdx < roadmap.length - 1 && (
              <button
                onClick={() => setCurrentStageIdx(prev => prev + 1)}
                className="text-purple-700 hover:text-purple-900 font-semibold inline-flex items-center gap-1 self-end sm:self-auto shrink-0"
              >
                <span>Preview Next Stage</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: FORMAL REGULATED REQUIREMENTS (For Medicine, Law, Aviation, etc.) */}
      {activeTab === 'requirements' && formalReqs && (
        <div className="space-y-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full font-semibold">
              Regulated Career Requirements
            </span>
            <h3 className="text-lg font-bold text-[#111827] mt-1">
              Degrees, Licensing &amp; Legal Credentials
            </h3>
            <p className="text-xs text-neutral-600 mt-0.5">
              Unlike self-taught tech skills, regulated professions require official accredited degrees, standardized examinations, and board approvals.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {formalReqs.education && formalReqs.education.length > 0 && (
              <div className="p-5 rounded-3xl bg-white border border-[#E8E3DA] space-y-2">
                <div className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase font-mono">
                  <GraduationCap className="w-4 h-4" />
                  <span>Required Education</span>
                </div>
                <ul className="space-y-1.5 text-xs text-neutral-700">
                  {formalReqs.education.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-purple-500 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {formalReqs.entranceExams && formalReqs.entranceExams.length > 0 && (
              <div className="p-5 rounded-3xl bg-white border border-[#E8E3DA] space-y-2">
                <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase font-mono">
                  <Award className="w-4 h-4" />
                  <span>Standardized Exams</span>
                </div>
                <ul className="space-y-1.5 text-xs text-neutral-700">
                  {formalReqs.entranceExams.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {formalReqs.qualificationsAndLicensing && formalReqs.qualificationsAndLicensing.length > 0 && (
              <div className="p-5 rounded-3xl bg-white border border-[#E8E3DA] space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase font-mono">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Licensing &amp; Board Certs</span>
                </div>
                <ul className="space-y-1.5 text-xs text-neutral-700">
                  {formalReqs.qualificationsAndLicensing.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {formalReqs.practicalExperience && formalReqs.practicalExperience.length > 0 && (
              <div className="p-5 rounded-3xl bg-white border border-[#E8E3DA] space-y-2">
                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase font-mono">
                  <Clock className="w-4 h-4" />
                  <span>Practicum &amp; Hours</span>
                </div>
                <ul className="space-y-1.5 text-xs text-neutral-700">
                  {formalReqs.practicalExperience.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: PROJECTS */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[#111827]">
              Hands-On Projects &amp; Milestones
            </h3>
            <p className="text-xs text-neutral-600 mt-0.5">
              The fastest way to learn is by creating tangible artifacts you can actually evaluate and share.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {projects.map((proj, idx) => {
              const isCompleted = completedProjects.includes(proj.id);
              return (
                <div
                  key={proj.id || idx}
                  className="p-5 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">
                      {proj.difficulty || proj.level || 'Practice'}
                    </span>
                    <button
                      onClick={() => handleProjectClick(proj.id)}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-[#FAF8F5] border border-[#EAE5DE] text-neutral-700 hover:border-black'
                      }`}
                    >
                      {isCompleted ? '✓ Completed' : 'Mark as Built'}
                    </button>
                  </div>
                  <h4 className="font-bold text-sm text-[#111827]">
                    {proj.title}
                  </h4>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    {proj.objective || proj.expectedOutput}
                  </p>
                  {((proj.skillsPracticed && proj.skillsPracticed.length > 0) || (proj as any).skillsUsed) && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(proj.skillsPracticed || (proj as any).skillsUsed || []).map((s: string, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-[#FAF8F5] text-[10px] text-neutral-500 font-mono"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: RESOURCES */}
      {activeTab === 'resources' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[#111827]">
              Recommended Free Tools &amp; Links
            </h3>
            <p className="text-xs text-neutral-600 mt-0.5">
              Curated, high-signal resources selected specifically for this direction.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {resources.map((res, idx) => (
              <a
                key={res.id || idx}
                href={res.urlOrNote?.startsWith('http') ? res.urlOrNote : (res as any).url || '#'}
                target={res.urlOrNote?.startsWith('http') || (res as any).url ? '_blank' : '_self'}
                rel="noreferrer"
                className="p-4 rounded-2xl bg-white border border-[#E8E3DA] shadow-xs hover:border-[#D5CFC4] transition flex items-center justify-between group"
              >
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-[#111827] group-hover:text-purple-700 transition">
                    {res.name || (res as any).title}
                  </h4>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {res.description || res.category}
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-neutral-400 group-hover:text-purple-700 transition ml-2 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Subtle secondary action for starting fresh */}
      {onStartFresh && (
        <div
          id="dashboard-start-fresh-section"
          className="pt-6 sm:pt-8 mt-8 sm:mt-12 border-t border-[#EAE5DE] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-neutral-500"
        >
          <div className="space-y-0.5">
            <p className="font-semibold text-neutral-700">
              Changing your mind? That's completely okay.
            </p>
            <p className="text-neutral-500 text-[11px] leading-relaxed">
              Start a new discovery journey and we'll look at your direction with fresh eyes. Your previous achievements stay safely saved in history.
            </p>
          </div>
          <button
            id="dashboard-footer-start-fresh-btn"
            onClick={onStartFresh}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#FAF8F5] border border-[#E2DDD5] text-neutral-700 hover:text-neutral-900 transition text-xs font-medium shrink-0 shadow-xs active:scale-98"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Start Fresh</span>
          </button>
        </div>
      )}
    </div>
  );
};
