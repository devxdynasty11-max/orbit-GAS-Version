import { OpenAI } from "openai";
import { GoogleGenAI } from "@google/genai";

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";
const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
// Primary NVIDIA model configured or default to openai/gpt-oss-20b, with fallback to meta/llama-3.2-11b-vision-instruct
const PRIMARY_NVIDIA_MODEL = process.env.NVIDIA_MODEL || "openai/gpt-oss-20b";
const FALLBACK_NVIDIA_MODEL = "meta/llama-3.2-11b-vision-instruct";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

function getOpenAIClient(): OpenAI | null {
  if (!NVIDIA_API_KEY || NVIDIA_API_KEY.length < 5) return null;
  return new OpenAI({
    apiKey: NVIDIA_API_KEY,
    baseURL: NVIDIA_BASE_URL,
  });
}

function getGeminiClient(): GoogleGenAI | null {
  if (!GEMINI_API_KEY) return null;
  return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

// Utility to clean JSON from LLM text
export function extractCleanJson(text: string): any {
  if (!text) throw new Error("Empty text");
  try {
    return JSON.parse(text);
  } catch {
    // Check markdown code blocks
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1].trim());
      } catch {}
    }
    // Check greedy braces
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const slice = text.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(slice);
      } catch {}
    }
    // Check greedy brackets for arrays
    const firstBracket = text.indexOf("[");
    const lastBracket = text.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const slice = text.substring(firstBracket, lastBracket + 1);
      try {
        return JSON.parse(slice);
      } catch {}
    }
    throw new Error("Could not parse valid JSON from AI output");
  }
}

// Helper to run a promise with a hard timeout
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Universal Multi-Turn AI Chat Caller:
 * Priority 1: NVIDIA NIM (Primary: openai/gpt-oss-20b, Fallback: meta/llama-3.2-11b-vision-instruct)
 * Priority 2: Google Gemini (gemini-2.5-flash)
 */
export async function callAIChat(options: {
  systemPrompt: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}): Promise<string> {
  const {
    systemPrompt,
    messages,
    maxTokens = 2048,
    temperature = 0.6,
    timeoutMs = 25000,
  } = options;

  const openAIClient = getOpenAIClient();
  let lastError: any = null;

  // Build unified message sequence
  const fullMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...messages.filter(m => m.content && m.content.trim().length > 0),
  ];

  // 1. Try Primary NVIDIA NIM model
  if (openAIClient) {
    try {
      const completion = await withTimeout(
        openAIClient.chat.completions.create({
          model: PRIMARY_NVIDIA_MODEL,
          messages: fullMessages,
          temperature,
          max_tokens: maxTokens,
        }),
        timeoutMs,
        `NVIDIA (${PRIMARY_NVIDIA_MODEL})`
      );
      const text = completion.choices?.[0]?.message?.content;
      if (text && text.trim().length > 0) return text;
    } catch (err: any) {
      console.warn(`[AI Engine] NVIDIA primary model (${PRIMARY_NVIDIA_MODEL}) error:`, err?.message || err);
      lastError = err;

      // Try Fallback NVIDIA NIM model if primary differed
      if (PRIMARY_NVIDIA_MODEL !== FALLBACK_NVIDIA_MODEL) {
        try {
          const completion = await withTimeout(
            openAIClient.chat.completions.create({
              model: FALLBACK_NVIDIA_MODEL,
              messages: fullMessages,
              temperature,
              max_tokens: maxTokens,
            }),
            timeoutMs,
            `NVIDIA fallback (${FALLBACK_NVIDIA_MODEL})`
          );
          const text = completion.choices?.[0]?.message?.content;
          if (text && text.trim().length > 0) return text;
        } catch (fbErr: any) {
          console.warn(`[AI Engine] NVIDIA fallback model error:`, fbErr?.message || fbErr);
          lastError = fbErr;
        }
      }
    }
  }

  // 2. Try Google Gemini
  const geminiClient = getGeminiClient();
  if (geminiClient) {
    try {
      const conversationText = fullMessages
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n\n");

      const res = await withTimeout(
        geminiClient.models.generateContent({
          model: "gemini-2.5-flash",
          contents: conversationText,
          config: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        }),
        timeoutMs,
        "Google Gemini (gemini-2.5-flash)"
      );
      const text = res.text;
      if (text && text.trim().length > 0) return text;
    } catch (gemErr: any) {
      console.warn(`[AI Engine] Gemini error/timeout:`, gemErr?.message || gemErr);
      lastError = gemErr;
    }
  }

  throw lastError || new Error("All AI providers unavailable or timed out");
}

/**
 * Universal AI Caller:
 * Priority 1: NVIDIA NIM (Primary & Fallback)
 * Priority 2: Google Gemini (gemini-2.5-flash)
 */
export async function callAIModel(options: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}): Promise<string> {
  const {
    systemPrompt,
    userPrompt,
    maxTokens = 2048,
    temperature = 0.4,
    timeoutMs = 25000,
  } = options;

  return callAIChat({
    systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens,
    temperature,
    timeoutMs,
  });
}

