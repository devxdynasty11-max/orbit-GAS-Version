import React from 'react';
import { ArrowRight, Sparkles, ChevronDown, Check, Compass, ShieldCheck } from 'lucide-react';

interface LandingPageProps {
  onStart: () => void;
  onOpenMentor: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart, onOpenMentor }) => {
  return (
    <div className="w-full flex flex-col items-center">
      {/* 1. HERO SECTION (Above the fold, strictly minimal) */}
      <section className="w-full max-w-4xl mx-auto pt-12 sm:pt-20 pb-12 px-4 sm:px-6 text-center flex flex-col items-center">
        {/* Subtle kicker */}
        <div className="inline-flex items-center gap-1.5 text-xs tracking-wider uppercase font-medium text-purple-700/80 mb-6 sm:mb-8">
          <span>A clearer way forward</span>
          <span className="text-purple-600">✦</span>
        </div>

        {/* Hero Heading: Sans-serif + Editorial Serif Italic */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-[#111827] leading-[1.08] max-w-3xl">
          Everyone is running.
          <span className="block font-serif-italic font-normal text-4xl sm:text-6xl md:text-7xl mt-1 sm:mt-2 text-[#111827]">
            But where are you going?
          </span>
        </h1>

        {/* Short, crystal-clear supporting copy */}
        <p className="mt-6 sm:mt-8 text-base sm:text-lg text-neutral-600 max-w-xl leading-relaxed font-normal">
          Discover what actually interests you, find skills that fit you, and build a roadmap for the future you actually want.
        </p>

        {/* Primary CTA Buttons */}
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <button
            onClick={onStart}
            className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-[#111827] hover:bg-black text-white text-sm sm:text-base font-medium transition shadow-sm flex items-center justify-center gap-2 group"
          >
            <span>Find My Direction</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
          </button>

          <a
            href="#how-it-works"
            className="w-full sm:w-auto px-5 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition flex items-center justify-center gap-1.5"
          >
            <span>How it works</span>
            <ChevronDown className="w-4 h-4" />
          </a>
        </div>

        {/* Hero Orbit Wireframe Illustration (Matching reference image) */}
        <div className="w-full max-w-2xl mt-12 sm:mt-16 relative flex items-center justify-center">
          <svg
            className="w-full h-44 sm:h-56 select-none overflow-visible"
            viewBox="0 0 600 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer Orbit Ellipse */}
            <ellipse
              cx="300"
              cy="100"
              rx="280"
              ry="75"
              stroke="#D8D2C7"
              strokeWidth="1"
              strokeDasharray="4 4"
              className="opacity-70"
            />
            {/* Middle Orbit Ellipse - Tilted */}
            <ellipse
              cx="300"
              cy="100"
              rx="220"
              ry="55"
              transform="rotate(-8 300 100)"
              stroke="#CBC4B7"
              strokeWidth="1.2"
            />
            {/* Inner Orbit Ellipse - Tilted opposite */}
            <ellipse
              cx="300"
              cy="100"
              rx="150"
              ry="38"
              transform="rotate(6 300 100)"
              stroke="#B3ABB8"
              strokeWidth="1"
            />

            {/* Orbit Markers & Labels */}
            {/* 01 DISCOVER */}
            <g transform="translate(140, 50)">
              <circle cx="0" cy="0" r="3.5" fill="#7C3AED" />
              <text x="0" y="-12" textAnchor="middle" fill="#6B7280" fontSize="9" fontFamily="monospace" letterSpacing="1">
                01
              </text>
              <text x="0" y="-2" textAnchor="middle" fill="#111827" fontSize="10" fontWeight="600" letterSpacing="1">
                DISCOVER
              </text>
            </g>

            {/* 02 EXPLORE */}
            <g transform="translate(420, 40)">
              <circle cx="0" cy="0" r="3.5" fill="#7C3AED" />
              <text x="0" y="-12" textAnchor="middle" fill="#6B7280" fontSize="9" fontFamily="monospace" letterSpacing="1">
                02
              </text>
              <text x="0" y="-2" textAnchor="middle" fill="#111827" fontSize="10" fontWeight="600" letterSpacing="1">
                EXPLORE
              </text>
            </g>

            {/* 03 BUILD */}
            <g transform="translate(460, 140)">
              <circle cx="0" cy="0" r="3.5" fill="#7C3AED" />
              <text x="0" y="14" textAnchor="middle" fill="#6B7280" fontSize="9" fontFamily="monospace" letterSpacing="1">
                03
              </text>
              <text x="0" y="25" textAnchor="middle" fill="#111827" fontSize="10" fontWeight="600" letterSpacing="1">
                BUILD
              </text>
            </g>

            {/* Center Planet Core */}
            <circle cx="300" cy="100" r="22" fill="#111827" />
            <circle cx="300" cy="100" r="14" fill="#7C3AED" opacity="0.3" />
            <circle cx="295" cy="95" r="4" fill="#FFFFFF" opacity="0.9" />
          </svg>
        </div>
      </section>

      {/* 2. HOW IT WORKS (Minimal 3-Step Journey) */}
      <section id="how-it-works" className="w-full border-t border-[#EAE5DE] py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-12 sm:mb-16">
            <span className="text-xs uppercase font-semibold text-purple-700 tracking-wider">The Process</span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#111827]">
              Three simple steps to clarity
            </h2>
            <p className="mt-2 text-sm sm:text-base text-neutral-600">
              No long quizzes. No confusing psychological scores. Just an honest conversation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-6">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-white border border-[#E8E3DA] shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-semibold text-purple-700 uppercase tracking-wider block mb-3">
                  01 / Answer
                </span>
                <h3 className="text-lg font-bold text-[#111827] mb-2">
                  6 Honest Questions
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Tell us what you actually enjoy doing when nobody's grading you, what drains you, and how you like to learn.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#F0EBE4] text-xs text-neutral-400">
                Takes about 2 minutes
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-white border border-[#E8E3DA] shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-semibold text-purple-700 uppercase tracking-wider block mb-3">
                  02 / Explore
                </span>
                <h3 className="text-lg font-bold text-[#111827] mb-2">
                  3 Real Possibilities
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  We don't overwhelm you with 50 generic job titles. You get 3 clear, realistic directions matched to your instincts.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#F0EBE4] text-xs text-neutral-400">
                No corporate jargon
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-white border border-[#E8E3DA] shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-semibold text-purple-700 uppercase tracking-wider block mb-3">
                  03 / Test Drive
                </span>
                <h3 className="text-lg font-bold text-[#111827] mb-2">
                  Try Before You Commit
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Complete a quick 5-minute interactive test to feel what the work is like in real life before building your roadmap.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#F0EBE4] text-xs text-neutral-400">
                Actionable roadmap included
              </div>
            </div>
          </div>

          {/* Calming bottom reassurance */}
          <div className="mt-14 sm:mt-16 text-center">
            <button
              onClick={onStart}
              className="px-8 py-3.5 rounded-full bg-[#111827] hover:bg-black text-white text-sm font-medium transition shadow-sm inline-flex items-center gap-2 group"
            >
              <span>Find My Direction</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </button>
            <p className="mt-3 text-xs text-neutral-500">
              Free to explore • No login required • Step-by-step guidance
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
