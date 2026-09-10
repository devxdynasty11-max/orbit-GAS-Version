import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  Play,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Columns,
  X
} from 'lucide-react';
import { UserProfile, Recommendation } from '../types';

interface RecommendationsViewProps {
  profile: UserProfile;
  recommendations: Recommendation[];
  completedChallengeIds: string[];
  onOpenChallenge: (rec: Recommendation) => void;
  onSelectDirection: (rec: Recommendation) => void;
  onOpenMentor: () => void;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  profile,
  recommendations,
  completedChallengeIds,
  onOpenChallenge,
  onSelectDirection,
  onOpenMentor,
}) => {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);

  // Exactly 3 recommendations
  const validRecs = recommendations.slice(0, 3);

  const toggleExpand = (id: string) => {
    setExpandedCardId(prev => (prev === id ? null : id));
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 sm:py-16 px-4 sm:px-6 space-y-10">
      {/* Editorial Header */}
      <div className="text-center max-w-xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 text-xs tracking-wider uppercase font-semibold text-purple-700">
          <span>Personalized for you</span>
          <span>✦</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111827]">
          Three paths that fit you
        </h1>
        <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
          {profile.headline || 'Curious Explorer with an Eye for Building Things'}
        </p>

        {/* Compare button */}
        <div className="pt-1">
          <button
            onClick={() => setShowCompareModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-[#E2DDD5] text-xs font-medium text-neutral-700 hover:text-black hover:border-neutral-400 transition shadow-xs"
          >
            <Columns className="w-3.5 h-3.5 text-purple-600" />
            <span>Compare all 3 side-by-side</span>
          </button>
        </div>
      </div>

      {/* 3 Strong Minimal Recommendation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {validRecs.map((rec, index) => {
          const isExpanded = expandedCardId === rec.id;
          const hasDoneChallenge = completedChallengeIds.includes(rec.id);

          return (
            <div
              key={rec.id || index}
              className="rounded-3xl bg-white border border-[#E8E3DA] p-6 shadow-xs flex flex-col justify-between transition hover:border-[#D5CFC4] relative"
            >
              <div className="space-y-4">
                {/* Number & Tag */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-purple-700">
                    0{index + 1}
                  </span>
                  {hasDoneChallenge && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Tested</span>
                    </span>
                  )}
                </div>

                {/* Path Name & Tagline */}
                <div>
                  <h3 className="text-xl font-bold text-[#111827] leading-snug">
                    {rec.directionName}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 font-medium">
                    {rec.tagline}
                  </p>
                </div>

                {/* Why it fits you (1-2 short sentences) */}
                <div className="pt-2 border-t border-[#F0EBE4]">
                  <span className="text-[11px] font-semibold uppercase text-neutral-600 tracking-wider block mb-1">
                    Why it fits you
                  </span>
                  <p className="text-xs text-neutral-700 leading-relaxed">
                    {rec.whyItFitsYou}
                  </p>
                </div>

                {/* Good for Tags (2-3 simple tags) */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(rec.beginnerSkills?.slice(0, 3) || ['Creative', 'Visual', 'Practical']).map(
                    (tag, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-full bg-[#FAF8F5] border border-[#EAE5DE] text-[11px] text-neutral-600 font-medium"
                      >
                        {tag.split('(')[0].trim()}
                      </span>
                    )
                  )}
                </div>

                {/* Expandable Details (Progressive Disclosure) */}
                {isExpanded && (
                  <div className="pt-4 border-t border-[#F0EBE4] space-y-3 text-xs text-neutral-600 animate-in fade-in">
                    <div>
                      <span className="font-semibold text-neutral-800 block mb-1">
                        In simple terms:
                      </span>
                      <p className="leading-relaxed text-neutral-600">
                        {rec.simpleExplanation}
                      </p>
                    </div>

                    {rec.dayInTheLife && rec.dayInTheLife.length > 0 && (
                      <div>
                        <span className="font-semibold text-neutral-800 block mb-1">
                          Day in the life:
                        </span>
                        <ul className="space-y-1 text-neutral-600 pl-3 list-disc">
                          {rec.dayInTheLife.slice(0, 3).map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-[#F0EBE4] space-y-2">
                {/* Primary: Select this path */}
                <button
                  onClick={() => onSelectDirection(rec)}
                  className="w-full py-2.5 rounded-full bg-[#111827] hover:bg-black text-white text-xs sm:text-sm font-medium transition flex items-center justify-center gap-1.5 group"
                >
                  <span>Choose this path</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </button>

                {/* Secondary: Try 5-min challenge */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => onOpenChallenge(rec)}
                    className="text-xs text-purple-700 hover:text-purple-900 font-medium inline-flex items-center gap-1 transition"
                  >
                    <Play className="w-3 h-3 fill-purple-600/20" />
                    <span>Try 5-min test</span>
                  </button>

                  <button
                    onClick={() => toggleExpand(rec.id)}
                    className="text-xs text-neutral-600 hover:text-neutral-900 inline-flex items-center gap-1 transition"
                  >
                    <span>{isExpanded ? 'Less' : 'More'}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reassuring note */}
      <div className="text-center pt-4">
        <p className="text-xs text-neutral-600">
          Not sure which to pick?{' '}
          <button
            onClick={onOpenMentor}
            className="text-purple-700 hover:underline font-medium"
          >
            Ask the AI Mentor
          </button>{' '}
          to help you compare.
        </p>
      </div>

      {/* Comparison Modal */}
      {showCompareModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-3xl w-full bg-white border border-[#E2DDD5] rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#F0EBE4] pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#111827]">
                  Compare Your 3 Directions
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  See how each path matches your time and learning style
                </p>
              </div>
              <button
                onClick={() => setShowCompareModal(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {validRecs.map((rec, i) => (
                <div key={rec.id} className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EAE5DE] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-purple-700 font-bold">0{i + 1}</span>
                    <span className="text-[10px] uppercase font-semibold text-neutral-500">Option</span>
                  </div>
                  <h4 className="font-bold text-sm text-[#111827]">{rec.directionName}</h4>
                  <p className="text-neutral-600">{rec.simpleExplanation}</p>

                  <div className="pt-2 border-t border-[#EAE5DE] space-y-1 text-neutral-500">
                    <div className="font-semibold text-neutral-700">First skills to learn:</div>
                    <ul className="list-disc pl-3 space-y-0.5">
                      {rec.beginnerSkills?.slice(0, 2).map((s, idx) => (
                        <li key={idx}>{s.split('(')[0]}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-3">
                    <button
                      onClick={() => {
                        setShowCompareModal(false);
                        onSelectDirection(rec);
                      }}
                      className="w-full py-2 rounded-full bg-[#111827] hover:bg-black text-white font-medium text-xs transition"
                    >
                      Pick this path
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
