import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Check,
  Loader2,
  User,
  GraduationCap,
  Compass,
  Briefcase,
  BrainCircuit,
  ShieldAlert,
  Target,
  Mail,
  Zap
} from 'lucide-react';
import { OnboardingAnswers, UserProfile, Recommendation } from '../types';
import { DEFAULT_PROFILE, DEFAULT_RECOMMENDATIONS } from '../data/defaultDirections';

interface OnboardingFlowProps {
  userId: string;
  initialName?: string;
  initialDraft?: Partial<OnboardingAnswers> | null;
  initialStep?: number;
  onComplete: (profile: UserProfile, recommendations: Recommendation[], userMeta?: { fullName?: string; email?: string }) => void;
  onCancel: () => void;
  onDraftSave?: (step: number, draft: Partial<OnboardingAnswers>, name?: string, email?: string) => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  userId,
  initialName = '',
  initialDraft = null,
  initialStep = 0,
  onComplete,
  onCancel,
  onDraftSave
}) => {
  // Step 0: Welcome & Full Name
  // Steps 1-7: Single-question Discovery
  // Step 8: AI Synthesis Screen
  const [currentStep, setCurrentStep] = useState<number>(initialStep || 0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState<string>(initialDraft?.fullName || initialDraft?.name || initialName || '');
  const [email, setEmail] = useState<string>(initialDraft?.email || '');
  const [nameSubmitted, setNameSubmitted] = useState<boolean>(Boolean(initialDraft?.fullName || initialDraft?.name || initialName));

  const [ageRange, setAgeRange] = useState<string>(initialDraft?.ageRange || '18–21');
  const [educationStage, setEducationStage] = useState<string>(initialDraft?.educationStage || 'College / University Student');
  const [fieldOfStudy, setFieldOfStudy] = useState<string>(initialDraft?.fieldOfStudy || '');
  const [currentSkillLevel, setCurrentSkillLevel] = useState<string>(
    initialDraft?.currentSkillLevel || 'Absolute Beginner — Starting fresh with a clean slate'
  );
  const [existingSkills, setExistingSkills] = useState<string[]>(initialDraft?.existingSkills || []);
  const [curiousTopics, setCuriousTopics] = useState<string[]>(
    initialDraft?.curiousTopics?.length ? initialDraft.curiousTopics : []
  );
  const [careerGoal, setCareerGoal] = useState<string>(
    initialDraft?.careerGoal || 'Find genuine clarity on what direction actually fits me'
  );
  const [learningStyle, setLearningStyle] = useState<string>(
    initialDraft?.learningStyle || 'Hands-on building & mini-projects (Learn by doing)'
  );
  const [workStyle, setWorkStyle] = useState<string>(
    initialDraft?.workEnvironment || 'Deep focus alone with music on'
  );
  const [avoid, setAvoid] = useState<string>(
    initialDraft?.dislikedTasks?.[0] || 'Repetitive, mindless paperwork & bureaucracy'
  );
  const [freeformNotes, setFreeformNotes] = useState<string>(initialDraft?.freeformNotes || '');

  const totalDiscoveryQuestions = 7;

  // Auto-save draft when changing step
  const persistDraft = (stepNumber: number) => {
    const draftPayload: Partial<OnboardingAnswers> = {
      fullName: fullName.trim(),
      name: fullName.trim(),
      email: email.trim() || undefined,
      ageRange,
      educationStage,
      educationLevel: educationStage,
      fieldOfStudy: fieldOfStudy.trim() || undefined,
      currentSkillLevel,
      existingSkills,
      curiousTopics,
      careerGoal,
      learningStyle,
      workEnvironment: workStyle,
      dislikedTasks: [avoid],
      freeTimeActivities: curiousTopics,
      problemSolvingStyle: learningStyle,
      priorities: [careerGoal],
      freeformNotes: freeformNotes.trim() || undefined,
    };

    if (onDraftSave) {
      onDraftSave(stepNumber, draftPayload, fullName.trim(), email.trim() || undefined);
    }

    // Also persist directly to server
    fetch('/api/user/onboarding/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        step: stepNumber,
        draftAnswers: draftPayload,
        name: fullName.trim(),
        email: email.trim() || undefined,
      }),
    }).catch(err => console.warn('Silent draft save error:', err));
  };

  const handleNext = () => {
    if (currentStep === 0) {
      if (!fullName.trim()) return;
      setNameSubmitted(true);
      setCurrentStep(1);
      persistDraft(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (currentStep < totalDiscoveryQuestions) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      persistDraft(nextStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      generateRecommendations();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      persistDraft(prevStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (currentStep === 1) {
      setCurrentStep(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onCancel();
    }
  };

  const toggleMultiSelect = (
    item: string,
    currentList: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    max: number = 3
  ) => {
    if (currentList.includes(item)) {
      setList(currentList.filter(i => i !== item));
    } else {
      if (currentList.length < max) {
        setList([...currentList, item]);
      } else {
        setList([...currentList.slice(1), item]);
      }
    }
  };

  const generateRecommendations = async () => {
    setLoading(true);
    setError(null);

    const answers: OnboardingAnswers = {
      fullName: fullName.trim() || 'Explorer',
      name: fullName.trim() || 'Explorer',
      email: email.trim() || undefined,
      ageRange,
      educationStage,
      educationLevel: educationStage,
      fieldOfStudy: fieldOfStudy.trim() || undefined,
      currentSkillLevel,
      experienceLevel: currentSkillLevel,
      existingSkills,
      freeTimeActivities: curiousTopics.length > 0 ? curiousTopics : ['Exploring creative, analytical, and practical fields'],
      curiousTopics,
      careerGoal,
      learningStyle,
      dislikedTasks: [avoid],
      problemSolvingStyle: learningStyle,
      workEnvironment: workStyle,
      priorities: [careerGoal],
      freeformNotes: freeformNotes.trim() || undefined,
    };

    try {
      const response = await fetch('/api/ai/generate-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, answers }),
      });

      if (!response.ok) {
        throw new Error('Server returned an error');
      }

      const data = await response.json();
      if (data?.profile && Array.isArray(data?.recommendations) && data.recommendations.length > 0) {
        onComplete(data.profile, data.recommendations, { fullName: fullName.trim(), email: email.trim() });
      } else {
        onComplete(DEFAULT_PROFILE, DEFAULT_RECOMMENDATIONS, { fullName: fullName.trim(), email: email.trim() });
      }
    } catch (err: any) {
      console.warn('Falling back to tailored directions:', err?.message);
      setTimeout(() => {
        onComplete(DEFAULT_PROFILE, DEFAULT_RECOMMENDATIONS, { fullName: fullName.trim(), email: email.trim() });
      }, 700);
    } finally {
      setLoading(false);
    }
  };

  const displayName = fullName.trim() || 'Explorer';

  return (
    <div id="onboarding-flow-container" className="w-full max-w-2xl mx-auto px-4 py-8 sm:py-16 min-h-[82vh] flex flex-col justify-center">
      {loading ? (
        /* Synthesis & AI Matching Screen */
        <div id="onboarding-loading-state" className="p-8 sm:p-12 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs text-center space-y-6 animate-in fade-in">
          <div className="w-16 h-16 rounded-full bg-purple-50 text-purple-600 mx-auto flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Analyzing instincts & preferences</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#111827]">
              Synthesizing your profile, {displayName}...
            </h2>
            <p className="text-sm text-neutral-600 mt-2.5 max-w-md mx-auto leading-relaxed">
              Matching your curiosity in {curiousTopics.slice(0, 2).join(' & ')} with 3 clear, verified career pathways with zero guesswork.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-2 text-xs text-neutral-400 font-mono">
            <Zap className="w-3.5 h-3.5 text-purple-600" />
            <span>ORBIT Discovery Engine & PostgreSQL Persistence</span>
          </div>
        </div>
      ) : (
        <div className="w-full">
          {/* Top Progress Bar for Questions 1-7 */}
          {currentStep > 0 && (
            <div id="onboarding-progress-bar" className="mb-8 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                <button
                  id="onboarding-back-btn"
                  onClick={handleBack}
                  className="flex items-center gap-1 hover:text-neutral-900 transition font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-purple-700 font-semibold">{displayName}</span>
                  <span>•</span>
                  <span>Question {currentStep} of {totalDiscoveryQuestions}</span>
                </div>
              </div>
              <div className="w-full h-1.5 bg-[#EAE5DE] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#111827] rounded-full transition-all duration-300"
                  style={{ width: `${(currentStep / totalDiscoveryQuestions) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 0: WELCOME & FULL NAME FIRST                         */}
          {/* ========================================================= */}
          {currentStep === 0 && (
            <div id="onboarding-welcome-step" className="p-6 sm:p-10 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-7">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center mx-auto text-xl shadow-xs">
                  👋
                </div>
                <div>
                  <span className="text-xs uppercase font-semibold text-purple-700 tracking-wider">
                    Welcome to ORBIT
                  </span>
                  <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-[#111827] tracking-tight">
                    Everyone is running. But where are you going?
                  </h2>
                  <p className="mt-2.5 text-sm sm:text-base text-neutral-600 leading-relaxed max-w-lg mx-auto">
                    Let's find out what could be your next skill. No tests or judgment — just a few quick questions so you never waste months on a path you end up hating.
                  </p>
                </div>
              </div>

              {/* Name & Optional Email Inputs */}
              <div className="space-y-4 max-w-md mx-auto pt-1">
                <div>
                  <label htmlFor="user-full-name-input" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                    What should we call you? <span className="text-purple-600">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="user-full-name-input"
                      type="text"
                      autoFocus
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && fullName.trim() && handleNext()}
                      placeholder="Enter your full name (e.g., Aditya Sharma)"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-[#E8E3DA] focus:border-purple-600 focus:ring-2 focus:ring-purple-100 text-sm text-[#111827] placeholder:text-neutral-400 outline-none transition bg-[#FAF8F5]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="user-email-input" className="text-xs font-semibold text-neutral-800">
                      Email address
                    </label>
                    <span className="text-[11px] text-neutral-400">Optional (for cross-device access)</span>
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="user-email-input"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && fullName.trim() && handleNext()}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-[#E8E3DA] focus:border-purple-600 focus:ring-2 focus:ring-purple-100 text-sm text-[#111827] placeholder:text-neutral-400 outline-none transition bg-[#FAF8F5]"
                    />
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-1 pl-1">
                    Your profile will be securely saved to your ORBIT database account.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                <button
                  id="onboarding-begin-btn"
                  onClick={handleNext}
                  disabled={!fullName.trim()}
                  className="w-full px-7 py-3.5 rounded-full bg-[#111827] hover:bg-black text-white text-sm font-semibold transition shadow-xs flex items-center justify-center gap-2 group disabled:opacity-40"
                >
                  <span>Begin Discovery</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                </button>
                <button
                  id="onboarding-cancel-btn"
                  onClick={onCancel}
                  className="w-full sm:w-auto px-5 py-3 rounded-full text-neutral-500 hover:text-neutral-800 text-sm transition text-center"
                >
                  Explore as guest
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 1: CURRENT STAGE & AGE                               */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div id="onboarding-step-1" className="p-6 sm:p-10 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-6">
              <div>
                <span className="text-xs font-mono text-purple-700 uppercase tracking-wider">
                  01 / Foundation
                </span>
                <h2 className="mt-1 text-2xl font-bold text-[#111827]">
                  Where are you right now, {displayName}?
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  This helps calibrate your realistic time commitment and starting point.
                </p>
              </div>

              {/* Education Stage */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                  Current Stage
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {[
                    'High School Student (9th – 12th)',
                    'College / University Student (Undergrad / Postgrad)',
                    'Recent Graduate',
                    'Working Professional (Looking to level up or pivot)',
                    'Self-Taught Learner (Exploring independently)',
                  ].map(option => (
                    <button
                      key={option}
                      onClick={() => setEducationStage(option)}
                      className={`w-full p-4 rounded-2xl border text-left text-sm font-medium transition flex items-center justify-between ${
                        educationStage === option
                          ? 'border-purple-600 bg-purple-50/50 text-[#111827]'
                          : 'border-[#EAE5DE] hover:border-neutral-400 bg-white text-neutral-700'
                      }`}
                    >
                      <span>{option}</span>
                      {educationStage === option && <Check className="w-4 h-4 text-purple-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Age Range Pills */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                  Age Range
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Under 18', '18–21', '22–25', '26–30', '30+'].map(age => (
                    <button
                      key={age}
                      type="button"
                      onClick={() => setAgeRange(age)}
                      className={`px-4 py-2 rounded-xl text-xs font-medium border transition ${
                        ageRange === age
                          ? 'border-purple-600 bg-purple-600 text-white font-semibold'
                          : 'border-[#EAE5DE] bg-white text-neutral-700 hover:border-neutral-400'
                      }`}
                    >
                      {age}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  id="onboarding-step-1-continue"
                  onClick={handleNext}
                  className="px-7 py-3 rounded-full bg-[#111827] hover:bg-black text-white text-sm font-semibold transition flex items-center gap-2"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: FIELD OF STUDY / BACKGROUND                       */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <div id="onboarding-step-2" className="p-6 sm:p-10 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-6">
              <div>
                <span className="text-xs font-mono text-purple-700 uppercase tracking-wider">
                  02 / Academic Background
                </span>
                <h2 className="mt-1 text-2xl font-bold text-[#111827]">
                  What are you studying or what is your background?
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  Pick the closest match or type your specific stream / major.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  'Computer Science / IT',
                  'Engineering (Mechanical / Civil / Electrical)',
                  'Commerce / Business / Finance',
                  'Design / Arts / Media / Architecture',
                  'Pure Sciences / Biotechnology / Medicine',
                  'Humanities / Law / Social Sciences',
                  'High School (Science Stream)',
                  'High School (Commerce / Arts Stream)',
                ].map(field => {
                  const selected = fieldOfStudy === field;
                  return (
                    <button
                      key={field}
                      onClick={() => setFieldOfStudy(field)}
                      className={`p-3.5 rounded-2xl border text-left text-xs sm:text-sm font-medium transition flex items-center justify-between ${
                        selected
                          ? 'border-purple-600 bg-purple-50/50 text-[#111827]'
                          : 'border-[#EAE5DE] hover:border-neutral-400 bg-white text-neutral-700'
                      }`}
                    >
                      <span>{field}</span>
                      {selected && <Check className="w-4 h-4 text-purple-600 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>

              {/* Custom stream input */}
              <div className="pt-2">
                <label className="text-xs text-neutral-600 block mb-1">
                  Or enter your custom degree, stream, or background:
                </label>
                <input
                  type="text"
                  value={fieldOfStudy}
                  onChange={e => setFieldOfStudy(e.target.value)}
                  placeholder="e.g., B.Tech Data Science, BBA Marketing, Self-taught..."
                  className="w-full px-4 py-2.5 rounded-xl border border-[#EAE5DE] text-sm text-[#111827] focus:outline-none focus:border-purple-600 bg-[#FAF8F5]"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  id="onboarding-step-2-continue"
                  onClick={handleNext}
                  className="px-7 py-3 rounded-full bg-[#111827] hover:bg-black text-white text-sm font-semibold transition flex items-center gap-2"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: EXPERIENCE LEVEL & EXISTING SKILLS                */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div id="onboarding-step-3" className="p-6 sm:p-10 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-6">
              <div>
                <span className="text-xs font-mono text-purple-700 uppercase tracking-wider">
                  03 / Experience
                </span>
                <h2 className="mt-1 text-2xl font-bold text-[#111827]">
                  What is your experience level right now?
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  Be honest — ORBIT creates beginner-friendly paths with zero gatekeeping.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  {
                    title: 'Absolute Beginner',
                    desc: 'Starting completely fresh from scratch. No prior professional or field-specific experience.',
                  },
                  {
                    title: 'Familiar with Basics',
                    desc: 'Know core basics (introductory concepts, simple tools, or exploratory coursework).',
                  },
                  {
                    title: 'Intermediate Tinkerer',
                    desc: 'Have followed tutorials, built small hobby projects, or taken online courses.',
                  },
                  {
                    title: 'Experienced Professional / Upskilling',
                    desc: 'Have worked professionally and looking to pivot or master a complementary skill.',
                  },
                ].map(lvl => (
                  <button
                    key={lvl.title}
                    onClick={() => setCurrentSkillLevel(lvl.title)}
                    className={`w-full p-4 rounded-2xl border text-left transition flex items-start justify-between ${
                      currentSkillLevel.includes(lvl.title)
                        ? 'border-purple-600 bg-purple-50/50 text-[#111827]'
                        : 'border-[#EAE5DE] hover:border-neutral-400 bg-white text-neutral-700'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-sm text-[#111827]">{lvl.title}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">{lvl.desc}</div>
                    </div>
                    {currentSkillLevel.includes(lvl.title) && (
                      <Check className="w-4 h-4 text-purple-600 shrink-0 ml-2 mt-1" />
                    )}
                  </button>
                ))}
              </div>

              {/* Existing skills selector */}
              <div className="pt-3 space-y-2">
                <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                  Any existing skills you already touch? (Optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Writing & Editorial Storytelling',
                    'Visual Aesthetics / Canva / Figma',
                    'Business & Marketing Strategy',
                    'Finance & Spreadsheet Analysis',
                    'People Empathy & Active Listening',
                    'Scientific & Laboratory Research',
                    'Basic Coding / Web Development',
                    'Public Speaking & Debate',
                    'Clean slate (No existing skills yet)',
                  ].map(skill => {
                    const selected = existingSkills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleMultiSelect(skill, existingSkills, setExistingSkills, 4)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 ${
                          selected
                            ? 'border-purple-600 bg-purple-100 text-purple-800 font-semibold'
                            : 'border-[#EAE5DE] bg-white text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 text-purple-600" />}
                        <span>{skill}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  id="onboarding-step-3-continue"
                  onClick={handleNext}
                  className="px-7 py-3 rounded-full bg-[#111827] hover:bg-black text-white text-sm font-semibold transition flex items-center gap-2"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4: CURIOSITY & TOPICS OF INTEREST                    */}
          {/* ========================================================= */}
          {currentStep === 4 && (
            <div id="onboarding-step-4" className="p-6 sm:p-10 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-6">
              <div>
                <span className="text-xs font-mono text-purple-700 uppercase tracking-wider">
                  04 / Curiosity
                </span>
                <h2 className="mt-1 text-2xl font-bold text-[#111827]">
                  What topics spark your natural curiosity?
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  Select up to 3 fields that make you want to open a new browser tab.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { label: 'Business, Startups & Entrepreneurship', icon: '💼' },
                  { label: 'UI/UX, Product & Visual Design', icon: '🎨' },
                  { label: 'Psychology, Human Behavior & People', icon: '🧠' },
                  { label: 'Finance, Investing & Economics', icon: '📈' },
                  { label: 'Media, Journalism & Storytelling', icon: '✍️' },
                  { label: 'Healthcare, Medicine & Life Sciences', icon: '🩺' },
                  { label: 'AI, Computing & Intelligent Systems', icon: '💻' },
                  { label: 'Law, Public Policy & Governance', icon: '⚖️' },
                  { label: 'Architecture, Interior & Space Design', icon: '🏛️' },
                  { label: 'Physical Sciences & Sustainable Tech', icon: '🔬' },
                  { label: 'Game Design & Interactive Worlds', icon: '🎮' },
                  { label: 'Education & Community Leadership', icon: '📚' },
                ].map(item => {
                  const selected = curiousTopics.includes(item.label);
                  return (
                    <button
                      key={item.label}
                      onClick={() => toggleMultiSelect(item.label, curiousTopics, setCuriousTopics, 3)}
                      className={`p-3.5 rounded-2xl border text-left text-xs sm:text-sm font-medium transition flex items-center justify-between ${
                        selected
                          ? 'border-purple-600 bg-purple-50/50 text-[#111827]'
                          : 'border-[#EAE5DE] hover:border-neutral-400 bg-white text-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      {selected && <Check className="w-4 h-4 text-purple-600 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 flex items-center justify-between">
                <span className="text-xs text-neutral-500">
                  {curiousTopics.length === 0 ? 'Select at least 1 area' : `${curiousTopics.length} of 3 selected`}
                </span>
                <button
                  id="onboarding-step-4-continue"
                  onClick={handleNext}
                  disabled={curiousTopics.length === 0}
                  className="px-7 py-3 rounded-full bg-[#111827] hover:bg-black text-white text-sm font-semibold transition flex items-center gap-2 disabled:opacity-40"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 5: CAREER GOALS & OUTCOMES                           */}
          {/* ========================================================= */}
          {currentStep === 5 && (
            <div id="onboarding-step-5" className="p-6 sm:p-10 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-6">
              <div>
                <span className="text-xs font-mono text-purple-700 uppercase tracking-wider">
                  05 / Intention
                </span>
                <h2 className="mt-1 text-2xl font-bold text-[#111827]">
                  What is your primary goal right now?
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  What would make the next 6 months an absolute success for you?
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  'Land a high-growth first job or internship',
                  'Build & launch my own independent products / startup',
                  'Master a high-paying freelance skill with remote freedom',
                  'Find genuine clarity on which direction actually fits me',
                  'Upskill and switch into a more creative, future-proof field',
                ].map(option => (
                  <button
                    key={option}
                    onClick={() => setCareerGoal(option)}
                    className={`w-full p-4 rounded-2xl border text-left text-sm font-medium transition flex items-center justify-between ${
                      careerGoal === option
                        ? 'border-purple-600 bg-purple-50/50 text-[#111827]'
                        : 'border-[#EAE5DE] hover:border-neutral-400 bg-white text-neutral-700'
                    }`}
                  >
                    <span>{option}</span>
                    {careerGoal === option && <Check className="w-4 h-4 text-purple-600 shrink-0" />}
                  </button>
                ))}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  id="onboarding-step-5-continue"
                  onClick={handleNext}
                  className="px-7 py-3 rounded-full bg-[#111827] hover:bg-black text-white text-sm font-semibold transition flex items-center gap-2"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 6: LEARNING STYLE & WORK COMFORT                     */}
          {/* ========================================================= */}
          {currentStep === 6 && (
            <div id="onboarding-step-6" className="p-6 sm:p-10 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-6">
              <div>
                <span className="text-xs font-mono text-purple-700 uppercase tracking-wider">
                  06 / Learning Style
                </span>
                <h2 className="mt-1 text-2xl font-bold text-[#111827]">
                  How do you learn and build best?
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  We'll tailor your roadmap milestones to match how your brain actually operates.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                  Preferred Learning Approach
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {[
                    'Hands-on building & mini-projects (Learn by doing immediately)',
                    'Step-by-step visual roadmaps & structured checklists',
                    'Experimentation & tinkering (Figure things out by breaking them)',
                    'Deep conceptual reading & structured foundational notes',
                  ].map(style => (
                    <button
                      key={style}
                      onClick={() => setLearningStyle(style)}
                      className={`w-full p-4 rounded-2xl border text-left text-sm font-medium transition flex items-center justify-between ${
                        learningStyle === style
                          ? 'border-purple-600 bg-purple-50/50 text-[#111827]'
                          : 'border-[#EAE5DE] hover:border-neutral-400 bg-white text-neutral-700'
                      }`}
                    >
                      <span>{style}</span>
                      {learningStyle === style && <Check className="w-4 h-4 text-purple-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                  Ideal Work Atmosphere
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'Deep focus alone with music on',
                    'Small, tight-knit creative team',
                    'Flexible remote setup from anywhere',
                    'Fast-paced, experimental and collaborative',
                  ].map(ws => (
                    <button
                      key={ws}
                      onClick={() => setWorkStyle(ws)}
                      className={`p-3 rounded-xl border text-left text-xs font-medium transition flex items-center justify-between ${
                        workStyle === ws
                          ? 'border-purple-600 bg-purple-50 text-purple-900 font-semibold'
                          : 'border-[#EAE5DE] bg-white text-neutral-600 hover:border-neutral-300'
                      }`}
                    >
                      <span>{ws}</span>
                      {workStyle === ws && <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  id="onboarding-step-6-continue"
                  onClick={handleNext}
                  className="px-7 py-3 rounded-full bg-[#111827] hover:bg-black text-white text-sm font-semibold transition flex items-center gap-2"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 7: DEALBREAKERS & FINAL NOTE                         */}
          {/* ========================================================= */}
          {currentStep === 7 && (
            <div id="onboarding-step-7" className="p-6 sm:p-10 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-6">
              <div>
                <span className="text-xs font-mono text-purple-700 uppercase tracking-wider">
                  07 / Alignment
                </span>
                <h2 className="mt-1 text-2xl font-bold text-[#111827]">
                  What do you definitely want to avoid?
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  Knowing what drains you is just as important as knowing what you like.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  'Repetitive, mindless paperwork & bureaucracy',
                  'High-pressure cold sales & aggressive quotas',
                  'Pure abstract theory with zero practical creation',
                  'Rigid micromanagement with zero creative voice',
                  'Sitting in 5 endless corporate meetings every single day',
                ].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setAvoid(opt)}
                    className={`w-full p-4 rounded-2xl border text-left text-sm font-medium transition flex items-center justify-between ${
                      avoid === opt
                        ? 'border-purple-600 bg-purple-50/50 text-[#111827]'
                        : 'border-[#EAE5DE] hover:border-neutral-400 bg-white text-neutral-700'
                    }`}
                  >
                    <span>{opt}</span>
                    {avoid === opt && <Check className="w-4 h-4 text-purple-600 shrink-0" />}
                  </button>
                ))}
              </div>

              {/* Optional personal note */}
              <div className="pt-2">
                <label className="text-xs text-neutral-600 block mb-1">
                  Anything specific on your mind or a dream role you're aiming for? (Optional)
                </label>
                <input
                  type="text"
                  value={freeformNotes}
                  onChange={e => setFreeformNotes(e.target.value)}
                  placeholder="e.g., Want to build AI apps, love clean typography, or want to freelance..."
                  className="w-full px-4 py-3 rounded-2xl border border-[#EAE5DE] text-sm text-[#111827] focus:outline-none focus:border-purple-600 bg-[#FAF8F5]"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  id="onboarding-complete-reveal-btn"
                  onClick={generateRecommendations}
                  className="px-8 py-3.5 rounded-full bg-[#111827] hover:bg-black text-white text-sm font-semibold transition flex items-center gap-2 shadow-xs group"
                >
                  <Sparkles className="w-4 h-4 text-purple-300" />
                  <span>Reveal My 3 Personalized Directions</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
