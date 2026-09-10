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
  ChevronRight
} from 'lucide-react';
import { UserProgressState, RoadmapStage, ProjectItem, LearningResource } from '../types';

interface DashboardViewProps {
  userState: UserProgressState;
  onToggleTask: (taskId: string) => void;
  onToggleProject: (projectId: string) => void;
  onOpenMentor: () => void;
  onChangeDirection: () => void;
  onStartFresh?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  userState,
  onToggleTask,
  onToggleProject,
  onOpenMentor,
  onChangeDirection,
  onStartFresh,
}) => {
  const [activeTab, setActiveTab] = useState<'roadmap' | 'projects' | 'resources'>('roadmap');
  const [currentStageIdx, setCurrentStageIdx] = useState<number>(0);

  const direction = userState.selectedDirection;
  const roadmap = userState.roadmap || [];
  const projects = userState.projects || [];
  const resources = userState.resources || [];
  const completedTasks = userState.completedTaskIds || [];
  const completedProjects = userState.completedProjectIds || [];

  // Calculate overall progress
  const allTasks = roadmap.flatMap(s => s.tasks);
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

  if (!direction) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-4">
        <h3 className="text-xl font-bold text-[#111827]">No direction chosen yet</h3>
        <p className="text-sm text-neutral-600">
          Discover your 3 possibilities first to generate your custom roadmap.
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
    <div className="w-full max-w-3xl mx-auto py-8 sm:py-14 px-4 sm:px-6 space-y-8">
      {/* 1. ABOVE THE FOLD: Minimal Greeting & Path Summary */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-500">
            Good day 👋
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onChangeDirection}
              className="text-xs text-neutral-500 hover:text-neutral-900 transition flex items-center gap-1"
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
                  className="text-xs text-neutral-400 hover:text-neutral-700 transition flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  <span>Start Fresh</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-purple-700 font-semibold block mb-1">
            Current Direction
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111827] tracking-tight">
            {direction.directionName}
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            {direction.tagline}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs text-neutral-600 font-medium">
            <span>Overall Roadmap Progress</span>
            <span className="font-mono">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 bg-[#EAE5DE] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#111827] rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. TODAY'S FOCUS: One single clear task (No overwhelm!) */}
      {todaysFocusTask && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-purple-700">
              Today's Focus
            </span>
            <button
              onClick={onOpenMentor}
              className="text-xs text-purple-700 hover:text-purple-900 font-medium inline-flex items-center gap-1"
            >
              <MessageSquare className="w-3 h-3" />
              <span>Need help?</span>
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
            <div className="flex-1">
              <p
                onClick={() => handleTaskClick(todaysFocusTask.id)}
                className={`text-sm sm:text-base font-semibold cursor-pointer select-none leading-snug ${
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

      {/* 3. NAVIGATION TABS (Roadmap, Projects, Resources) */}
      <div className="flex items-center gap-2 border-b border-[#EAE5DE] pb-2 text-xs font-medium">
        <button
          onClick={() => setActiveTab('roadmap')}
          className={`px-3 py-1.5 rounded-full transition ${
            activeTab === 'roadmap'
              ? 'bg-[#111827] text-white'
              : 'text-neutral-600 hover:text-black hover:bg-[#F3EFEA]'
          }`}
        >
          Current Phase ({currentStageIdx + 1}/{roadmap.length || 1})
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-3 py-1.5 rounded-full transition ${
            activeTab === 'projects'
              ? 'bg-[#111827] text-white'
              : 'text-neutral-600 hover:text-black hover:bg-[#F3EFEA]'
          }`}
        >
          Projects ({projects.length})
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          className={`px-3 py-1.5 rounded-full transition ${
            activeTab === 'resources'
              ? 'bg-[#111827] text-white'
              : 'text-neutral-600 hover:text-black hover:bg-[#F3EFEA]'
          }`}
        >
          Tools &amp; Links
        </button>
      </div>

      {/* TAB CONTENT 1: ROADMAP (Current Phase Only - Progressive Disclosure) */}
      {activeTab === 'roadmap' && currentStage && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono text-purple-700 uppercase tracking-wider">
                Phase 0{currentStage.stageNumber}
              </span>
              <h3 className="text-lg font-bold text-[#111827]">
                {currentStage.title}
              </h3>
              <p className="text-xs text-neutral-600 mt-0.5">
                {currentStage.estimatedTime}
              </p>
            </div>

            {/* Stage Selector Pagination */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentStageIdx(prev => Math.max(0, prev - 1))}
                disabled={currentStageIdx === 0}
                className="p-1.5 rounded-full border border-[#E2DDD5] text-neutral-600 hover:text-black disabled:opacity-30 disabled:hover:text-neutral-600"
                title="Previous phase"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono px-2 text-neutral-500">
                {currentStageIdx + 1} / {roadmap.length}
              </span>
              <button
                onClick={() => setCurrentStageIdx(prev => Math.min(roadmap.length - 1, prev + 1))}
                disabled={currentStageIdx === roadmap.length - 1}
                className="p-1.5 rounded-full border border-[#E2DDD5] text-neutral-600 hover:text-black disabled:opacity-30 disabled:hover:text-neutral-600"
                title="Next phase"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Simple Checklist for Current Phase */}
          <div className="rounded-3xl bg-white border border-[#E8E3DA] p-4 sm:p-6 shadow-xs space-y-3">
            {currentStage.tasks.map(task => {
              const isCompleted = completedTasks.includes(task.id);
              return (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task.id)}
                  className="p-3 rounded-2xl hover:bg-[#FAF8F5] transition flex items-start gap-3 cursor-pointer select-none"
                >
                  <button
                    className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center transition shrink-0 ${
                      isCompleted
                        ? 'bg-[#111827] border-[#111827] text-white'
                        : 'border-neutral-300 bg-white text-transparent'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <span
                    className={`text-xs sm:text-sm leading-relaxed ${
                      isCompleted ? 'line-through text-neutral-400' : 'text-[#111827] font-medium'
                    }`}
                  >
                    {task.text}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Stage switch hints */}
          <div className="flex justify-between items-center text-xs text-neutral-500 pt-1">
            <span>
              {currentStage.tasks.filter(t => completedTasks.includes(t.id)).length} of{' '}
              {currentStage.tasks.length} tasks done in this phase
            </span>
            {currentStageIdx < roadmap.length - 1 && (
              <button
                onClick={() => setCurrentStageIdx(prev => prev + 1)}
                className="text-purple-700 hover:text-purple-900 font-medium inline-flex items-center gap-1"
              >
                <span>View next phase</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: PROJECTS (3 Tangible Milestones) */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[#111827]">
              Build Real Projects
            </h3>
            <p className="text-xs text-neutral-600 mt-0.5">
              The fastest way to learn is by creating things you can show off.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {projects.map((proj, idx) => {
              const isCompleted = completedProjects.includes(proj.id);
              return (
                <div
                  key={proj.id || idx}
                  className="p-5 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">
                      {proj.difficulty}
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
                    {proj.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {proj.skillsUsed.map((s, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-[#FAF8F5] text-[10px] text-neutral-500 font-mono"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
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
              Beginner-friendly starting points curated for this direction.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {resources.map((res, idx) => (
              <a
                key={res.id || idx}
                href={res.url}
                target="_blank"
                rel="noreferrer"
                className="p-4 rounded-2xl bg-white border border-[#E8E3DA] shadow-xs hover:border-[#D5CFC4] transition flex items-center justify-between group"
              >
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-[#111827] group-hover:text-purple-700 transition">
                    {res.title}
                  </h4>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {res.description}
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
          className="pt-8 mt-12 border-t border-[#EAE5DE] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-neutral-500"
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