// Tailored, instant deterministic fallback generator
export function synthesizeRecommendationsFallback(answers: any) {
  const activities = (answers?.freeTimeActivities || []).join(" ").toLowerCase();
  const strengths = (answers?.problemSolvingStyle || "").toLowerCase();
  const disliked = (answers?.dislikedTasks || []).join(" ").toLowerCase();
  const workStyle = answers?.workEnvironment || "Independent deep work with occasional syncs";
  const stage = answers?.educationStage || "Student exploring options";
  const priority = (answers?.priorities || [])[0] || "Creative freedom and fun";

  const isVisual =
    activities.includes("visual") ||
    activities.includes("creating") ||
    strengths.includes("visual") ||
    strengths.includes("aesthetic");

  const isLogic =
    activities.includes("behind the scenes") ||
    activities.includes("figuring") ||
    strengths.includes("logic") ||
    strengths.includes("puzzle");

  const isWriting =
    activities.includes("writing") ||
    activities.includes("story") ||
    strengths.includes("words");

  // Build Profile
  const profile = {
    headline: isVisual
      ? "Visual Creator with Practical Curiosity"
      : isLogic
      ? "Analytical Problem Solver with Builder Instincts"
      : "Curious Explorer Ready for Hands-On Discovery",
    summary: `You enjoy understanding how ideas take physical or digital shape. You prefer friendly feedback over rote memorization, and you value ${priority.toLowerCase()} with room to experiment without rigid pressure.`,
    naturalStrengths: [
      isVisual ? "Sharp eye for aesthetics and layout feel" : "Intuitive logic and noticing patterns",
      "Curiosity about how real digital products are made",
      "Resilience when testing and fixing practical issues",
    ],
    workStyle: workStyle,
    motivation: `${priority} through tangible projects`,
    thingsToAvoid: [
      disliked.length > 5 ? disliked : "Repetitive memorization with no practical use",
      "High-pressure cold sales or aggressive micro-management",
      "Theoretical lectures without ever building real things",
    ],
    curiosityAreas: [
      isVisual ? "Interactive web experiences" : "Software architecture & APIs",
      "Product design & usability",
      "Building practical tools for friends and creators",
    ],
    startingLevel: `Beginner calibrated for ${stage}`,
  };

  // Build 3 Custom Recommendations
  const rec1 = {
    id: "dir-frontend",
    directionName: "Creative Frontend & Interactive Web",
    tagline: "Bring ideas to life on screen using code and visual creativity",
    simpleExplanation:
      "Frontend creators build everything you see, tap, and interact with on websites and apps. It is the perfect blend of visual design and logical problem-solving where you see results instantly.",
    whyItFitsYou: `You expressed interest in ${activities || "building things"} and enjoy seeing immediate proof of your work. Frontend lets you write a few lines and immediately see buttons move and colors change.`,
    dayInTheLife: [
      "Turning an idea or drawing into an interactive webpage",
      "Experimenting with animations, colors, and layout rhythm",
      "Solving puzzle-like bugs so everything works smoothly on phones and laptops",
      "Collaborating with designers to make screens easy and fun to use",
    ],
    beginnerSkills: [
      "HTML structure (the skeleton of the web)",
      "CSS styling & layouts (making things look modern)",
      "Modern JavaScript (making things respond to clicks)",
      "Git basics (saving your progress like a video game checkpoint)",
    ],
    whatYouCanTryToday: "Change the color, text, and button click reaction on a mini webpage in 5 minutes.",
    futureOpportunities: [
      "Frontend Web Developer at high-growth tech startups",
      "Creative Freelance Web Designer building custom sites for creators",
      "Design Engineer bridging the gap between product designers and engineers",
    ],
    challenge: {
      title: "Build a Personal Mood Card",
      scenario:
        "A creator wants a clean, interactive greeting card for their profile that changes moods and responds when clicked.",
      taskDescription:
        "Adjust the headline, select your color tone, and test the interactive button to see real-time updates.",
      type: "code",
      starterTemplate: `<div class="p-6 bg-gradient-to-br from-indigo-900 to-neutral-900 text-white rounded-2xl border border-indigo-500/30">
  <span class="px-2.5 py-1 text-xs rounded-full bg-indigo-500/20 text-indigo-300 font-medium">Live Card</span>
  <h3 class="text-xl font-semibold mt-3">Welcome to my space</h3>
  <p class="text-neutral-300 text-sm mt-1">Exploring new skills one step at a time.</p>
  <button class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm rounded-lg font-medium transition">Say Hello 👋</button>
</div>`,
      sampleGuidance: "Try changing the title text or experimenting with the button click!",
    },
    comparison: {
      whatIsIt: "Crafting the interactive, visible parts of websites and web apps.",
      whatWouldIDo: "Write code that makes designs come alive in web browsers.",
      creativeFactor: "High — you directly control layouts, animations, and aesthetic feel.",
      problemSolving: "Medium-High — fixing logic quirks and responsive screens.",
      workingWithPeople: "Balanced — mostly building in flow state with small team syncs.",
      beginnerDifficulty: "Gentle start — you see your changes update instantly on screen.",
      whatCanITryToday: "Inspect any website in Chrome DevTools or test our mini-challenge below.",
      whoMightEnjoy: "Anyone who likes seeing instant visual proof of their effort.",
    },
  };

  const rec2 = {
    id: "dir-product-ux",
    directionName: "Product UX & Interface Design",
    tagline: "Design digital experiences that feel effortless and friendly",
    simpleExplanation:
      "Product and UX designers figure out how an app should feel, where buttons should go, and why people might get confused so they can make it delightful.",
    whyItFitsYou: `You value ${priority} and mentioned ${strengths || "visual intuition"}. UX lets you shape how people interact with technology without getting stuck in deep mathematical code.`,
    dayInTheLife: [
      "Talking with users to discover what annoys them about existing apps",
      "Sketching user journeys and wireframes on digital whiteboards",
      "Creating clean, high-fidelity mockups in tools like Figma",
      "Testing designs with friends to see if buttons are easy to find",
    ],
    beginnerSkills: [
      "Visual hierarchy and typography rhythm",
      "Wireframing and user journey mapping",
      "Figma basics (components, auto-layout)",
      "Empathy-driven user feedback sessions",
    ],
    whatYouCanTryToday: "Find an app on your phone that frustrates you, and sketch a 3-step fix on paper.",
    futureOpportunities: [
      "Product Designer shaping user journeys for consumer apps",
      "UX Researcher discovering human behavioral insights",
      "Design Systems Specialist creating component libraries",
    ],
    challenge: {
      title: "Redesign a Confusing Mobile Checkout",
      scenario:
        "An independent coffee shop app has a screen where customers constantly tap the wrong button and cancel their order by mistake.",
      taskDescription:
        "Identify 3 usability flaws on the mock screen and select the most intuitive layout fix.",
      type: "design",
      sampleGuidance:
        "Notice which button draws too much attention and whether the cancellation button is dangerously close to 'Confirm'.",
    },
    comparison: {
      whatIsIt: "Designing how software looks, functions, and feels to real humans.",
      whatWouldIDo: "Draw wireframes, build Figma prototypes, and simplify complex flows.",
      creativeFactor: "Very High — typography, colors, spatial balance, and storytelling.",
      problemSolving: "High — empathetic psychology: understanding why users get stuck.",
      workingWithPeople: "High — collaborating with developers, users, and product leads.",
      beginnerDifficulty: "Low barrier to start — you already use apps every single day.",
      whatCanITryToday: "Sign up for Figma (free) and recreate your favorite app screen.",
      whoMightEnjoy: "People with good taste who notice when bad design annoys them.",
    },
  };

  const rec3 = isLogic
    ? {
        id: "dir-backend",
        directionName: "Backend & Systems Engineering",
        tagline: "Build the engines, databases, and APIs powering the internet",
        simpleExplanation:
          "Backend engineers build the invisible machinery behind websites — storing user accounts, processing payments, and keeping databases fast and secure.",
        whyItFitsYou:
          "You mentioned enjoying figuring out how things work behind the scenes. Backend lets you architect rock-solid logic and build real APIs.",
        dayInTheLife: [
          "Designing database schemas and writing queries",
          "Building REST and GraphQL APIs that apps use to fetch data",
          "Debugging performance bottlenecks to keep apps fast under load",
          "Ensuring user passwords and sensitive data are safely encrypted",
        ],
        beginnerSkills: [
          "Python, Node.js, or Go for building server endpoints",
          "SQL and relational database fundamentals",
          "HTTP methods (GET, POST) and API architecture",
          "Basic terminal commands and server deployment",
        ],
        whatYouCanTryToday: "Create a 10-line Express server in Node.js that returns JSON.",
        futureOpportunities: [
          "Backend Engineer at fast-growing SaaS startups",
          "Cloud / DevOps Specialist managing infrastructure",
          "API & Platform Architect building developer tools",
        ],
        challenge: {
          title: "Design a Mini User Database Schema",
          scenario:
            "A music streaming app needs to store users, songs, and playlists without duplicates or missing tracks.",
          taskDescription:
            "Link the playlist table to user IDs and write a simple mock query to get all songs in a playlist.",
          type: "logic",
          sampleGuidance: "Think about how songs can belong to multiple playlists.",
        },
        comparison: {
          whatIsIt: "Building the server-side logic, databases, and security of applications.",
          whatWouldIDo: "Write server code, organize tables, connect APIs, and optimize speed.",
          creativeFactor: "Medium — architectural creativity in clean systems design.",
          problemSolving: "Very High — algorithmic puzzle solving and data integrity.",
          workingWithPeople: "Medium — working closely with frontend teams and engineers.",
          beginnerDifficulty: "Moderate — requires thinking about abstract data flows.",
          whatCanITryToday: "Test an API in Postman or write a simple script in Node.js.",
          whoMightEnjoy: "People who love puzzles, logic games, and behind-the-scenes mechanics.",
        },
      }
    : {
        id: "dir-data",
        directionName: "Data Insights & Visual Storytelling",
        tagline: "Uncover hidden patterns in numbers and tell compelling stories with charts",
        simpleExplanation:
          "Data specialists take raw tables and numbers, find surprising truths, and turn them into clear visuals so people can make smart decisions without getting overwhelmed.",
        whyItFitsYou:
          "You appreciate clarity and seeing patterns. Data allows you to explore real-world questions with evidence, combining analysis with visual storytelling.",
        dayInTheLife: [
          "Exploring datasets to see what trends are emerging over time",
          "Cleaning messy tables and organizing rows for easy analysis",
          "Designing charts, graphs, and dashboards that make complex ideas clear",
          "Explaining findings to non-technical teammates using simple language",
        ],
        beginnerSkills: [
          "Spreadsheet mastery (formulas, pivot tables, clean formatting)",
          "Data visualization principles (choosing the right chart for the story)",
          "Introductory SQL for querying datasets",
          "Python basics (Pandas, Matplotlib) for deeper exploration",
        ],
        whatYouCanTryToday: "Take a dataset of your favorite music or video games and build 1 clear chart in Google Sheets.",
        futureOpportunities: [
          "Data Analyst at media, gaming, or consumer tech companies",
          "Business Intelligence Specialist building executive dashboards",
          "Product Data Partner helping teams decide which features to build",
        ],
        challenge: {
          title: "Find the Mystery in the Mini Dataset",
          scenario:
            "Here are daily visits to a community: Mon: 4,200 | Tue: 4,100 | Wed: 4,300 | Thu: 4,150 | Fri: 8,900 | Sat: 9,200 | Sun: 6,100.",
          taskDescription:
            "Spot the pattern and write a 1-sentence recommendation for when the community should host their weekly live event.",
          type: "logic",
          sampleGuidance:
            "Look at when visitors naturally flock to the platform without any marketing nudge.",
        },
        comparison: {
          whatIsIt: "Exploring numbers, facts, and datasets to uncover real-world insights.",
          whatWouldIDo: "Query data, organize spreadsheets, create charts, and explain what happened.",
          creativeFactor: "Medium — visual chart design and narrative storytelling.",
          problemSolving: "High — investigative logic, spotting anomalies and trends.",
          workingWithPeople: "Medium — sharing findings with decision-makers.",
          beginnerDifficulty: "Gentle start with Google Sheets, leveling up into Python/SQL.",
          whatCanITryToday: "Make a quick chart of your favorite video game stats.",
          whoMightEnjoy: "Curious puzzle solvers who want proof before making decisions.",
        },
      };

  return {
    profile,
    recommendations: [rec1, rec2, rec3],
  };
}

