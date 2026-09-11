import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Sparkles,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { ChatMessage, UserProgressState } from '../types';

interface AIMentorChatProps {
  isOpen: boolean;
  onClose: () => void;
  userState: UserProgressState;
  userId?: string;
}

export const AIMentorChat: React.FC<AIMentorChatProps> = ({ isOpen, onClose, userState, userId = 'default-explorer' }) => {
  const currentStage =
    userState.roadmap.find(s => s.tasks.some(t => !userState.completedTaskIds.includes(t.id))) ||
    userState.roadmap[0];

  const chosenPath = userState.selectedDirection?.directionName;
  const isRegulated = userState.selectedDirection?.isRegulatedProfession;
  const userGreetingName = userState.user?.fullName || userState.user?.name;

  const initialGreeting = chosenPath
    ? `Hey ${userGreetingName ? `${userGreetingName} ` : ''}👋 I'm your ORBIT Mentor. I see you're currently working through **${currentStage?.title || 'your foundational steps'}** in **${chosenPath}**${
        isRegulated ? ' (a regulated professional path)' : ''
      }.

How are you feeling about your progress, or what's on your mind right now?`
    : `Hey ${userGreetingName ? `${userGreetingName} ` : ''}👋 I'm your ORBIT Career & Learning Mentor.

Whether you're feeling uncertain about which direction fits your personality, stuck on a concept, or wondering what to build next, I'm right here with you.

What would you like to explore today?`;

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content: initialGreeting,
      timestamp: 'Just now',
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const quickPrompts = chosenPath
    ? [
        `What's my single next step in ${currentStage?.title ? `Stage ${currentStage.stageNumber}` : 'this stage'}?`,
        'Why is this stage important for my career?',
        "I'm feeling stuck or overwhelmed.",
        'Give me a tiny 15-minute practice win.',
      ]
    : [
        'How do I discover my natural strengths?',
        'What careers match curious problem solvers?',
        'I have zero prior background—where do I start?',
        'Help me choose between two paths.',
      ];

  const handleSend = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: 'Just now',
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const pendingTasks = currentStage
        ? currentStage.tasks.filter(t => !userState.completedTaskIds.includes(t.id)).map(t => t.text)
        : [];

      const userContext = {
        userName: userState.user?.fullName || userState.user?.name,
        educationStage: userState.user?.educationLevel,
        fieldOfStudy: userState.user?.fieldOfStudy,
        learningStyle: userState.user?.learningStyle,
        chosenDirection: chosenPath || 'Exploring career options',
        careerGoal: userState.selectedDirection?.careerGoal || chosenPath,
        isRegulatedProfession: Boolean(isRegulated),
        profileSummary: userState.profile?.summary || userState.profile?.headline || 'Explorer',
        strengths: userState.profile?.naturalStrengths || [],
        hesitations: userState.profile?.thingsToAvoid || [],
        startingLevel: userState.profile?.startingLevel || 'Beginner',
        completedTasksCount: userState.completedTaskIds.length,
        currentStage: currentStage?.title || 'Foundation',
        currentStageNumber: currentStage?.stageNumber,
        whyLearningThis: currentStage?.whyLearningThis || currentStage?.whyItMatters,
        pendingTasks: pendingTasks.slice(0, 3),
      };

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          userContext,
          userId,
        }),
      });

      if (!res.ok) throw new Error('Failed to get answer');
      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.content || "I'm right here with you. What else can I help break down?",
        timestamp: 'Just now',
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          content:
            "I'm right here with you. Take a quick breath—you don't have to figure out the whole career today. Pick just one 15-minute concept to try. What part feels most unclear?",
          timestamp: 'Just now',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in">
      <div className="w-full sm:max-w-lg bg-[#FAF8F5] border border-[#E2DDD5] sm:rounded-3xl rounded-t-3xl shadow-2xl h-[85vh] sm:h-[620px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
        {/* Chat Header */}
        <div className="px-5 py-4 border-b border-[#EAE5DE] bg-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-700">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#111827]">
                ORBIT Mentor
              </h3>
              <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online &amp; Context-Aware
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-[#FAF8F5] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#111827] text-white rounded-br-xs'
                    : 'bg-white border border-[#E8E3DA] text-[#111827] shadow-2xs rounded-bl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-[#E8E3DA] rounded-2xl px-4 py-3 text-xs text-neutral-400 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                <span>Thinking simply...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 border-t border-[#EAE5DE] bg-white/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {quickPrompts.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSend(q)}
              className="text-[11px] px-3 py-1 rounded-full bg-white border border-[#E2DDD5] text-neutral-600 hover:text-black hover:border-black shrink-0 transition"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-[#EAE5DE] bg-white">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything (e.g. what should I learn next?)"
              className="flex-1 px-4 py-2.5 rounded-full border border-[#E2DDD5] text-xs sm:text-sm text-[#111827] placeholder:text-neutral-400 focus:outline-none focus:border-purple-600 bg-[#FAF8F5]"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-full bg-[#111827] hover:bg-black disabled:opacity-30 text-white flex items-center justify-center transition shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
