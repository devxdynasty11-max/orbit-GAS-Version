import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Check,
  Loader2,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { OnboardingAnswers, UserProfile, Recommendation } from '../types';
import { DEFAULT_PROFILE, DEFAULT_RECOMMENDATIONS } from '../data/defaultDirections';

interface OnboardingFlowProps {
  onComplete: (profile: UserProfile, recommendations: Recommendation[]) => void;
  onCancel: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, onCancel }) => {
  // Step 0: Welcome greeting
  // Steps 1-6: Single conversational questions
  // Step 7: Final check / AI generation
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Answers state
  const [education, setEducation] = useState<string>('High School Student');
  const [enjoyment, setEnjoyment] = useState<string[]>([]);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [workStyle, setWorkStyle] = useState<string>('Deep focus alone with music on');
  const [avoid, setAvoid] = useState<string>('Repetitive, mindless paperwork');
  const [priority, setPriority] = useState<string>('Creative freedom & building cool stuff');
  const [freeformNotes, setFreeformNotes] = useState<string>('');

  const totalQuestions = 6;

  const toggleMultiSelect = (item: string, currentList: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (currentList.includes(item)) {
      setList(currentList.filter(i => i !== item));
    } else {
      if (currentList.length < 3) {
        setList([...currentList, item]);
      } else {
        // Replace oldest or keep max 3
        setList([...currentList.slice(1), item]);
      }
    }
  };

  const handleNext = () => {
    if (currentStep < totalQuestions) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      generateRecommendations();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onCancel();
    }
  };

  const generateRecommendations = async () => {
    setLoading(true);
    setError(null);

    const answers: OnboardingAnswers = {
      educationStage: education,
      freeTimeActivities: enjoyment.length > 0 ? enjoyment : ['Building things on phone or computer'],
      dislikedTasks: [avoid],
      problemSolvingStyle: strengths.length > 0 ? strengths.join(', ') : 'Visual intuition',
      workEnvironment: workStyle,
      priorities: [priority],
      currentSkillLevel: 'Beginner ready to start fresh',
      freeformNotes: freeformNotes.trim() || undefined,
    };

    try {
      const response = await fetch('/api/ai/generate-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) {
        throw new Error('Could not connect to AI service');
      }

      const data = await response.json();
      if (data.profile && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
        onComplete(data.profile, data.recommendations);
      } else {
        onComplete(DEFAULT_PROFILE, DEFAULT_RECOMMENDATIONS);
      }
    } catch (err: any) {
      console.warn('Using intelligent fallback recommendations:', err.message);
      // Ensure smooth seamless experience even with slow network
      setTimeout(() => {
        onComplete(DEFAULT_PROFILE, DEFAULT_RECOMMENDATIONS);
      }, 900);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 sm:py-16 min-h-[80vh] flex flex-col justify-center">
      {/* Loading Screen during AI Generation */}
      {loading ? (
        <div className="p-8 sm:p-12 rounded-3xl bg-white border border-[#E8E3DA] shadow-sm text-center space-y-6 animate-in fade-in">
          <div className="w-16 h-16 rounded-full bg-purple-50 text-purple-600 mx-auto flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#111827]">
              Synthesizing your instincts...
            </h2>
            <p className="text-sm text-neutral-600 mt-2 max-w-sm mx-auto leading-relaxed">
              We're analyzing what you naturally enjoy and matching you with 3 clear, realistic directions.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-neutral-400 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
            <span>Consulting NVIDIA Llama-3.1 70B</span>
          </div>
        </div>
      ) : (
        <div className="w-full">
          {/* Subtle Progress Bar & Step Tracker */}
          {currentStep > 0 && (
            <div className="mb-8 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-600">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 hover:text-neutral-900 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <span>
                  Question {currentStep} of {totalQuestions}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#EAE5DE] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#111827] rounded-full transition-all duration-300"
                  style={{ width: `${(currentStep / totalQuestions) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* STEP 0: Warm Conversational Greeting */}
          {currentStep === 0 && (
            <div className="p-6 sm:p-10 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-6 text-center">
              <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center mx-auto text-xl">
                👋
              </div>
              <div>
                <span className="text-xs uppercase font-semibold text-purple-700 tracking-wider">
                  Quick Discovery
                </span>
                <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-[#111827]">
                  Let's figure this out together.
                </h2>
                <p className="mt-3 text-sm sm:text-base text-neutral-600 leading-relaxed max-w-md mx-auto">
                  No tests. No grades. No wrong answers. Just 6 short questions to understand what you actually like, so you don't waste time on skills you'll hate.
                </p>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleNext}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-[#111827] hover:bg-black text-white text-sm font-medium transition shadow-xs flex items-center justify-center gap-2 group"
                >
                  <span>Let's begin</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                </button>
                <button
                  onClick={onCancel}
                  className="w-full sm:w-auto px-5 py-3.5 rounded-full text-neutral-500 hover:text-neutral-800 text-sm transition"
                >
                  Back to overview
                </button>
              </div>
            </div>
          )}

          {/* QUESTION 1: Where are you currently at? */}
          {currentStep === 1 && (
            <div className="p-6 sm:p-10 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-6">
              <div>
                <span className="text-xs font-mono text-purple-700 uppercase tracking-wider">
                  01 / Stage
                </span>
                <h2 className="mt-1 text-2xl font-bold text-[#111827]">
                  Where are you right now?
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  This helps us calibrate starting difficulty and practical roadmaps.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  'High School Student',
                  'College / University Student',
                  'Recent Graduate',
                  'Early Career / Thinking About Switching',
                  'Self-teaching at Home',
                ].map(option => (
                  <button
                    key={option}
                    onClick={() => setEducation(option)}
                    className={`w-full p-4 rounded-2xl border text-left text-sm font-medium transition flex items-center justify-between ${
                      education === option
                        ? 'border-purple-600 bg-purple-50/50 text-[#111827]'
                        : 'border-[#EAE5DE] hover:border-neutral-400 bg-white text-neutral-700'
                    }`}
                  >
                    <span>{option}</span>
                    {education === option && <Check className="w-4 h-4 text-purple-600" />}
                  </button>
                ))}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleNext}
                  className="px-7 py-3 rounded-full bg-[#111827] hover:bg-black text-white text-sm font-medium transition flex items-center gap-2"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* QUESTION 2: What do you actually enjoy doing? */}
          {currentStep === 2 && (
            <div className="p-6 sm:p-10 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-6">
              <div>
                <span className="text-xs font-mono text-purple-700 uppercase tracking-wider">
                  02 / Enjoyment
                </span>
                <h2 className="mt-1 text-2xl font-bold text-[#111827]">
                  What do you actually enjoy doing?
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  Select up to 3 things you get lost in when nobody is grading you.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  'Building things on phone or laptop',
                  'Visual design & aesthetics',
                  'Figuring out how things work',
                  'Writing, storytelling, or explaining',
                  'Gaming, stats, or strategy',
                  'Creating videos or social media',
                  'Helping friends solve problems',
                  'Organizing systems or checklists',
                ].map(item => {
                  const selected = enjoyment.includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => toggleMultiSelect(item, enjoyment, setEnjoyment)}
                      className={`p-3.5 rounded-2xl border text-left text-xs sm:text-sm font-medium transition flex items-center justify-between ${
                        selected
                          ? 'border-purple-600 bg-purple-50/50 text-[#111827]'
                          : 'border-[#EAE5DE] hover:border-neutral-400 bg-white text-neutral-700'
                      }`}
                    >
                      <span>{item}</span>
                      {selected && <Check className="w-4 h-4 text-purple-600 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 flex items-center justify-between">
                <span className="text-xs text-neutral-600">
                  {enjoyment.length === 0 ? 'Pick at least 1' : `${enjoyment.length} selected`}
                </span>
                <button
                  onClick={handleNext}
                  disabled={enjoyment.length === 0}
                  className="px-7 py-3 rounded-full bg-[#111827] hover:bg-black text-white text-sm font-medium transition flex items-center gap-2 disabled:opacity-40"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* QUESTION 3: What are you naturally good at? */}
          {currentStep === 3 && (
            <div className="p-6 sm:p-10 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-6">
              <div>
                <span className="text-xs font-mono text-purple-700 uppercase tracking-wider">
                  03 / Strengths
                </span>
                <h2 className="mt-1 text-2xl font-bold text-[#111827]">
                  What are you naturally good at?
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  What comes easier to you than to other people? (Pick up to 3)
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  'Spotting visual details & clean taste',
                  'Step-by-step logical thinking',
                  'Explaining complex ideas simply',
                  'Learning new apps & tools quickly',
                  'Staying curious & asking questions',
                  'Connecting with people & empathy',
                  'Seeing patterns others miss',
                  'Persisting through tricky problems',
                ].map(item => {
                  const selected = strengths.includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => toggleMultiSelect(item, strengths, setStrengths)}
                      className={`p-3.5 rounded-2xl border text-left text-xs sm:text-sm font-medium transition flex items-center justify-between ${
                        selected
                          ? 'border-purple-600 bg-purple-50/50 text-[#111827]'
                          : 'border-[#EAE5DE] hover:border-neutral-400 bg-white text-neutral-700'
                      }`}
                    >
                      <span>{item}</span>
                      {selected && <Check className="w-4 h-4 text-purple-600 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 flex items-center justify-between">
                <span className="text-xs text-neutral-600">
                  {strengths.length === 0 ? 'Pick at least 1' : `${strengths.length} selected`}
                </span>
                <button
                  onClick={handleNext}
                  disabled={strengths.length === 0}
                  className="px-7 py-3 rounded-full bg-[#111827] hover:bg-black text-white text-sm font-medium transition flex items-center gap-2 disabled:opacity-40"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* QUESTION 4: What kind of work environment sounds best? */}
          {currentStep === 4 && (
            <div className="p-6 sm:p-10 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-6">
              <div>
                <span className="text-xs font-mono text-purple-700 uppercase tracking-wider">
                  04 / Environment
                </span>
                <h2 className="mt-1 text-2xl font-bold text-[#111827]">
                  What work style feels most comfortable?
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  How do you do your best thinking?
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  'Deep focus alone with music on',
                  'Small, tight-knit creative team',
                  'Flexible remote setup from anywhere',
                  'Fast-paced, experimental and collaborative',
                ].map(option => (
                  <button
                    key={option}
                    onClick={() => setWorkStyle(option)}
                    className={`w-full p-4 rounded-2xl border text-left text-sm font-medium transition flex items-center justify-between ${
                      workStyle === option
                        ? 'border-purple-600 bg-purple-50/50 text-[#111827]'
                        : 'border-[#EAE5DE] hover:border-neutral-400 bg-white text-neutral-700'
                    }`}
                  >
                    <span>{option}</span>
                    {workStyle === option && <Check className="w-4 h-4 text-purple-600" />}
                  </button>
                ))}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleNext}
                  className="px-7 py-3 rounded-full bg-[#111827] hover:bg-black text-white text-sm font-medium transition flex items-center gap-2"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* QUESTION 5: What do you definitely want to avoid? */}
          {currentStep === 5 && (
            <div className="p-6 sm:p-10 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-6">
              <div>
                <span className="text-xs font-mono text-purple-700 uppercase tracking-wider">
                  05 / Dealbreakers
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
                  'Repetitive, mindless paperwork',
                  'Boring corporate meetings & bureaucracy',
                  'Staring at raw math equations all day',
                  'Aggressive cold-calling & hard sales',
                  'Strict micromanagement with no freedom',
                ].map(option => (
                  <button
                    key={option}
                    onClick={() => setAvoid(option)}
                    className={`w-full p-4 rounded-2xl border text-left text-sm font-medium transition flex items-center justify-between ${
                      avoid === option
                        ? 'border-purple-600 bg-purple-50/50 text-[#111827]'
                        : 'border-[#EAE5DE] hover:border-neutral-400 bg-white text-neutral-700'
                    }`}
                  >
                    <span>{option}</span>
                    {avoid === option && <Check className="w-4 h-4 text-purple-600" />}
                  </button>
                ))}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleNext}
                  className="px-7 py-3 rounded-full bg-[#111827] hover:bg-black text-white text-sm font-medium transition flex items-center gap-2"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* QUESTION 6: What matters most to you right now? */}
          {currentStep === 6 && (
            <div className="p-6 sm:p-10 rounded-3xl bg-white border border-[#E8E3DA] shadow-xs space-y-6">
              <div>
                <span className="text-xs font-mono text-purple-700 uppercase tracking-wider">
                  06 / Priority
                </span>
                <h2 className="mt-1 text-2xl font-bold text-[#111827]">
                  What matters most to you right now?
                </h2>
                <p className="text-sm text-neutral-600 mt-1">
                  What is your main goal for the next few months?
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  'Creative freedom & building cool stuff',
                  'Learning a high-demand skill with real future value',
                  'Fastest path to earning & landing a real role',
                  'Flexibility & working on my own terms',
                ].map(option => (
                  <button
                    key={option}
                    onClick={() => setPriority(option)}
                    className={`w-full p-4 rounded-2xl border text-left text-sm font-medium transition flex items-center justify-between ${
                      priority === option
                        ? 'border-purple-600 bg-purple-50/50 text-[#111827]'
                        : 'border-[#EAE5DE] hover:border-neutral-400 bg-white text-neutral-700'
                    }`}
                  >
                    <span>{option}</span>
                    {priority === option && <Check className="w-4 h-4 text-purple-600" />}
                  </button>
                ))}
              </div>

              {/* Optional personal note */}
              <div className="pt-2">
                <label className="text-xs text-neutral-600 block mb-1">
                  Anything specific on your mind? (Optional)
                </label>
                <input
                  type="text"
                  value={freeformNotes}
                  onChange={e => setFreeformNotes(e.target.value)}
                  placeholder="e.g., curious about AI tools, design, or indie hacking..."
                  className="w-full px-4 py-2.5 rounded-xl border border-[#EAE5DE] text-sm text-[#111827] focus:outline-none focus:border-purple-600 bg-[#FAF8F5]"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={generateRecommendations}
                  className="px-8 py-3.5 rounded-full bg-[#111827] hover:bg-black text-white text-sm font-semibold transition flex items-center gap-2 shadow-xs group"
                >
                  <Sparkles className="w-4 h-4 text-purple-300" />
                  <span>Reveal My 3 Possibilities</span>
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
