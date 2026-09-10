import { OpenAI } from "openai";
import { GoogleGenAI } from "@google/genai";

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";
const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
// Default to fast, verified meta/llama-3.2-11b-vision-instruct on NVIDIA NIM
const DEFAULT_NVIDIA_MODEL = "meta/llama-3.2-11b-vision-instruct";
const rawModel = process.env.NVIDIA_MODEL || "";
// Avoid hanging or expired models
const NVIDIA_MODEL =
  rawModel && rawModel !== "openai/gpt-oss-20b" && !rawModel.includes("meta/llama-3.1-70b-instruct")
    ? rawModel
    : DEFAULT_NVIDIA_MODEL;

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
 * Universal AI Caller:
 * Priority 1: NVIDIA NIM (Llama 3.2 11B)
 * Priority 2: Google Gemini (gemini-3.8-flash)
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
    temperature = 0.5,
    timeoutMs = 3500,
  } = options;

  let lastError: any = null;

  // 1. Try NVIDIA NIM
  const openAIClient = getOpenAIClient();
  if (openAIClient) {
    try {
      const completion = await withTimeout(
        openAIClient.chat.completions.create({
          model: NVIDIA_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
        timeoutMs,
        `NVIDIA (${NVIDIA_MODEL})`
      );
      const text = completion.choices?.[0]?.message?.content;
      if (text && text.trim().length > 0) {
        return text;
      }
    } catch (err: any) {
      console.warn(`[AI Engine] NVIDIA error/timeout:`, err.message || err);
      lastError = err;
    }
  }

  // 2. Try Google Gemini
  const geminiClient = getGeminiClient();
  if (geminiClient) {
    try {
      const res = await withTimeout(
        geminiClient.models.generateContent({
          model: "gemini-3.8-flash",
          contents: `${systemPrompt}\n\n${userPrompt}`,
          config: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        }),
        timeoutMs,
        "Google Gemini"
      );
      const text = res.text;
      if (text && text.trim().length > 0) {
        return text;
      }
    } catch (err: any) {
      console.warn(`[AI Engine] Gemini error/timeout:`, err.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error("All AI providers unavailable or timed out");
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
