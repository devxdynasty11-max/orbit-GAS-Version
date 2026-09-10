import React, { useState, useEffect } from 'react';
import { UserProgressState, UserProfile, Recommendation, RoadmapStage } from './types';
import {
  DEFAULT_PROFILE,
  DEFAULT_RECOMMENDATIONS,
  DEFAULT_ROADMAPS,
  DEFAULT_RESOURCES,
  DEFAULT_PROJECTS
} from './data/defaultDirections';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { OnboardingFlow } from './components/OnboardingFlow';
import { RecommendationsView } from './components/RecommendationsView';
import { ChallengeModal } from './components/ChallengeModal';
import { DashboardView } from './components/DashboardView';
import { AIMentorChat } from './components/AIMentorChat';
import { Footer } from './components/Footer';

const STORAGE_KEY = 'orbit_user_progress_v1';

const getInitialState = (): UserProgressState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load saved ORBIT state:', err);
  }

  return {
    onboardingCompleted: false,
    profile: null,
    recommendations: [],
    selectedDirectionId: null,
    selectedDirection: null,
    completedChallengeIds: [],
    challengeReflections: {},
    roadmap: [],
    resources: DEFAULT_RESOURCES,
    projects: DEFAULT_PROJECTS,
    completedTaskIds: [],
    completedProjectIds: [],
    recentActivities: [],
  };
};

