import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  X,
  Play,
  CheckCircle2,
  Sparkles,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Recommendation, Challenge } from '../types';

interface ChallengeModalProps {
  recommendation: Recommendation;
  onClose: () => void;
  onCompleteChallenge: (
    recId: string,
    submission: {
      userSubmission: string;
      enjoyed: string;
      easy: string;
      frustrating: string;
      aiFeedback: string;
    }
  ) => void;
}

export const ChallengeModal: React.FC<ChallengeModalProps> = ({
  recommendation,
  onClose,
  onCompleteChallenge,
}) => {
  const challenge = recommendation.challenge;

  // Phase: 'work' -> 'reflect' -> 'result'
  const [phase, setPhase] = useState<'work' | 'reflect' | 'result'>('work');

  // Interactive work states
  const [codeTitle, setCodeTitle] = useState('My Explorer Project');
  const [cardTone, setCardTone] = useState<'purple' | 'emerald' | 'charcoal'>('purple');
  const [buttonClicks, setButtonClicks] = useState(0);

  // Design/Logic answers
  const [selectedFixes, setSelectedFixes] = useState<string[]>([]);
  const [customTextAnswer, setCustomTextAnswer] = useState('');

  // Reflection questions
  const [enjoyed, setEnjoyed] = useState<'Yes, really liked it' | 'It was okay' | 'Found it dull/frustrating'>(
    'Yes, really liked it'
  );
  const [easyPart, setEasyPart] = useState('Tweaking text and seeing results right away');
  const [frustratingPart, setFrustratingPart] = useState('Wondering what all the code terms mean');

  // AI Feedback
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  const toggleFix = (item: string) => {
    setSelectedFixes(prev =>
      prev.includes(item) ? prev.filter(f => f !== item) : [...prev, item]
    );
  };

  const handleFinishWork = () => {
    setPhase('reflect');
  };

  const handleSubmitReflection = async () => {
    setLoadingFeedback(true);
    setPhase('result');

    const userSubmission =
      challenge.type === 'code'
        ? `Mood card customized with title "${codeTitle}", tone "${cardTone}", and tested with ${buttonClicks} interactions.`
        : customTextAnswer.trim() || selectedFixes.join(', ') || 'Completed interactive challenge.';

    try {
      const res = await fetch('/api/ai/challenge-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: recommendation.directionName,
          challengeTitle: challenge.title,
          userSubmission,
          reflection: {
            enjoyed,
            easy: easyPart,
            frustrating: frustratingPart,
          },
        }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const feedbackText = data.feedback || 'Great job testing this! Your honest reaction is the best guide.';
      setAiFeedback(feedbackText);

      confetti({
        particleCount: 40,
        spread: 55,
        origin: { y: 0.6 },
      });

      onCompleteChallenge(recommendation.id, {
        userSubmission,
        enjoyed,
        easy: easyPart,
        frustrating: frustratingPart,
        aiFeedback: feedbackText,
      });
    } catch {
      const fallbackFeedback = `Great effort testing this mini-challenge for ${recommendation.directionName}! You noted that you ${enjoyed.toLowerCase()} and found "${easyPart}" natural. This is genuine practical proof of what fits your instincts.`;
      setAiFeedback(fallbackFeedback);
      onCompleteChallenge(recommendation.id, {
        userSubmission,
        enjoyed,
        easy: easyPart,
        frustrating: frustratingPart,
        aiFeedback: fallbackFeedback,
      });
    } finally {
      setLoadingFeedback(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="max-w-xl w-full bg-white border border-[#E2DDD5] rounded-3xl shadow-xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#F0EBE4] flex items-center justify-between bg-[#FAF8F5]">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold font-mono">
              Try Before You Commit
            </span>
            <span className="text-xs text-neutral-500">• 5-minute test</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Challenge Description */}
          <div>
            <span className="text-xs text-purple-700 font-medium uppercase font-mono">
              {recommendation.directionName}
            </span>
            <h3 className="text-xl font-bold text-[#111827] mt-0.5">
              {challenge.title}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#EAE5DE]">
              <span className="font-semibold text-neutral-800">Scenario: </span>
              {challenge.scenario}
            </p>
          </div>

          {/* PHASE 1: PRACTICAL WORK */}
          {phase === 'work' && (
            <div className="space-y-5">
              {/* CODE CHALLENGE */}
              {challenge.type === 'code' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-neutral-600 font-medium mb-1">Headline Text</label>
                      <input
                        type="text"
                        value={codeTitle}
                        onChange={e => setCodeTitle(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] text-[#111827] focus:outline-none focus:border-purple-600"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-600 font-medium mb-1">Color Palette</label>
                      <div className="flex gap-2">
                        {(['purple', 'emerald', 'charcoal'] as const).map(tone => (
                          <button
                            key={tone}
                            onClick={() => setCardTone(tone)}
                            className={`flex-1 p-2 rounded-xl border text-xs capitalize transition ${
                              cardTone === tone
                                ? 'border-[#111827] bg-[#111827] text-white font-medium'
                                : 'border-[#E2DDD5] bg-white text-neutral-600'
                            }`}
                          >
                            {tone}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Live Render Output */}
                  <div className="p-4 rounded-2xl border border-[#E8E3DA] bg-[#FAF8F5] space-y-3">
                    <div className="flex items-center justify-between text-xs text-neutral-500 border-b border-[#EAE5DE] pb-2">
                      <span>Live Component Output</span>
                      <span className="font-mono text-purple-700 text-[11px] font-semibold">Instant Render</span>
                    </div>

                    <div
                      className={`p-5 rounded-2xl border transition-all duration-200 ${
                        cardTone === 'purple'
                          ? 'bg-purple-900 text-white border-purple-800'
                          : cardTone === 'emerald'
                          ? 'bg-emerald-900 text-white border-emerald-800'
                          : 'bg-[#111827] text-white border-neutral-900'
                      }`}
                    >
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-mono uppercase tracking-wider">
                        Interactive Component
                      </span>
                      <h4 className="text-lg font-bold mt-2">{codeTitle || 'Your Title Here'}</h4>
                      <p className="text-xs text-white/80 mt-1">
                        Notice how fast small code tweaks translate to real visual results on screen.
                      </p>

                      <div className="mt-4 flex items-center gap-3">
                        <button
                          onClick={() => setButtonClicks(c => c + 1)}
                          className="px-3.5 py-1.5 rounded-full bg-white text-[#111827] text-xs font-semibold hover:bg-neutral-100 transition shadow-xs"
                        >
                          Test Button ({buttonClicks})
                        </button>
                        {buttonClicks > 0 && (
                          <span className="text-xs text-emerald-300 font-medium">
                            State updated!
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* DESIGN / LOGIC CHALLENGE */
                <div className="space-y-4">
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    Look at this noisy mockup with competing banners. Which 2 elements should be removed so users can checkout comfortably?
                  </p>
                  <div className="space-y-2">
                    {[
                      'Giant flashing "BUY CRYPTO" banner',
                      'Loud spinning prize wheel banner',
                      'Primary "Confirm Order" checkout button',
                      'Customer delivery address summary',
                    ].map(item => (
                      <button
                        key={item}
                        onClick={() => toggleFix(item)}
                        className={`w-full p-3 rounded-xl border text-left text-xs font-medium transition flex items-center justify-between ${
                          selectedFixes.includes(item)
                            ? 'bg-purple-50 border-purple-600 text-[#111827]'
                            : 'bg-white border-[#E2DDD5] text-neutral-600'
                        }`}
                      >
                        <span>Remove: {item}</span>
                        {selectedFixes.includes(item) && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-600 font-medium mb-1">
                      Your thought: Why does removing visual noise help?
                    </label>
                    <input
                      type="text"
                      value={customTextAnswer}
                      onChange={e => setCustomTextAnswer(e.target.value)}
                      placeholder="e.g., Calm interfaces let people make decisions without anxiety."
                      className="w-full p-2.5 rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] text-xs focus:outline-none focus:border-purple-600"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-[#F0EBE4] flex justify-end">
                <button
                  onClick={handleFinishWork}
                  className="px-6 py-2.5 rounded-full bg-[#111827] hover:bg-black text-white text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <span>Done Testing • Reflect</span>
                  <Play className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* PHASE 2: REFLECTION */}
          {phase === 'reflect' && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-100 text-purple-900 text-xs">
                Nice job! Now let's see how that 5 minutes felt to you.
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-600 tracking-wider mb-2">
                  Did you enjoy doing that?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    'Yes, really liked it',
                    'It was okay',
                    'Found it dull/frustrating',
                  ].map(val => (
                    <button
                      key={val}
                      onClick={() => setEnjoyed(val as any)}
                      className={`p-3 rounded-xl border text-xs font-medium text-left transition ${
                        enjoyed === val
                          ? 'bg-purple-50 border-purple-600 text-[#111827]'
                          : 'bg-white border-[#E2DDD5] text-neutral-600'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-600 tracking-wider mb-1.5">
                  What felt easy or natural?
                </label>
                <input
                  type="text"
                  value={easyPart}
                  onChange={e => setEasyPart(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] text-xs text-[#111827] focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-600 tracking-wider mb-1.5">
                  What felt frustrating?
                </label>
                <input
                  type="text"
                  value={frustratingPart}
                  onChange={e => setFrustratingPart(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#E2DDD5] bg-[#FAF8F5] text-xs text-[#111827] focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="pt-4 border-t border-[#F0EBE4] flex justify-between items-center">
                <button
                  onClick={() => setPhase('work')}
                  className="text-xs text-neutral-500 hover:text-neutral-900"
                >
                  ← Back to challenge
                </button>
                <button
                  onClick={handleSubmitReflection}
                  disabled={loadingFeedback}
                  className="px-6 py-2.5 rounded-full bg-[#111827] hover:bg-black text-white text-xs font-semibold transition flex items-center gap-1.5"
                >
                  {loadingFeedback ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                      <span>Get AI Insight</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* PHASE 3: RESULT */}
          {phase === 'result' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8E3DA] space-y-2">
                <div className="flex items-center gap-1.5 text-purple-700 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Mentor Insight</span>
                </div>
                <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                  {aiFeedback}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Mini-test saved to your profile! You now have real firsthand feedback.</span>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full bg-[#111827] hover:bg-black text-white text-xs font-semibold transition"
                >
                  Return to 3 Possibilities
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