export function synthesizeRoadmapFallback(direction: any, profile: any) {
  const dirName = direction?.directionName || "Creative Frontend & Interactive Web";

  const stages = [
    {
      id: "stg-1",
      stageNumber: 1,
      stageKey: "START HERE",
      title: "Orientation & Zero-Pressure Playground",
      subtitle: `Get comfortable with ${dirName} without installing heavy tools`,
      whatToLearn: [
        "How this field works in the real world",
        "Key terminology explained simply without intimidating jargon",
        "Free beginner playgrounds in your browser",
      ],
      whyItMatters: "Removing the fear of getting started is the most important first win. You cannot break anything in a browser sandbox.",
      whatToPractice: [
        "Explore 2 well-known projects in this domain",
        "Tweak simple starter values in an interactive playground",
      ],
      whatToBuild: `A simple 'Hello World' milestone project for ${dirName}`,
      whatSuccessLooksLike: "You understand what the tools do and feel ready to make small edits.",
      whatToDoNext: "Move to foundational basics with structured bite-sized exercises.",
      tasks: [
        { id: "t1-1", text: "Open DevTools or an interactive sandbox and inspect a live element", done: false },
        { id: "t1-2", text: "Make your first 3 edits and observe the result in real time", done: false },
        { id: "t1-3", text: "Bookmark 2 reliable free beginner documentation hubs", done: false },
      ],
    },
    {
      id: "stg-2",
      stageNumber: 2,
      stageKey: "BASICS",
      title: "Foundational Mechanics & First Habits",
      subtitle: "Learn the core concepts step-by-step with zero rush",
      whatToLearn: [
        "The 3 most fundamental building blocks of this discipline",
        "How to read error messages without panic",
        "Setting up a clean, lightweight personal setup",
      ],
      whyItMatters: "Strong basics make every future framework or tool 5x easier to pick up.",
      whatToPractice: [
        "Replicate a clean, minimal example from memory",
        "Troubleshoot a deliberate mini error to understand the fix",
      ],
      whatToBuild: "A polished beginner component that does one thing really well",
      whatSuccessLooksLike: "You can write a basic module without copying line-by-line from a video.",
      whatToDoNext: "Combine multiple basics together in your first complete project.",
      tasks: [
        { id: "t2-1", text: "Complete 3 hands-on interactive tutorials on the core syntax", done: false },
        { id: "t2-2", text: "Create a personal cheat-sheet of key commands and patterns", done: false },
        { id: "t2-3", text: "Build a mini standalone component from scratch", done: false },
      ],
    },
    {
      id: "stg-3",
      stageNumber: 3,
      stageKey: "FIRST PROJECT",
      title: "Your First Tangible Mini-Project",
      subtitle: "Build something working that you can show to a friend",
      whatToLearn: [
        "Connecting visual state to real logic",
        "Storing simple data locally so state persists",
        "Deploying or sharing your creation for free online",
      ],
      whyItMatters: "Having something live that other people can click and test builds real confidence.",
      whatToPractice: [
        "Plan a simple 3-screen or 3-step user interaction",
        "Build the project in 2-3 focused 30-minute sessions",
      ],
      whatToBuild: `A functional mini application or tool tailored to ${dirName}`,
      whatSuccessLooksLike: "You have a live link on your phone that you can test and send to a friend.",
      whatToDoNext: "Refactor your code and add a second feature to deepen your intuition.",
      tasks: [
        { id: "t3-1", text: "Outline the 3 primary user actions of your mini-project", done: false },
        { id: "t3-2", text: "Implement the core interactive flow and verify edge cases", done: false },
        { id: "t3-3", text: "Publish or share your live demo for free online", done: false },
      ],
    },
    {
      id: "stg-4",
      stageNumber: 4,
      stageKey: "PRACTICE",
      title: "Building Muscle Memory & Routine",
      subtitle: "Solve varied mini-puzzles to handle real-world edge cases",
      whatToLearn: [
        "Common design and code patterns used by industry professionals",
        "How to search effectively for solutions without getting stuck",
        "Keyboard shortcuts and faster iteration loops",
      ],
      whyItMatters: "Repetition turns conscious effort into effortless intuition.",
      whatToPractice: [
        "Rebuild 3 different classic UI or logic components",
        "Participate in a weekly challenge or code exercise",
      ],
      whatToBuild: "A library of 3 reusable modular components",
      whatSuccessLooksLike: "You can assemble common features without constantly getting stuck.",
      whatToDoNext: "Start building a full-sized standalone project from scratch.",
      tasks: [
        { id: "t4-1", text: "Build and test 2 small interactive widgets from scratch", done: false },
        { id: "t4-2", text: "Learn how to use browser DevTools to profile performance", done: false },
        { id: "t4-3", text: "Refactor messy code into clean, readable functions", done: false },
      ],
    },
    {
      id: "stg-5",
      stageNumber: 5,
      stageKey: "REAL PROJECTS",
      title: "Full-Scale Standalone Applications",
      subtitle: "Solve a real human problem from start to finish",
      whatToLearn: [
        "Structuring a multi-file project with clean architecture",
        "Handling network requests, asynchronous data, and loading states",
        "Responsive accessibility and mobile polish",
      ],
      whyItMatters: "Employers and clients look for projects that solve real problems, not tutorial clones.",
      whatToPractice: [
        "Talk to a friend or creator to find an annoying workflow to automate",
        "Build and ship a production-grade tool to solve it",
      ],
      whatToBuild: "A complete, responsive web application with authentication or data persistence",
      whatSuccessLooksLike: "Real people can use your application to accomplish a task seamlessly.",
      whatToDoNext: "Document your design and technical decisions in a public portfolio.",
      tasks: [
        { id: "t5-1", text: "Scope out requirements and user stories for a real tool", done: false },
        { id: "t5-2", text: "Connect an external API or database to power real-time data", done: false },
        { id: "t5-3", text: "Perform a usability audit on mobile devices and tablet screens", done: false },
      ],
    },
    {
      id: "stg-6",
      stageNumber: 6,
      stageKey: "PORTFOLIO",
      title: "Storytelling & Public Proof of Work",
      subtitle: "Showcase your best 2-3 creations with clear impact",
      whatToLearn: [
        "How to write case studies that explain your thought process",
        "Taking crisp screenshots and recording 30-second walkthrough videos",
        "Presenting yourself authentically on GitHub, LinkedIn, or personal domain",
      ],
      whyItMatters: "People hire people whose thought process and enthusiasm they can see.",
      whatToPractice: [
        "Explain your favorite project to someone non-technical in 2 minutes",
        "Write a concise README detailing what you learned and what you would improve",
      ],
      whatToBuild: "A minimalist personal portfolio website featuring your top 2 projects",
      whatSuccessLooksLike: "A visitor can view your work, test the live link, and contact you in under 60 seconds.",
      whatToDoNext: "Network, freelance, apply for internships, or explore advanced specializations.",
      tasks: [
        { id: "t6-1", text: "Deploy your clean personal portfolio on a custom or free domain", done: false },
        { id: "t6-2", text: "Write 1 clear case study detailing the problem, solution, and learnings", done: false },
        { id: "t6-3", text: "Share your project link in a friendly community for constructive feedback", done: false },
      ],
    },
    {
      id: "stg-7",
      stageNumber: 7,
      stageKey: "NEXT LEVEL",
      title: "Specialization & Lifelong Mastery",
      subtitle: "Choose your unique niche and keep building things you love",
      whatToLearn: [
        "Advanced tooling, performance tuning, and systems design",
        "Contributing to open source or open design communities",
        "Mentoring someone who is 2 steps behind you",
      ],
      whyItMatters: "The best creators never stop exploring. Teaching others cements your own knowledge.",
      whatToPractice: [
        "Audit a large open-source repo or design system",
        "Write a brief tutorial teaching a trick you recently mastered",
      ],
      whatToBuild: "An open-source library, template, or community resource",
      whatSuccessLooksLike: "You have your own autonomous creative rhythm and can learn any new tool quickly.",
      whatToDoNext: "Keep building things with joy and curiosity.",
      tasks: [
        { id: "t7-1", text: "Explore an advanced topic (e.g. state machines, shaders, or cloud functions)", done: false },
        { id: "t7-2", text: "Help answer a beginner's question in a developer community", done: false },
        { id: "t7-3", text: "Plan your next independent ambitious product idea", done: false },
      ],
    },
  ];

  const resources = [
    {
      id: "res-1",
      title: "freeCodeCamp Interactive Curriculum",
      provider: "freeCodeCamp",
      type: "free" as const,
      format: "Interactive Code / Exercises",
      url: "https://www.freecodecamp.org",
      description: "World-renowned, 100% free interactive curriculum with verified projects and supportive community.",
      estimatedTime: "Self-paced",
    },
    {
      id: "res-2",
      title: "MDN Web Docs & Guides",
      provider: "Mozilla Developer Network",
      type: "free" as const,
      format: "Documentation & Examples",
      url: "https://developer.mozilla.org",
      description: "The official, gold-standard reference for web technologies, syntax, and accessibility.",
      estimatedTime: "Reference guide",
    },
    {
      id: "res-3",
      title: "The Odin Project",
      provider: "The Odin Project",
      type: "free" as const,
      format: "Curated Project-Based Path",
      url: "https://www.theodinproject.com",
      description: "Full-stack open source curriculum designed to take you from total beginner to job-ready.",
      estimatedTime: "2-4 months",
    },
    {
      id: "res-4",
      title: "Scrimba Interactive Frontend Bootcamp",
      provider: "Scrimba",
      type: "paid" as const,
      format: "Interactive Screencasts",
      url: "https://scrimba.com",
      description: "Pause and edit instructor code directly inside the video player. Great for visual learners.",
      estimatedTime: "40 hours",
    },
    {
      id: "res-5",
      title: "Frontend Masters Foundation Courses",
      provider: "Frontend Masters",
      type: "paid" as const,
      format: "Deep Dive Video Workshops",
      url: "https://frontendmasters.com",
      description: "Taught by active lead engineers from top technology companies with deep architectural rigor.",
      estimatedTime: "25 hours",
    },
    {
      id: "res-6",
      title: "Interaction Design Foundation (IxDF)",
      provider: "IxDF",
      type: "paid" as const,
      format: "Industry Accredited UX Courses",
      url: "https://www.interaction-design.org",
      description: "Globally recognized certifications for UX research, interface ergonomics, and visual balance.",
      estimatedTime: "30 hours",
    },
  ];

  const projects = [
    {
      id: "proj-1",
      title: "Minimal Personal Link Hub & Mood Board",
      level: "Beginner" as const,
      objective: "Build a single responsive page showcasing your favorite links, typography, and interactive button.",
      skillsPracticed: ["Layout structure", "Modern styling", "Responsive sizing", "Publishing live"],
      expectedOutput: "A fast, clean mobile-friendly profile page accessible on the web.",
      difficulty: "Gentle (1-2 days)",
      suggestedNextStep: "Add a theme switch or link analytics counter.",
      completed: false,
    },
    {
      id: "proj-2",
      title: "Daily Focus & Streak Tracker",
      level: "Intermediate" as const,
      objective: "Create an interactive daily task tracker with local persistence and micro-animations.",
      skillsPracticed: ["State management", "LocalStorage persistence", "Event handling", "Animation timing"],
      expectedOutput: "A reliable daily tool you can personally use to track study sessions and streaks.",
      difficulty: "Moderate (3-5 days)",
      suggestedNextStep: "Add sound feedback or milestone confetti effects.",
      completed: false,
    },
    {
      id: "proj-3",
      title: "Full-Featured Community Resource Directory",
      level: "Advanced" as const,
      objective: "Build a searchable, filterable directory with real-time query inputs and category tags.",
      skillsPracticed: ["Data filtering & searching", "API integration", "Accessibility compliance", "Performance optimization"],
      expectedOutput: "A high-utility standalone product that creators and students can use.",
      difficulty: "Challenging (1-2 weeks)",
      suggestedNextStep: "Deploy to a custom domain and share in public communities.",
      completed: false,
    },
  ];

  return {
    roadmap: stages,
    resources,
    projects,
  };
}