export default function App() {
  const [userState, setUserState] = useState<UserProgressState>(getInitialState);
  const [currentView, setCurrentView] = useState<'landing' | 'onboarding' | 'recommendations' | 'dashboard'>(() => {
    const saved = getInitialState();
    if (saved.selectedDirection) return 'dashboard';
    if (saved.onboardingCompleted) return 'recommendations';
    return 'landing';
  });

  const [activeChallengeRec, setActiveChallengeRec] = useState<Recommendation | null>(null);
  const [isMentorOpen, setIsMentorOpen] = useState<boolean>(false);

  // Sync initial state from PostgreSQL on mount
  useEffect(() => {
    fetch('/api/user/state?userId=default-explorer')
      .then(res => res.json())
      .then(dbState => {
        if (dbState && dbState.onboardingCompleted) {
          setUserState(prev => ({
            ...prev,
            ...dbState,
            resources: dbState.resources?.length ? dbState.resources : prev.resources,
            projects: dbState.projects?.length ? dbState.projects : prev.projects,
          }));
          if (dbState.selectedDirection) {
            setCurrentView('dashboard');
          } else if (dbState.onboardingCompleted) {
            setCurrentView('recommendations');
          }
        }
      })
      .catch(err => console.log('Using local client state until server sync:', err.message));
  }, []);

  // Sync state changes with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userState));
    } catch (err) {
      console.warn('Failed to persist ORBIT state:', err);
    }
  }, [userState]);

  // Log activity helper
  const addActivity = (text: string) => {
    const newAct = {
      id: `act-${Date.now()}`,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setUserState(prev => ({
      ...prev,
      recentActivities: [newAct, ...prev.recentActivities.slice(0, 15)],
    }));
  };

  // 1. Onboarding completion handler
  const handleOnboardingComplete = (profile: UserProfile, recommendations: Recommendation[]) => {
    setUserState(prev => ({
      ...prev,
      onboardingCompleted: true,
      profile,
      recommendations,
    }));
    addActivity('Discovered 3 personalized career & skill possibilities');

    // Persist to PostgreSQL
    fetch('/api/user/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'default-explorer',
        answers: { profileHeadline: profile.headline, strengths: profile.naturalStrengths },
        profile,
        recommendations,
      }),
    }).catch(e => console.warn('Could not sync onboarding to PostgreSQL:', e));

    setCurrentView('recommendations');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 2. Challenge completion handler
  const handleCompleteChallenge = (
    recId: string,
    submission: {
      userSubmission: string;
      enjoyed: string;
      easy: string;
      frustrating: string;
      aiFeedback: string;
    }
  ) => {
    setUserState(prev => {
      const isAlreadyCompleted = prev.completedChallengeIds.includes(recId);
      const updatedIds = isAlreadyCompleted
        ? prev.completedChallengeIds
        : [...prev.completedChallengeIds, recId];

      return {
        ...prev,
        completedChallengeIds: updatedIds,
        challengeReflections: {
          ...prev.challengeReflections,
          [recId]: submission,
        },
      };
    });

    const rec = userState.recommendations.find(r => r.id === recId) || activeChallengeRec;
    addActivity(`Completed practical 5-min challenge for ${rec?.directionName || 'skill'}`);

    // Persist reflection to PostgreSQL
    fetch('/api/user/challenge-reflection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'default-explorer',
        recommendationId: recId,
        submission,
      }),
    }).catch(e => console.warn('Could not sync challenge reflection to PostgreSQL:', e));
  };

  // 3. Direction selection & roadmap generation handler
  const handleSelectDirection = async (rec: Recommendation) => {
    // Generate personalized 7-stage roadmap
    let roadmapStages: RoadmapStage[] = DEFAULT_ROADMAPS[rec.id] || DEFAULT_ROADMAPS['dir-frontend'];

    try {
      const res = await fetch('/api/ai/generate-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: rec,
          profile: userState.profile,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.roadmap) && data.roadmap.length > 0) {
          roadmapStages = data.roadmap;
        }
      }
    } catch (err) {
      console.warn('Roadmap API call fell back to curated blueprint:', err);
    }

    setUserState(prev => ({
      ...prev,
      selectedDirectionId: rec.id,
      selectedDirection: rec,
      roadmap: roadmapStages,
    }));

    addActivity(`Selected direction: ${rec.directionName}`);

    // Persist selected path & roadmap to PostgreSQL
    fetch('/api/user/select-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'default-explorer',
        recommendation: rec,
        roadmap: roadmapStages,
      }),
    }).catch(e => console.warn('Could not sync selected path to PostgreSQL:', e));

    setCurrentView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 4. Task toggle handler
  const handleToggleTask = (taskId: string) => {
    const isCurrentlyDone = userState.completedTaskIds.includes(taskId);
    const willBeDone = !isCurrentlyDone;

    setUserState(prev => {
      const updated = willBeDone
        ? [...prev.completedTaskIds, taskId]
        : prev.completedTaskIds.filter(id => id !== taskId);

      return {
        ...prev,
        completedTaskIds: updated,
      };
    });

    const task = userState.roadmap.flatMap(s => s.tasks).find(t => t.id === taskId);
    if (task && willBeDone) {
      addActivity(`Checked off task: "${task.text}"`);
    }

    // Persist task toggle to PostgreSQL
    fetch('/api/user/task-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'default-explorer',
        taskId,
        isCompleted: willBeDone,
      }),
    }).catch(e => console.warn('Could not sync task to PostgreSQL:', e));
  };

  // 5. Project toggle handler
  const handleToggleProject = (projectId: string) => {
    const isCurrentlyDone = userState.completedProjectIds.includes(projectId);
    const willBeDone = !isCurrentlyDone;

    setUserState(prev => {
      const updated = willBeDone
        ? [...prev.completedProjectIds, projectId]
        : prev.completedProjectIds.filter(id => id !== projectId);

      return {
        ...prev,
        completedProjectIds: updated,
      };
    });

    const project = userState.projects.find(p => p.id === projectId);
    if (project && willBeDone) {
      addActivity(`Completed project build: "${project.title}"`);
    }

    // Persist project toggle to PostgreSQL
    fetch('/api/user/project-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'default-explorer',
        projectId,
        isCompleted: willBeDone,
      }),
    }).catch(e => console.warn('Could not sync project to PostgreSQL:', e));
  };

  // 6. State Export (JSON file)
  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(userState, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `orbit_journey_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 7. State Import (JSON file)
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === 'object') {
          setUserState(parsed);
          alert('Your ORBIT journey was successfully loaded!');
          if (parsed.selectedDirection) setCurrentView('dashboard');
          else if (parsed.onboardingCompleted) setCurrentView('recommendations');
        }
      } catch (err) {
        alert('Invalid file format. Please upload an ORBIT journey JSON file.');
      }
    };
    reader.readAsText(file);
  };

  // 8. Reset journey handler
  const handleReset = () => {
    if (confirm('Are you sure you want to start a fresh discovery? Your current progress will be reset.')) {
      localStorage.removeItem(STORAGE_KEY);
      setUserState({
        onboardingCompleted: false,
        profile: null,
        recommendations: [],
        selectedDirectionId: null,
        selectedDirection: null,
        completedChallengeIds: [],
        challengeReflections: {},
        roadmap: [],
        resources: DEFAULT_RESOURCES,
        projects: DEFAULT_PROJECTS,
        completedTaskIds: [],
        completedProjectIds: [],
        recentActivities: [],
      });
      setCurrentView('landing');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#111827] flex flex-col justify-between selection:bg-purple-100 selection:text-purple-900 pb-16 md:pb-0">
      {/* Navigation Header */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        userState={userState}
        onOpenMentor={() => setIsMentorOpen(true)}
        onReset={handleReset}
        onExport={handleExport}
        onImport={handleImport}
      />

      {/* Main Content Area based on current view */}
      <main className="flex-1 w-full">
        {currentView === 'landing' && (
          <LandingPage
            onStart={() => {
              if (userState.selectedDirection) {
                setCurrentView('dashboard');
              } else if (userState.onboardingCompleted) {
                setCurrentView('recommendations');
              } else {
                setCurrentView('onboarding');
              }
            }}
            onOpenMentor={() => setIsMentorOpen(true)}
          />
        )}

        {currentView === 'onboarding' && (
          <OnboardingFlow
            onComplete={handleOnboardingComplete}
            onCancel={() => setCurrentView('landing')}
          />
        )}

        {currentView === 'recommendations' && (
          <RecommendationsView
            profile={userState.profile || DEFAULT_PROFILE}
            recommendations={
              userState.recommendations.length > 0 ? userState.recommendations : DEFAULT_RECOMMENDATIONS
            }
            completedChallengeIds={userState.completedChallengeIds}
            onOpenChallenge={rec => setActiveChallengeRec(rec)}
            onSelectDirection={handleSelectDirection}
            onOpenMentor={() => setIsMentorOpen(true)}
          />
        )}

        {currentView === 'dashboard' && (
          <DashboardView
            userState={userState}
            onToggleTask={handleToggleTask}
            onToggleProject={handleToggleProject}
            onOpenMentor={() => setIsMentorOpen(true)}
            onChangeDirection={() => setCurrentView('recommendations')}
          />
        )}
      </main>

      {/* "Try Before You Commit" Challenge Modal */}
      {activeChallengeRec && (
        <ChallengeModal
          recommendation={activeChallengeRec}
          onClose={() => setActiveChallengeRec(null)}
          onCompleteChallenge={handleCompleteChallenge}
        />
      )}

      {/* AI Mentor Persistent Chat Drawer */}
      <AIMentorChat
        isOpen={isMentorOpen}
        onClose={() => setIsMentorOpen(false)}
        userState={userState}
      />

      {/* Mobile-First Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FAF8F5]/95 backdrop-blur-md border-t border-[#EAE5DE] px-4 py-2 flex items-center justify-around shadow-sm">
        <button
          onClick={() => setCurrentView('landing')}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-medium py-1 px-3 rounded-xl transition ${
            currentView === 'landing' ? 'text-[#111827] font-bold' : 'text-neutral-500'
          }`}
        >
          <span>Home</span>
        </button>

        <button
          onClick={() => {
            if (userState.onboardingCompleted) {
              setCurrentView('recommendations');
            } else {
              setCurrentView('onboarding');
            }
          }}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-medium py-1 px-3 rounded-xl transition ${
            currentView === 'onboarding' || currentView === 'recommendations'
              ? 'text-[#111827] font-bold'
              : 'text-neutral-500'
          }`}
        >
          <span>{userState.onboardingCompleted ? '3 Paths' : 'Discover'}</span>
        </button>

        {userState.selectedDirection && (
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`flex flex-col items-center gap-0.5 text-[11px] font-medium py-1 px-3 rounded-xl transition ${
              currentView === 'dashboard' ? 'text-[#111827] font-bold' : 'text-neutral-500'
            }`}
          >
            <span>Roadmap</span>
          </button>
        )}

        <button
          onClick={() => setIsMentorOpen(true)}
          className="flex flex-col items-center gap-0.5 text-[11px] font-medium py-1 px-3 rounded-xl text-purple-700 font-semibold transition"
        >
          <span>AI Mentor</span>
        </button>
      </div>

      {/* Footer */}
      <Footer
        onStartOnboarding={() => setCurrentView('onboarding')}
        onOpenMentor={() => setIsMentorOpen(true)}
      />
    </div>
  );
}