/**
 * Deterministic generator for dynamic Career Goal -> Roadmap
 * Accurately models both regulated careers (Doctor, Lawyer, Pilot, etc.)
 * and modern tech/creative/business careers (AI Engineer, Game Dev, etc.)
 */
export function synthesizeCareerPathwayFallback(careerGoal: string, profile?: any) {
  const goalLower = (careerGoal || "").toLowerCase().trim();

  const isMedical =
    goalLower.includes("doctor") ||
    goalLower.includes("physician") ||
    goalLower.includes("surgeon") ||
    goalLower.includes("medical") ||
    goalLower.includes("dentist") ||
    goalLower.includes("psychiatrist");

  const isNursing =
    goalLower.includes("nurse") || goalLower.includes("nursing") || goalLower.includes("rn");

  const isLaw =
    goalLower.includes("lawyer") ||
    goalLower.includes("attorney") ||
    goalLower.includes("legal") ||
    goalLower.includes("law");

  const isAviation =
    goalLower.includes("pilot") ||
    goalLower.includes("aviation") ||
    goalLower.includes("flight");

  const isEngineeringPE =
    goalLower.includes("civil engineer") ||
    goalLower.includes("structural engineer") ||
    goalLower.includes("mechanical engineer") ||
    goalLower.includes("aerospace engineer") ||
    goalLower.includes("electrical engineer");

  const isAccountingCPA =
    goalLower.includes("accountant") ||
    goalLower.includes("cpa") ||
    goalLower.includes("auditor");

  const isAIEngineer =
    goalLower.includes("ai") ||
    goalLower.includes("machine learning") ||
    goalLower.includes("deep learning") ||
    goalLower.includes("data scientist") ||
    goalLower.includes("llm");

  const isGameDev =
    goalLower.includes("game") ||
    goalLower.includes("unity") ||
    goalLower.includes("unreal") ||
    goalLower.includes("gamedev");

  const isCybersecurity =
    goalLower.includes("cyber") ||
    goalLower.includes("security") ||
    goalLower.includes("penetration") ||
    goalLower.includes("infosec");

  const isUIUX =
    goalLower.includes("design") ||
    goalLower.includes("ui") ||
    goalLower.includes("ux") ||
    goalLower.includes("product design");

  const isEntrepreneur =
    goalLower.includes("founder") ||
    goalLower.includes("entrepreneur") ||
    goalLower.includes("startup") ||
    goalLower.includes("indie");

  const isRegulated = isMedical || isNursing || isLaw || isAviation || isEngineeringPE || isAccountingCPA;

  // Title formatting helper
  const formattedTitle =
    isMedical
      ? "Physician / Medical Specialist"
      : isNursing
      ? "Registered Nurse / Healthcare Professional"
      : isLaw
      ? "Licensed Attorney / Legal Counsel"
      : isAviation
      ? "Commercial Airline Pilot"
      : isEngineeringPE
      ? "Licensed Professional Engineer"
      : isAccountingCPA
      ? "Certified Public Accountant (CPA)"
      : isAIEngineer
      ? "AI & Machine Learning Engineer"
      : isGameDev
      ? "Interactive Game Developer"
      : isCybersecurity
      ? "Cybersecurity & Defense Analyst"
      : isUIUX
      ? "Product & UI/UX Designer"
      : isEntrepreneur
      ? "Digital Founder & Indie Maker"
      : careerGoal || "Modern Software Engineer";

  // Formal Requirements for Regulated Professions
  let formalRequirements: any = undefined;
  if (isRegulated) {
    if (isMedical) {
      formalRequirements = {
        education: [
          "Bachelor's Degree with Pre-Med prerequisites (Biology, General & Organic Chemistry, Physics, Biochemistry)",
          "Doctor of Medicine (MD) or Doctor of Osteopathic Medicine (DO) degree from an accredited medical school (4 years)",
        ],
        eligibility: [
          "High cumulative and science GPA (typically 3.6+)",
          "Clinical exposure, shadowing experience, and healthcare volunteer hours",
          "Letters of recommendation from science faculty and practicing clinicians",
        ],
        entranceExams: [
          "MCAT (Medical College Admission Test) covering biological systems, chemical foundations, psychological principles, and critical analysis",
        ],
        qualificationsAndLicensing: [
          "USMLE Step 1 (or COMLEX-USA Level 1) foundational science examination",
          "USMLE Step 2 CK (Clinical Knowledge)",
          "USMLE Step 3 (Independent patient management examination)",
          "Full State Medical Board Physician License",
          "Board Certification in chosen specialty (e.g. Internal Medicine, Surgery, Pediatrics)",
        ],
        practicalExperience: [
          "Clinical Clerkships & Sub-internships (Years 3 & 4 of Medical School)",
          "Accredited Residency Training Program (3 to 7 years depending on medical specialty)",
          "Optional Sub-specialty Fellowship (1 to 3 additional years)",
        ],
        careerProgression: [
          "Pre-Medical Student → Medical Student (MS1-MS4) → Resident Physician (PGY1-PGY3+) → Chief Resident / Fellow → Attending Physician / Department Specialist",
        ],
      };
    } else if (isLaw) {
      formalRequirements = {
        education: [
          "Undergraduate Bachelor's Degree (Any discipline; philosophy, political science, history, or engineering)",
          "Juris Doctor (JD) degree from an ABA-accredited law school (3 years full-time)",
        ],
        eligibility: [
          "Competitive undergraduate GPA and rigorous coursework",
          "Demonstrated analytical reasoning, legal research readiness, and character/fitness standing",
        ],
        entranceExams: [
          "LSAT (Law School Admission Test) or GRE evaluating logical reasoning, analytical analysis, and reading comprehension",
        ],
        qualificationsAndLicensing: [
          "Multistate Professional Responsibility Examination (MPRE)",
          "State Bar Examination (Uniform Bar Exam or state-specific bar)",
          "Moral Character & Fitness Evaluation by State Supreme Court Bar Committee",
          "Sworn Admission to the State Bar and Court System",
        ],
        practicalExperience: [
          "1L & 2L Summer Legal Internships / Clerkships with law firms, judiciary, or public agencies",
          "Law Review / Moot Court or Legal Clinic client representation under faculty supervision",
        ],
        careerProgression: [
          "Law Student → Summer Associate / Law Clerk → Associate Attorney → Senior Associate → Partner / General Counsel",
        ],
      };
    } else if (isAviation) {
      formalRequirements = {
        education: [
          "High School Diploma or GED (Minimum); Bachelor's Degree strongly preferred for major airlines",
          "FAA-approved ground school and flight academy or university aviation program",
        ],
        eligibility: [
          "FAA First-Class Medical Certificate (strict vision, cardiovascular, neurological, and physical standards)",
          "Age 17 for Private Pilot, 18 for Commercial, 23 for Airline Transport Pilot (ATP)",
          "English language fluency (ICAO Level 4+)",
        ],
        entranceExams: [
          "FAA Private Pilot Aeronautical Knowledge Written Exam",
          "FAA Instrument Rating Knowledge Exam",
          "FAA Commercial Pilot Written Knowledge Exam",
          "FAA Airline Transport Pilot (ATP) Multi-Engine Exam",
        ],
        qualificationsAndLicensing: [
          "Private Pilot License (PPL)",
          "Instrument Rating (IR)",
          "Commercial Pilot License (CPL) Single & Multi-Engine",
          "Certified Flight Instructor (CFI/CFII) to build requisite flight hours",
          "Airline Transport Pilot Certificate (ATP) with type ratings",
        ],
        practicalExperience: [
          "Minimum 1,500 total logged flight hours (or 1,000/1,250 hours via Restricted ATP approved aviation degrees)",
          "Cross-country, night flight, and instrument time requirements",
          "Turbine simulator checkrides and crew resource management (CRM) training",
        ],
        careerProgression: [
          "Student Pilot → Certified Flight Instructor / Regional Cargo Pilot → Regional Airline First Officer → Regional Captain → Major Airline First Officer → Major Airline Captain",
        ],
      };
    } else {
      formalRequirements = {
        education: [
          "Accredited Bachelor of Science Degree (ABET-accredited for engineering, or 150 credit hours for CPA)",
          "Advanced professional certificates or master's degrees for specialized branches",
        ],
        eligibility: [
          "Completion of formal university engineering/accounting curriculum",
          "Clean ethical record and verified background",
        ],
        entranceExams: [
          "Fundamentals Exam (e.g. FE Exam for Engineers, or CPA Exam Section 1)",
        ],
        qualificationsAndLicensing: [
          "Engineer-in-Training (EIT) or Certified Public Accountant (CPA) License",
          "Principles and Practice Exam (PE Exam for Engineers) after 4 years of verified progressive experience",
          "State Professional Licensing Board Registration",
        ],
        practicalExperience: [
          "4 years of direct progressive professional practice under a licensed Professional Engineer (PE) or CPA supervisor",
          "Formal project documentation and peer-reviewed case studies",
        ],
        careerProgression: [
          "Junior Associate / EIT → Project Engineer / Senior Auditor → Licensed PE / CPA Manager → Principal / Partner",
        ],
      };
    }
  }

  // Generate Stage Sequence tailored to this career
  const stages = isRegulated
    ? [
        {
          id: "stg-1",
          stageNumber: 1,
          stageKey: "FOUNDATION & ELIGIBILITY",
          title: "Undergraduate Prerequisite & Foundational Sciences",
          subtitle: `Master the essential preliminary academic coursework required for ${formattedTitle}`,
          estimatedTime: "12-24 months",
          whyLearningThis: "Professional licensing boards require deep, verifiable academic mastery before entry exams.",
          howItHelpsCareer: "Establishes the scientific or legal vocabulary required to understand advanced clinical/legal training.",
          whatComesAfter: "Standardized entrance examination prep and formal application cycle.",
          whatToLearn: [
            "Core prerequisite academic concepts and rigorous foundational theory",
            "Professional code of conduct and statutory ethics",
            "High-yield terminology, notation, and study methodologies",
          ],
          whyItMatters: "Without high performance in prerequisites, candidate files are screened out by admissions boards.",
          whatToPractice: [
            "Daily active recall study schedules using flashcards and spaced repetition",
            "Analyzing primary professional research and case reports",
          ],
          whatToBuild: "A comprehensive personal portfolio of prerequisite coursework, volunteer hours, and professional contacts",
          whatSuccessLooksLike: "Consistently maintaining prerequisite GPA above the competitive threshold.",
          whatToDoNext: "Register for your formal standardized entrance test (MCAT/LSAT/FAA/FE).",
          tasks: [
            { id: "reg-1", text: "Map all mandatory prerequisite coursework and identify any current credit gaps", done: false, category: "Academic" },
            { id: "reg-2", text: "Establish a 2-hour daily deep-work schedule for foundational subjects", done: false, category: "Habit" },
            { id: "reg-3", text: "Secure 20+ hours of professional shadowing or industry observation", done: false, category: "Practical" },
          ],
        },
        {
          id: "stg-2",
          stageNumber: 2,
          stageKey: "ENTRANCE EXAMINATION",
          title: "Standardized Entrance Examination Mastery",
          subtitle: "Targeted examination preparation, diagnostic tests, and application readiness",
          estimatedTime: "4-6 months",
          whyLearningThis: "Admissions and flight/licensing boards rely on standardized tests to objectively compare candidates.",
          howItHelpsCareer: "Unlocks entry to accredited professional programs that carry legitimate licensing authority.",
          whatComesAfter: "Enrollment in accredited degree or flight/technical training program.",
          whatToLearn: [
            "Test structure, scoring algorithms, and question archetypes",
            "Speed-reading, critical deduction, and eliminating distractor answer choices",
            "High-pressure test stamina over 4-7 hour examination windows",
          ],
          whyItMatters: "Scores dictate eligibility for top accredited institutions and funded fellowships.",
          whatToPractice: [
            "Take 4-6 full-length timed diagnostic examinations under strict testing conditions",
            "Review every incorrect question with an error-analysis journal",
          ],
          whatToBuild: "A validated score report meeting or exceeding 80th percentile benchmark",
          whatSuccessLooksLike: "Passing score achieved on official testing date.",
          whatToDoNext: "Submit formal applications to accredited schools or flight training academies.",
          tasks: [
            { id: "reg-4", text: "Complete official diagnostic baseline test to identify weak areas", done: false, category: "Exam" },
            { id: "reg-5", text: "Complete 1,000+ practice question bank items with in-depth explanations", done: false, category: "Exam" },
            { id: "reg-6", text: "Submit formal application portfolio including letters of recommendation", done: false, category: "Milestone" },
          ],
        },
        {
          id: "stg-3",
          stageNumber: 3,
          stageKey: "FORMAL CURRICULUM",
          title: "Accredited Professional Program & Theory",
          subtitle: `Intensive graduate curriculum or advanced flight/engineering syllabus`,
          estimatedTime: "24-48 months",
          whyLearningThis: "State and national boards require accredited graduation before granting license to practice.",
          howItHelpsCareer: "Provides legal qualification to touch patients, represent clients, or operate commercial equipment.",
          whatComesAfter: "Supervised clinical rotations, clerkships, or flight hours building.",
          whatToLearn: [
            "Full professional curriculum taught by accredited board faculty",
            "Complex decision-making under uncertainty and diagnostic frameworks",
            "Safety protocols, regulatory compliance, and statutory duties",
          ],
          whyItMatters: "Directly protects human safety, client assets, and personal professional liability.",
          whatToPractice: [
            "Case study rounds, moot arguments, or high-fidelity flight simulator maneuvers",
            "Drafting professional documentation and regulatory reports",
          ],
          whatToBuild: "Verified academic transcripts and dean's recommendation for licensing",
          whatSuccessLooksLike: "Passing all coursework modules and foundational board examinations.",
          whatToDoNext: "Transition into hands-on supervised practice rotations.",
          tasks: [
            { id: "reg-7", text: "Complete Year 1 foundational theory and laboratory/flight modules", done: false, category: "Core" },
            { id: "reg-8", text: "Pass primary qualifying examination (e.g. USMLE Step 1 / 1L Exams / FAA CPL Written)", done: false, category: "Exam" },
            { id: "reg-9", text: "Participate in simulated clinical, flight, or legal workshops", done: false, category: "Skill" },
          ],
        },
        {
          id: "stg-4",
          stageNumber: 4,
          stageKey: "SUPERVISED CLINICALS & ROTATIONS",
          title: "Supervised Real-World Rotations & Practicum",
          subtitle: "Hands-on immersion under the direct supervision of licensed attendings or captains",
          estimatedTime: "12-24 months",
          whyLearningThis: "Textbook theory cannot replace real patient bedsides, courtrooms, or cockpits.",
          howItHelpsCareer: "Teaches you how to operate safely in real clinical/aviation/legal conditions.",
          whatComesAfter: "Full licensing examinations and independent residency/employment.",
          whatToLearn: [
            "Team communication, bedside manner, or cockpit crew resource management",
            "Rapid emergency response protocols and mitigating real-time stress",
            "Professional etiquette, charting, and electronic record systems",
          ],
          whyItMatters: "Evaluations from supervisors directly determine residency matches and job placement.",
          whatToPractice: [
            "Presenting cases clearly in under 3 minutes to senior supervisors",
            "Executing procedures under direct faculty observation",
          ],
          whatToBuild: "A verified log of clinical encounters, flight hours, or court appearances",
          whatSuccessLooksLike: "Honors or strong pass ratings across all rotation blocks.",
          whatToDoNext: "Register and sit for the final comprehensive licensing examination.",
          tasks: [
            { id: "reg-10", text: "Complete mandatory core rotation blocks with verified attendance logs", done: false, category: "Practicum" },
            { id: "reg-11", text: "Receive formal written evaluation and sign-off from clinical/flight mentors", done: false, category: "Milestone" },
            { id: "reg-12", text: "Log required minimum procedural hours (e.g. 1500 flight hours or clinical logbook)", done: false, category: "Practicum" },
          ],
        },
        {
          id: "stg-5",
          stageNumber: 5,
          stageKey: "BOARD LICENSING & CERTIFICATION",
          title: "Licensing Board Examination & Bar/Medical Admission",
          subtitle: "Pass statutory state/national examinations and gain independent legal credentials",
          estimatedTime: "2-6 months",
          whyLearningThis: "It is illegal to practice without an active, unrestricted state/federal license.",
          howItHelpsCareer: "Grants you legal authority to practice independently and sign official documentation.",
          whatComesAfter: "Residency completion, partnership, or independent commercial operation.",
          whatToLearn: [
            "Comprehensive board examination questions across all disciplines",
            "Jurisprudence, malpractice statutes, and state administrative rules",
            "Professional insurance and liability requirements",
          ],
          whyItMatters: "This is the final regulatory barrier between training and authorized career practice.",
          whatToPractice: [
            "Full simulation exams focusing on time allocation and risk mitigation",
            "Ethics and character background disclosure paperwork",
          ],
          whatToBuild: "Official State Board License certificate and national credentials",
          whatSuccessLooksLike: "Official notification of passing board examination and license issuance.",
          whatToDoNext: "Enter formal residency training or accept licensed practice placement.",
          tasks: [
            { id: "reg-13", text: "Register and complete the final comprehensive board examination", done: false, category: "Exam" },
            { id: "reg-14", text: "Submit background check, fingerprints, and state licensing petition", done: false, category: "Licensing" },
            { id: "reg-15", text: "Receive official license number and registration certificate", done: false, category: "Milestone" },
          ],
        },
        {
          id: "stg-6",
          stageNumber: 6,
          stageKey: "INDEPENDENT PRACTICE & SPECIALIZATION",
          title: "Full Professional Practice & Continuing Education",
          subtitle: `Autonomous career practice, hospital privileges, or airline command as a ${formattedTitle}`,
          estimatedTime: "Ongoing career",
          whyLearningThis: "Maintaining cutting-edge standards and patient/client safety is a lifelong commitment.",
          howItHelpsCareer: "Builds prestige, high earnings, leadership roles, and mentorship opportunities.",
          whatComesAfter: "Department leadership, partnership, or mentorship of the next generation.",
          whatToLearn: [
            "Advanced sub-specialty techniques and emerging innovations",
            "Practice management, team leadership, and mentorship",
            "Annual continuing education units (CEU / CME) required for license renewal",
          ],
          whyItMatters: "Excellence in practice protects licenses and establishes community trust.",
          whatToPractice: [
            "Leading complex cases and mentoring junior trainees",
            "Publishing research or leading institutional quality-improvement committees",
          ],
          whatToBuild: "An exemplary clinical, flight, or legal track record with zero disciplinary actions",
          whatSuccessLooksLike: "Esteemed standing as a recognized leader in your field.",
          whatToDoNext: "Continue evolving and helping young explorers find their path.",
          tasks: [
            { id: "reg-16", text: "Obtain hospital privileges or airline line qualification", done: false, category: "Career" },
            { id: "reg-17", text: "Complete annual continuing professional education credits", done: false, category: "Growth" },
            { id: "reg-18", text: "Mentor one junior student or intern starting their journey", done: false, category: "Mentorship" },
          ],
        },
      ]
    : [
        // Tech, Creative & Self-Directed Careers
        {
          id: "stg-1",
          stageNumber: 1,
          stageKey: "ORIENTATION & ZERO-PRESSURE PLAYGROUND",
          title: "Zero-Pressure Sandbox & Mental Models",
          subtitle: `Get comfortable with the core vocabulary and daily work of a ${formattedTitle}`,
          estimatedTime: "1-2 weeks",
          whyLearningThis: `Demystifies ${formattedTitle} without overwhelming you with complex tooling or jargon.`,
          howItHelpsCareer: "Gives you immediate confidence and establishes how real practitioners think.",
          whatComesAfter: "Foundational mechanics, coding syntax, or design software mastery.",
          whatToLearn: [
            `What a ${formattedTitle} actually does on a Tuesday morning`,
            "Key vocabulary and tools explained in plain English",
            "Free, browser-based sandboxes that require zero local installation",
          ],
          whyItMatters: "Eliminates intimidation. You can't break anything in a browser sandbox.",
          whatToPractice: [
            "Tweak 3 working examples in an online interactive playground",
            "Inspect how your favorite apps solve problems in this discipline",
          ],
          whatToBuild: "A tiny 'Hello World' experiment showing immediate visual or logical results",
          whatSuccessLooksLike: "You understand what the tools do and look forward to writing code/designing screens.",
          whatToDoNext: "Move to the core mechanics with structured exercises.",
          tasks: [
            { id: "t-1", text: "Explore a live playground or sandbox for this role and run your first command/edit", done: false, category: "Sandbox" },
            { id: "t-2", text: "Learn the 5 most common terms used by practitioners in plain English", done: false, category: "Vocab" },
            { id: "t-3", text: "Bookmark 2 verified free documentation hubs (MDN, freeCodeCamp, or official docs)", done: false, category: "Resources" },
          ],
        },
        {
          id: "stg-2",
          stageNumber: 2,
          stageKey: "CORE SKILLS & MECHANICS",
          title: "Foundational Syntax, Rules & Patterns",
          subtitle: "Master the essential building blocks step-by-step with zero rush",
          estimatedTime: "2-4 weeks",
          whyLearningThis: "Deep fundamentals make every future framework or modern tool 5x faster to learn.",
          howItHelpsCareer: "Senior engineers and hiring managers always test fundamentals, not just buzzwords.",
          whatComesAfter: "Assembling these building blocks into your first standalone working project.",
          whatToLearn: [
            "Core data structures, syntax, layout rules, or design systems",
            "How to read error messages calmly without frustration",
            "Setting up a clean, lightweight personal developer environment",
          ],
          whyItMatters: "Without solid fundamentals, beginners get stuck in tutorial hell.",
          whatToPractice: [
            "Replicate a small component from memory without copying line-by-line",
            "Deliberately break a piece of code to see the error and fix it",
          ],
          whatToBuild: "A polished standalone module or interface component that works smoothly",
          whatSuccessLooksLike: "You can write a basic module without needing a step-by-step tutorial open.",
          whatToDoNext: "Combine these skills to build a complete project from scratch.",
          tasks: [
            { id: "t-4", text: "Complete hands-on interactive exercises on core syntax and logic", done: false, category: "Core" },
            { id: "t-5", text: "Set up a clean local environment or code editor on your machine", done: false, category: "Tooling" },
            { id: "t-6", text: "Build a single reusable component from scratch", done: false, category: "Project" },
          ],
        },
        {
          id: "stg-3",
          stageNumber: 3,
          stageKey: "FIRST TANGIBLE PROJECT",
          title: "Your First Standalone Working Project",
          subtitle: "Build something real that you can show to a friend or mentor",
          estimatedTime: "2-3 weeks",
          whyLearningThis: "True learning only happens when you assemble components into a working whole.",
          howItHelpsCareer: "Gives you your first tangible evidence of capability that goes beyond tutorials.",
          whatComesAfter: "Polishing your work with real-world state, edge cases, and performance.",
          whatToLearn: [
            "Connecting user inputs to real application state and responses",
            "Storing and persisting simple data so state doesn't wipe on refresh",
            "Publishing or deploying your project live to the internet for free",
          ],
          whyItMatters: "Having a live link you can send to someone builds real pride and momentum.",
          whatToPractice: [
            "Scope a minimal project to 3 clear features and ship them",
            "Deploy to a free hosting provider (Vercel, Netlify, or GitHub Pages)",
          ],
          whatToBuild: `A complete mini-product or interactive tool tailored for ${formattedTitle}`,
          whatSuccessLooksLike: "A live URL running on your phone and laptop that anyone can click and test.",
          whatToDoNext: "Expand into realistic problem-solving and multi-component systems.",
          tasks: [
            { id: "t-7", text: "Sketch the 3 main user actions for your first project", done: false, category: "Planning" },
            { id: "t-8", text: "Implement the interactive core functionality with working state", done: false, category: "Build" },
            { id: "t-9", text: "Deploy to a free live URL and test it on a mobile browser", done: false, category: "Deploy" },
          ],
        },
        {
          id: "stg-4",
          stageNumber: 4,
          stageKey: "PRACTICE & PROBLEM SOLVING",
          title: "Debugging, APIs & Real-World Edge Cases",
          subtitle: "Handle messy data, asynchronous operations, and unpredictable user actions",
          estimatedTime: "3-4 weeks",
          whyLearningThis: "Real-world apps deal with network drops, invalid inputs, and changing requirements.",
          howItHelpsCareer: "Separates beginners from self-sufficient junior builders who can solve problems independently.",
          whatComesAfter: "Building production-grade projects with authentication and backend persistence.",
          whatToLearn: [
            "Fetching real data from public REST APIs or external services",
            "Handling loading states, empty states, and friendly error banners",
            "Refactoring messy code into clean, readable functions and modular files",
          ],
          whyItMatters: "Most coding time in industry is spent fixing edge cases and improving existing code.",
          whatToPractice: [
            "Connect your project to a live public API (weather, music, books, or news)",
            "Test what happens when the network is turned off or slow",
          ],
          whatToBuild: "An API-driven dashboard or application that displays real, dynamic information",
          whatSuccessLooksLike: "Your application handles bad inputs and network errors gracefully without crashing.",
          whatToDoNext: "Create a flagship portfolio project that solves a genuine real-world problem.",
          tasks: [
            { id: "t-10", text: "Connect an external API and safely display dynamic data", done: false, category: "API" },
            { id: "t-11", text: "Add error boundaries and empty state screens for when data fails", done: false, category: "Resilience" },
            { id: "t-12", text: "Refactor your code into clear, well-commented modular files", done: false, category: "Code Quality" },
          ],
        },
        {
          id: "stg-5",
          stageNumber: 5,
          stageKey: "REAL-WORLD PROJECTS",
          title: "Flagship Production-Grade Application",
          subtitle: "Build a polished product with real authentication, database storage, and high finish",
          estimatedTime: "4-6 weeks",
          whyLearningThis: "Employers look for proof that you understand how full software products operate end-to-end.",
          howItHelpsCareer: "Becomes the centerpiece of your resume and GitHub profile.",
          whatComesAfter: "Crafting a compelling portfolio website and articulating your design decisions.",
          whatToLearn: [
            "User authentication and authorization best practices",
            "Database schemas, relationships, and queries",
            "Performance optimization, accessibility (WCAG AA), and responsive mobile ergonomics",
          ],
          whyItMatters: "Having 1 exceptional project beats 10 shallow tutorial clones every single time.",
          whatToPractice: [
            "Conduct usability testing with 3 friends and implement their feedback",
            "Measure and optimize lighthouse performance and load times",
          ],
          whatToBuild: "A comprehensive, production-ready web application solving a real need for real people",
          whatSuccessLooksLike: "A fast, polished, bug-free application with active users or real data.",
          whatToDoNext: "Publish your portfolio and prepare for interviews.",
          tasks: [
            { id: "t-13", text: "Design database schema and implement persistent cloud storage", done: false, category: "Backend" },
            { id: "t-14", text: "Add secure authentication and user-specific data isolation", done: false, category: "Auth" },
            { id: "t-15", text: "Conduct user testing with 3 people and fix the top 2 friction points", done: false, category: "UX" },
          ],
        },
        {
          id: "stg-6",
          stageNumber: 6,
          stageKey: "PORTFOLIO & PROOF OF WORK",
          title: "Case Studies, Live Portfolio & Clean GitHub",
          subtitle: "Tell the story of how you build and why your decisions matter",
          estimatedTime: "2-3 weeks",
          whyLearningThis: "Hiring managers spend 30 seconds scanning your links. First impressions make or break opportunities.",
          howItHelpsCareer: "Converts visitors, recruiters, and clients into inbound interview calls and contracts.",
          whatComesAfter: "Active interview preparation, technical problem solving, and outreach.",
          whatToLearn: [
            "How to write engaging project case studies highlighting problems, solutions, and trade-offs",
            "Writing clear README files with architecture diagrams, setup commands, and demo GIFs",
            "Personal branding, online presence, and domain configuration",
          ],
          whyItMatters: "Good work hidden in a private folder doesn't get hired. Visibility creates luck.",
          whatToPractice: [
            "Record a 90-second Loom demo video walking through your flagship project",
            "Write a concise case study explaining 1 hard technical problem you solved",
          ],
          whatToBuild: "A minimalist personal portfolio site with your bio, projects, live links, and contact info",
          whatSuccessLooksLike: "A lightning-fast, mobile-friendly portfolio that clearly presents who you are.",
          whatToDoNext: "Begin strategic outreach and technical interview preparation.",
          tasks: [
            { id: "t-16", text: "Build and deploy a clean personal portfolio website on a custom domain", done: false, category: "Portfolio" },
            { id: "t-17", text: "Write thorough README documentation for your 2 best projects with demo media", done: false, category: "Docs" },
            { id: "t-18", text: "Draft a 1-page PDF resume tailored directly for this role", done: false, category: "Career" },
          ],
        },
        {
          id: "stg-7",
          stageNumber: 7,
          stageKey: "CAREER LAUNCH & GROWTH",
          title: "Interview Mastery, System Design & Launch",
          subtitle: `Land your first role or freelance contracts as a ${formattedTitle}`,
          estimatedTime: "4-8 weeks",
          whyLearningThis: "Interviewing is a separate skill from day-to-day coding that requires dedicated practice.",
          howItHelpsCareer: "Helps you negotiate better offers and land teams where you will genuinely thrive.",
          whatComesAfter: "Promotion, seniority, or launching your own independent products.",
          whatToLearn: [
            "Technical interview patterns, behavioral STAR method answers, and live problem-solving",
            "How to ask insightful questions to identify great engineering cultures",
            "Freelance pricing, proposal writing, or salary negotiation tactics",
          ],
          whyItMatters: "Prepares you to communicate your value calmly without impostor syndrome.",
          whatToPractice: [
            "Do 3 mock technical interviews with peers or mentors",
            "Contribute a small fix or documentation improvement to an open-source repo",
          ],
          whatToBuild: "A targeted spreadsheet tracking 20 companies or clients you genuinely admire",
          whatSuccessLooksLike: "Receiving your first formal job offer or signed client agreement.",
          whatToDoNext: "Start strong in your new role and keep learning consistently.",
          tasks: [
            { id: "t-19", text: "Practice 10 common technical interview scenarios and behavioral stories", done: false, category: "Interview" },
            { id: "t-20", text: "Reach out directly to 5 practitioners in this field for 15-minute coffee chats", done: false, category: "Networking" },
            { id: "t-21", text: "Submit 10 high-quality, customized applications with tailored cover notes", done: false, category: "Applications" },
          ],
        },
      ];

  // Resources
  const resources = [
    {
      id: "res-c1",
      name: isMedical ? "Kahn Academy MCAT & Biology" : isLaw ? "Harvard Law Review Case Studies" : "MDN Web Docs & Official Guides",
      type: "free" as const,
      category: "Official Curriculum",
      description: "The gold-standard reference for fundamental principles, syntax, and case law.",
      urlOrNote: "https://developer.mozilla.org",
    },
    {
      id: "res-c2",
      name: isRegulated ? "National Board Review & Guidelines" : "freeCodeCamp Interactive Tracks",
      type: "free" as const,
      category: "Interactive Practice",
      description: "Comprehensive step-by-step curriculum with hands-on practice problems.",
      urlOrNote: "https://www.freecodecamp.org",
    },
    {
      id: "res-c3",
      name: isRegulated ? "Kaplan / Princeton Review Test Prep" : "Frontend Masters / O'Reilly Technical Library",
      type: "paid" as const,
      category: "In-Depth Mastery",
      description: "Deep-dive workshops taught by recognized industry and board leaders.",
      urlOrNote: "https://frontendmasters.com",
    },
  ];

  // Projects
  const projects = [
    {
      id: "proj-c1",
      title: isRegulated ? "Foundational Research & Case Synthesis" : "Minimal Interactive Tool / Sandbox",
      level: "Beginner" as const,
      objective: `Build a clean proof-of-concept milestone for ${formattedTitle}`,
      skillsPracticed: ["Core concepts", "Clean formatting", "Basic problem solving"],
      expectedOutput: "A completed initial artifact showing fundamental grasp of the material.",
      difficulty: "Gentle (1-3 days)",
      suggestedNextStep: "Add automated tests or interactive features.",
      completed: false,
    },
    {
      id: "proj-c2",
      title: isRegulated ? "Comprehensive Clinical / Case Review Study" : "Dynamic Application with Live Data",
      level: "Intermediate" as const,
      objective: "Build a multi-step solution incorporating asynchronous data and user state.",
      skillsPracticed: ["Data handling", "Error recovery", "Edge-case logic"],
      expectedOutput: "A working tool with persistence that handles unpredictable inputs.",
      difficulty: "Moderate (1-2 weeks)",
      suggestedNextStep: "Deploy to production with user authentication.",
      completed: false,
    },
    {
      id: "proj-c3",
      title: isRegulated ? "Peer-Reviewed Thesis or Clinical Capstone" : "Full-Stack Flagship Product with Database",
      level: "Advanced" as const,
      objective: "Create a complete, polished software or analytical solution solving a real human need.",
      skillsPracticed: ["Architecture", "Security & Persistence", "Performance optimization", "Documentation"],
      expectedOutput: "A high-finish public product with case studies and clean codebase.",
      difficulty: "Challenging (3-4 weeks)",
      suggestedNextStep: "Present to potential employers, users, or clients.",
      completed: false,
    },
  ];

  const recommendation = {
    id: `dir-${Date.now()}`,
    directionName: formattedTitle,
    careerGoal: careerGoal,
    tagline: isRegulated
      ? `A rigorous, highly respected professional journey requiring formal credentials and statutory licensing`
      : `Build, create, and launch modern solutions in ${formattedTitle} with project-driven mastery`,
    simpleExplanation: isRegulated
      ? `${formattedTitle} is a licensed profession requiring formal education, state examinations, and supervised practice to protect public health, safety, or legal rights.`
      : `${formattedTitle} focuses on solving real human problems by creating digital, creative, or architectural products with measurable real-world impact.`,
    whyItFitsYou: profile?.headline
      ? `Your profile as "${profile.headline}" aligns with the problem-solving and curiosity demands of this path.`
      : `This pathway matches your stated career goal of becoming a ${formattedTitle}.`,
    dayInTheLife: isRegulated
      ? [
          "Reviewing active cases, diagnostic reports, or flight plans",
          "Working directly with patients, clients, or flight crew teams under strict protocol",
          "Documenting procedures accurately for legal and clinical compliance",
          "Collaborating with multidisciplinary specialists to solve complex challenges",
        ]
      : [
          "Understanding user needs and planning technical architecture",
          "Writing clean, maintainable code or crafting responsive interfaces",
          "Debugging issues and testing edge cases with teammates",
          "Shipping updates to live users and monitoring real performance",
        ],
    beginnerSkills: isRegulated
      ? [
          "Scientific / Legal analytical reasoning",
          "High-stakes attention to detail and procedure",
          "Empathetic communication under pressure",
          "Ethical decision making and statutory compliance",
        ]
      : [
          "Core syntax & fundamental mental models",
          "Problem breakdown & algorithmic thinking",
          "Version control with Git & command line basics",
          "Building responsive, user-centered solutions",
        ],
    whatYouCanTryToday: isRegulated
      ? "Review a real diagnostic case study or official exam sample question to test your analytical instincts."
      : "Open a free browser playground and build a 10-line interactive test in 5 minutes.",
    futureOpportunities: isRegulated
      ? [
          "Licensed Specialist at leading hospitals, firms, or major airlines",
          "Department Director or Senior Partner overseeing operations",
          "Academic Clinical Faculty or Institutional Consultant",
        ]
      : [
          `Junior to Senior ${formattedTitle} at high-growth teams`,
          "Independent Consultant or Freelance Specialist for top clients",
          "Founder / Creator building proprietary software products",
        ],
    isRegulatedProfession: isRegulated,
    formalRequirements: formalRequirements,
    challenge: {
      title: `Hands-on Diagnostic: ${formattedTitle}`,
      scenario: isRegulated
        ? `A complex scenario arrives requiring methodical deduction, rule-following, and prioritizing safety above speed.`
        : `A user needs a responsive solution that updates in real time and provides clean, clear feedback.`,
      taskDescription: isRegulated
        ? "Analyze the given circumstances and outline your initial diagnostic reasoning in 2 clear sentences."
        : "Make a small adjustment to the template code, test the interactive button, and observe the result.",
      type: (isRegulated ? "logic" : "code") as "logic" | "code",
      starterTemplate: isRegulated
        ? undefined
        : `<div class="p-6 bg-white rounded-2xl border border-neutral-200">
  <h3 class="text-lg font-bold text-neutral-900">${formattedTitle} Sandbox</h3>
  <p class="text-sm text-neutral-600 mt-1">Ready to test your hands-on instincts.</p>
  <button class="mt-4 px-4 py-2 bg-neutral-900 text-white text-xs rounded-full font-medium hover:bg-black transition">Run Test →</button>
</div>`,
      sampleGuidance: "Focus on clarity and simplicity over complicated jargon.",
    },
    comparison: {
      whatIsIt: isRegulated ? "A legally regulated, highly specialized professional service." : `Building and delivering solutions in ${formattedTitle}.`,
      whatWouldIDo: isRegulated ? "Diagnose, evaluate, document, and treat or represent patients/clients." : "Plan, design, code, and deploy real systems.",
      creativeFactor: isRegulated ? "Medium — creative problem solving within rigorous safety bounds." : "High — turning imagination into working software.",
      problemSolving: "Very High — systematic logic, debugging, and critical decision-making.",
      workingWithPeople: isRegulated ? "Very High — continuous interaction with patients, clients, and staff." : "Medium to High — collaboration with designers and engineers.",
      beginnerDifficulty: isRegulated ? "High — requires multi-year academic degrees and licensing exams." : "Gentle to Moderate start with plenty of free learning resources.",
      whatCanITryToday: isRegulated ? "Read a real clinical case or FAA pilot flight checklist." : "Write a 5-minute script or design a button in Figma.",
      whoMightEnjoy: isRegulated ? "People who value deep mastery, rigorous ethics, and helping people directly." : "Curious builders who like seeing their work come alive on screen.",
    },
  };

  return {
    recommendation,
    roadmap: stages,
    resources,
    projects,
  };
}
