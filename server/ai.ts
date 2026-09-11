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
    const geminiModels = ["gemini-3.6-flash", "gemini-flash-latest"];
    const conversationText = fullMessages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    for (const modelName of geminiModels) {
      try {
        const res = await withTimeout(
          geminiClient.models.generateContent({
            model: modelName,
            contents: conversationText,
            config: {
              systemInstruction: systemPrompt || undefined,
              temperature,
              maxOutputTokens: maxTokens,
            },
          }),
          timeoutMs,
          `Google Gemini (${modelName})`
        );
        const text = res.text;
        if (text && text.trim().length > 0) return text;
      } catch (gemErr: any) {
        console.warn(`[AI Engine] Gemini (${modelName}) error/timeout:`, gemErr?.message || gemErr);
        lastError = gemErr;
      }
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

// Tailored, field-agnostic deterministic fallback generator
export function synthesizeRecommendationsFallback(answers: any) {
  const activities = (answers?.freeTimeActivities || []).join(" ").toLowerCase();
  const strengths = (answers?.problemSolvingStyle || "").toLowerCase();
  const disliked = (answers?.dislikedTasks || []).join(" ").toLowerCase();
  const workStyle = answers?.workEnvironment || "Independent deep work with collaborative syncs";
  const stage = answers?.educationStage || answers?.educationLevel || "Student exploring options";
  const fieldOfStudy = (answers?.fieldOfStudy || "").toLowerCase();
  const curiousTopics = (answers?.curiousTopics || []).map((t: string) => t.toLowerCase()).join(" ");
  const existingSkills = (answers?.existingSkills || []).map((s: string) => s.toLowerCase()).join(" ");
  const careerGoal = (answers?.careerGoal || "").toLowerCase();
  const freeform = (answers?.freeformNotes || "").toLowerCase();
  const priority = (answers?.priorities || [])[0] || "Creative fulfillment & practical growth";

  const allText = `${activities} ${strengths} ${fieldOfStudy} ${curiousTopics} ${existingSkills} ${careerGoal} ${freeform}`;

  // Domain signals
  const scoreDesign = (allText.match(/design|visual|aesthetic|ui|ux|art|creative|layout|figma|canva/g) || []).length;
  const scoreBusiness = (allText.match(/business|startup|entrepreneur|marketing|product|strategy|lead|management|commerce/g) || []).length;
  const scoreFinance = (allText.match(/finance|invest|money|accounting|economic|valuation|spreadsheet|wealth|bank/g) || []).length;
  const scoreMedia = (allText.match(/media|journalism|writing|story|editorial|content|publish|podcast|video/g) || []).length;
  const scorePsychology = (allText.match(/psychology|mental|behavior|counsel|empathy|people|human|social science/g) || []).length;
  const scoreLaw = (allText.match(/law|legal|policy|governance|justice|advocacy|ethics|regulation/g) || []).length;
  const scoreHealth = (allText.match(/health|medicine|doctor|patient|bio|clinic|nurs|physician/g) || []).length;
  const scoreScience = (allText.match(/science|physics|chem|robot|energy|climate|mechanic|engineer|hardware/g) || []).length;
  const scoreTech = (allText.match(/code|software|web|app|python|javascript|program|ai|data|cyber|tech/g) || []).length;

  const domainScores = [
    { domain: "design", score: scoreDesign },
    { domain: "business", score: scoreBusiness },
    { domain: "finance", score: scoreFinance },
    { domain: "media", score: scoreMedia },
    { domain: "psychology", score: scorePsychology },
    { domain: "law", score: scoreLaw },
    { domain: "health", score: scoreHealth },
    { domain: "science", score: scoreScience },
    { domain: "tech", score: scoreTech },
  ].sort((a, b) => b.score - a.score);

  const topDomain = domainScores[0].score > 0 ? domainScores[0].domain : "general";
  const secondDomain = domainScores[1].score > 0 ? domainScores[1].domain : "general";

  // Build Tailored Profile
  const profileHeadline =
    topDomain === "design"
      ? "Visual Creator with Spatial & Aesthetic Intuition"
      : topDomain === "business"
      ? "Strategic Thinker with Entrepreneurial Instincts"
      : topDomain === "finance"
      ? "Analytical Evaluator with Quantitative Curiosity"
      : topDomain === "media"
      ? "Narrative Explorer with a Voice for Storytelling"
      : topDomain === "psychology"
      ? "Empathetic Observer of Human Behavior & People"
      : topDomain === "law"
      ? "Principled Problem Solver with Analytical Rigor"
      : topDomain === "health"
      ? "Dedicated Explorer with Care & Scientific Curiosity"
      : topDomain === "science"
      ? "Investigative Thinker Driven by First Principles"
      : topDomain === "tech"
      ? "Hands-On Builder with Digital Curiosity"
      : "Curious Explorer Ready for Real-World Discovery";

  const profile = {
    headline: profileHeadline,
    summary: `You enjoy understanding how ideas translate into real impact. You prefer engaging feedback over passive theory, and you value ${priority.toLowerCase()} with room to experiment without rigid micromanagement.`,
    naturalStrengths: [
      topDomain === "design"
        ? "Visual hierarchy and intuitive user empathy"
        : topDomain === "business"
        ? "Spotting opportunities and connecting problems to solutions"
        : topDomain === "finance"
        ? "Logical structuring and interpreting numbers with clarity"
        : topDomain === "media"
        ? "Articulating ideas clearly and finding compelling angles"
        : topDomain === "psychology"
        ? "Active listening and understanding what drives people"
        : topDomain === "law"
        ? "Logical reasoning, clarity of thought, and structured arguments"
        : topDomain === "health"
        ? "Detail-oriented curiosity and genuine empathy for people"
        : topDomain === "science"
        ? "Investigative reasoning and testing hypotheses empirically"
        : "Intuitive problem-solving and finding patterns quickly",
      "Comfortable learning by doing and iterating through feedback",
      "Resilience when testing and improving practical projects",
    ],
    workStyle: workStyle,
    motivation: `${priority} through tangible progress and mastery`,
    thingsToAvoid: [
      disliked.length > 5 ? disliked : "Repetitive memorization with no clear practical application",
      "High-pressure cold sales or aggressive micromanagement",
      "Dry theoretical lectures disconnected from real-world practice",
    ],
    curiosityAreas: (answers?.curiousTopics && answers.curiousTopics.length > 0)
      ? answers.curiousTopics
      : ["Discovering new fields", "Hands-on projects", "Practical skill mastery"],
    startingLevel: `Calibrated for ${stage}`,
  };

  // Comprehensive Catalog of Multi-Disciplinary Recommendations
  const CATALOG: Record<string, any> = {
    design_ux: {
      id: "dir-product-ux",
      directionName: "Product UX & Interface Design",
      category: "Design",
      tagline: "Design digital experiences that feel effortless, intuitive, and human",
      simpleExplanation:
        "UX designers figure out how an app, website, or physical interface should flow. You listen to real users, map journeys, and create mockups that make complex tools feel delightfully simple.",
      whyItFitsYou: "You value clarity, aesthetics, and human empathy. UX lets you shape how millions experience technology without getting stuck in deep mathematical code.",
      dayInTheLife: [
        "Interviewing users to find out where they get confused or frustrated",
        "Sketching user journeys, wireframes, and prototypes in tools like Figma",
        "Balancing typography, spatial rhythm, and responsive screen hierarchy",
        "Testing mockups with real people to ensure every button is effortless to find",
      ],
      beginnerSkills: [
        "Visual hierarchy, typography, and spacing principles",
        "Wireframing and user journey mapping",
        "Figma essentials (auto-layout, components, interactive prototypes)",
        "Conducting friendly 10-minute usability feedback sessions",
      ],
      whatYouCanTryToday: "Find an app on your phone that frustrates you, and sketch a 3-step redesign on paper.",
      futureOpportunities: [
        "Product Designer at fast-growing digital startups",
        "UX Researcher discovering human behavioral insights",
        "Design Systems Specialist creating reusable component standards",
      ],
      challenge: {
        title: "Redesign a Confusing Mobile Checkout",
        scenario: "An independent bookstore app has a checkout screen where customers frequently tap 'Cancel Order' because it looks identical to 'Confirm Purchase'.",
        taskDescription: "Identify the critical layout flaw and select the most intuitive placement, color contrast, and spacing to prevent mistakes.",
        type: "design",
        options: [
          "Separate the buttons: make 'Confirm' large and high-contrast, move 'Cancel' to a subtle text link below.",
          "Make both buttons identical in size and place them side by side with opposite colors.",
          "Hide the cancel button inside a hamburger menu."
        ],
        sampleGuidance: "Notice which button needs prominent visual hierarchy and where cancellation safely belongs.",
      },
      comparison: {
        whatIsIt: "Designing how software and products feel, function, and look to real people.",
        whatWouldIDo: "Draw wireframes, build Figma prototypes, and simplify confusing user flows.",
        creativeFactor: "Very High — visual balance, color palettes, and interactive polish.",
        problemSolving: "High — empathetic psychology: figuring out why people get stuck.",
        workingWithPeople: "High — collaborating with developers, users, and product leads.",
        beginnerDifficulty: "Low barrier to start — you already use digital apps every single day.",
        whatCanITryToday: "Open Figma for free and recreate the screen of your favorite music app.",
        whoMightEnjoy: "Anyone with good visual taste who notices when bad design ruins an experience.",
      },
    },

    business_pm: {
      id: "dir-product-management",
      directionName: "Product Management & Strategy",
      category: "Business",
      tagline: "Lead cross-functional teams to decide what to build, why, and for whom",
      simpleExplanation:
        "Product Managers act as the strategic bridge between customers, designers, engineers, and leadership. You identify real problems worth solving and define the roadmap to deliver value.",
      whyItFitsYou: "You enjoy big-picture thinking, prioritizing initiatives, and coordinating people toward an inspiring shared goal.",
      dayInTheLife: [
        "Talking with customers to discover unmet needs and market pain points",
        "Prioritizing features for upcoming sprints based on user impact and effort",
        "Writing clean product requirement documents (PRDs) that rally teams",
        "Analyzing product metrics and engagement trends to iterate faster",
      ],
      beginnerSkills: [
        "Customer discovery interviewing and problem framing",
        "Writing user stories and acceptance criteria",
        "Prioritization frameworks (RICE, MoSCoW, Opportunity Scoring)",
        "Basic product metrics (retention, conversion, active users)",
      ],
      whatYouCanTryToday: "Pick a product you use daily (like Spotify or Notion) and write a 1-page proposal for 1 new feature.",
      futureOpportunities: [
        "Associate Product Manager (APM) at innovative technology companies",
        "Product Operations Lead optimizing team workflows and customer feedback",
        "Venture Builder launching zero-to-one initiatives inside enterprises",
      ],
      challenge: {
        title: "Prioritize Features for a Student Study App",
        scenario: "Your team has 2 weeks before exam season. You can only build ONE of three requested features: 1) AI flashcard generator, 2) Dark mode theme, 3) Social leaderboards.",
        taskDescription: "Evaluate the user urgency, build effort, and retention impact to make a clear strategic recommendation.",
        type: "business",
        options: [
          "Feature 1 (AI Flashcards): Highest direct utility for upcoming exams, maximizes immediate student retention.",
          "Feature 2 (Dark mode): Low effort but minor impact on study outcomes.",
          "Feature 3 (Leaderboards): Might cause anxiety right before exams rather than helpful focus."
        ],
        sampleGuidance: "Prioritize the feature that directly solves the urgent seasonal pain point for students.",
      },
      comparison: {
        whatIsIt: "Deciding what problems a team should solve and orchestrating the roadmap to solve them.",
        whatWouldIDo: "Interview users, define feature scopes, align teams, and track outcome metrics.",
        creativeFactor: "Medium-High — creative strategic vision and problem framing.",
        problemSolving: "Very High — balancing competing tradeoffs, timelines, and user needs.",
        workingWithPeople: "Very High — constant collaboration with designers, builders, and users.",
        beginnerDifficulty: "Moderate — requires good communication and structured decision-making.",
        whatCanITryToday: "Write down the #1 thing that annoys you about an everyday app and outline a fix.",
        whoMightEnjoy: "Natural organizers, strategic thinkers, and curious leaders.",
      },
    },

    business_marketing: {
      id: "dir-growth-marketing",
      directionName: "Brand Strategy & Growth Marketing",
      category: "Business",
      tagline: "Tell stories that captivate audiences and build sustainable brand momentum",
      simpleExplanation:
        "Modern marketers combine narrative storytelling with experimentation. You understand what makes people care, craft messages that resonate, and test creative campaigns that turn curious visitors into loyal advocates.",
      whyItFitsYou: "You enjoy understanding human motivation, crafting persuasive communication, and seeing direct results from your creative campaigns.",
      dayInTheLife: [
        "Researching audience communities to understand their vocabulary and values",
        "Writing compelling copy for landing pages, social narratives, and newsletters",
        "Designing experiments to test which messaging hooks drive the highest engagement",
        "Collaborating with creators and media partners on authentic brand stories",
      ],
      beginnerSkills: [
        "Copywriting fundamentals and headline hook design",
        "Audience persona research and positioning frameworks",
        "Content distribution across organic channels and newsletters",
        "Funnel analytics (impressions, clicks, conversions, retention)",
      ],
      whatYouCanTryToday: "Rewrite the hero headline of a local brand's website to make it 2x clearer and more compelling.",
      futureOpportunities: [
        "Brand Strategist shaping voice and identity for emerging companies",
        "Growth Marketing Lead driving acquisition and customer retention",
        "Creative Director overseeing multimedia campaigns and storytelling",
      ],
      challenge: {
        title: "Craft a High-Converting Value Hook",
        scenario: "An eco-friendly water bottle brand is launching. Their current headline is 'We make sustainable drinkware products'. Conversion is low.",
        taskDescription: "Select the value hook that focuses on emotional benefit, lifestyle identity, and clear differentiation.",
        type: "business",
        options: [
          "Headline: 'Keeps water cold for 24 hours while keeping 100 plastic bottles out of oceans. Guaranteed for life.'",
          "Headline: 'Buy our drinkware because sustainability is good for the future.'",
          "Headline: 'A bottle that holds liquid with stainless steel materials.'"
        ],
        sampleGuidance: "Great marketing connects tangible personal benefit with larger emotional meaning.",
      },
      comparison: {
        whatIsIt: "Connecting valuable products with the people who need them through compelling storytelling.",
        whatWouldIDo: "Write persuasive copy, run audience experiments, and build brand awareness.",
        creativeFactor: "High — storytelling, copywriting, visual curation, and campaign concepts.",
        problemSolving: "High — decoding audience psychology and analyzing campaign metrics.",
        workingWithPeople: "High — engaging communities, partners, creators, and internal teams.",
        beginnerDifficulty: "Low barrier to start — you already consume brand media every day.",
        whatCanITryToday: "Deconstruct an advertisement that made you stop scrolling and explain why it worked.",
        whoMightEnjoy: "Creative communicators, storytellers, and keen observers of cultural trends.",
      },
    },

    finance_analysis: {
      id: "dir-financial-analysis",
      directionName: "Financial Analysis & Investment Strategy",
      category: "Finance",
      tagline: "Evaluate economic health, analyze market value, and allocate capital wisely",
      simpleExplanation:
        "Financial analysts examine company data, balance sheets, and industry trends to understand true economic value. You build models that help founders, funds, and individuals make smart investment choices.",
      whyItFitsYou: "You appreciate clear numbers, logical structures, and understanding what makes companies sustainable and valuable.",
      dayInTheLife: [
        "Reviewing financial statements (Income Statement, Balance Sheet, Cash Flow)",
        "Building dynamic spreadsheet models to forecast revenues and cash burn",
        "Comparing company valuation multiples against industry benchmarks",
        "Writing crisp investment memos summarizing opportunities and key risks",
      ],
      beginnerSkills: [
        "Spreadsheet mastery (dynamic formulas, VLOOKUP/XLOOKUP, pivot tables)",
        "Understanding the three core financial statements and how they link",
        "Basic corporate valuation methods (comparable company analysis, DCF basics)",
        "Synthesizing complex financial data into a clean 1-page executive summary",
      ],
      whatYouCanTryToday: "Pick a public company you admire, open their latest quarterly report, and find their total revenue and profit margin.",
      futureOpportunities: [
        "Financial Analyst at growth companies, venture funds, or investment banks",
        "Corporate Finance Associate guiding budgeting and capital planning",
        "Equity Research Specialist publishing market trends and company valuations",
      ],
      challenge: {
        title: "Analyze a SaaS Company's Cash Burn",
        scenario: "A startup has $1,200,000 in the bank. They earn $40,000/month and spend $140,000/month on servers and team salaries.",
        taskDescription: "Calculate the net monthly burn rate and runway in months, and recommend the best immediate financial action.",
        type: "analysis",
        options: [
          "Net Burn: $100,000/month. Runway: 12 months. Recommendation: Begin fundraising in month 6 while trimming unnecessary SaaS tools.",
          "Net Burn: $140,000/month. Runway: 8.5 months. Recommendation: Double marketing spend immediately.",
          "Net Burn: $40,000/month. Runway: 30 months. Recommendation: Do nothing."
        ],
        sampleGuidance: "Runway = Cash in Bank ÷ (Monthly Spend - Monthly Revenue).",
      },
      comparison: {
        whatIsIt: "Evaluating financial health, modeling future scenarios, and making data-backed capital decisions.",
        whatWouldIDo: "Build financial models, review company performance, and assess investment risk.",
        creativeFactor: "Medium — structuring clean models and presenting compelling investment narratives.",
        problemSolving: "Very High — quantitative logic, risk assessment, and scenario analysis.",
        workingWithPeople: "Medium — presenting findings to leadership, founders, and investors.",
        beginnerDifficulty: "Moderate — spreadsheets are accessible, but requires comfort with math.",
        whatCanITryToday: "Build a simple monthly budget spreadsheet with income, fixed costs, and savings rate.",
        whoMightEnjoy: "Detail-oriented thinkers who love uncovering the financial reality behind headlines.",
      },
    },

    media_journalism: {
      id: "dir-journalism-writing",
      directionName: "Investigative Journalism & Editorial Writing",
      category: "Media",
      tagline: "Uncover hidden truths, interview key voices, and craft stories that inform the public",
      simpleExplanation:
        "Journalists and editorial writers research real-world events, interview people on the ground, verify facts, and write compelling articles that bring clarity to complex modern issues.",
      whyItFitsYou: "You possess genuine curiosity about how the world works, an eye for detail, and a desire to communicate truth with clarity and impact.",
      dayInTheLife: [
        "Researching public documents, data reports, and emerging social trends",
        "Interviewing firsthand witnesses, experts, and community members",
        "Fact-checking claims and cross-referencing multiple verified sources",
        "Drafting engaging long-form features, newsletters, or investigative reports",
      ],
      beginnerSkills: [
        "Conducting thoughtful, non-confrontational investigative interviews",
        "Fact verification and ethical research practices",
        "Structuring narrative journalism (the hook, context, evidence, and takeaway)",
        "Writing crisp, clear sentences that respect reader attention",
      ],
      whatYouCanTryToday: "Interview someone you know about an unusual experience they had, and write a 250-word profile capturing their story.",
      futureOpportunities: [
        "Investigative Reporter at independent publications or news agencies",
        "Editorial Director overseeing high-quality digital magazines and newsletters",
        "Communications & Public Affairs Strategist shaping organizational transparency",
      ],
      challenge: {
        title: "Structure an Investigative Interview Hook",
        scenario: "You are writing a story about how young graduates are navigating their first careers in an uncertain economy.",
        taskDescription: "Select the opening angle that best hooks the reader while establishing factual integrity and human empathy.",
        type: "writing",
        options: [
          "Open with a specific personal moment: a graduate packing their desk, paired with national employment statistics that show they aren't alone.",
          "Open with a dictionary definition of 'employment' followed by a list of government policies.",
          "Open with an angry personal opinion with no cited data or interviewed subjects."
        ],
        sampleGuidance: "The best investigative writing pairs relatable human reality with verified macro data.",
      },
      comparison: {
        whatIsIt: "Investigating facts, interviewing people, and writing compelling stories that inform the public.",
        whatWouldIDo: "Research sources, interview subjects, verify evidence, and write articles or newsletters.",
        creativeFactor: "Very High — crafting voice, pacing, narrative tone, and compelling hooks.",
        problemSolving: "High — piecing together facts, verifying claims, and navigating ethical questions.",
        workingWithPeople: "Very High — interviewing diverse people and building trust with sources.",
        beginnerDifficulty: "Low barrier to start — you can begin writing and interviewing right now.",
        whatCanITryToday: "Read an award-winning article in The Atlantic or ProPublica and outline its structure.",
        whoMightEnjoy: "Insatiably curious questioners, observant listeners, and passionate writers.",
      },
    },

    psych_behavioral: {
      id: "dir-behavioral-psych",
      directionName: "Behavioral Psychology & User Insights",
      category: "Psychology",
      tagline: "Understand what truly drives human decisions, habits, and community culture",
      simpleExplanation:
        "Behavioral researchers study why people act the way they do — what creates habits, why people procrastinate, how teams cooperate, and how environments nudge better human decisions.",
      whyItFitsYou: "You are fascinated by human psychology, interpersonal empathy, and the hidden mental models that shape everyday choices.",
      dayInTheLife: [
        "Designing behavioral experiments and survey frameworks",
        "Observing user decisions and conducting deep qualitative interviews",
        "Analyzing cognitive biases (loss aversion, social proof, choice overload)",
        "Helping product, health, or policy teams design healthier environments and habits",
      ],
      beginnerSkills: [
        "Qualitative interviewing and observing non-verbal cues",
        "Cognitive bias frameworks (System 1 vs System 2 thinking, heuristics)",
        "Designing clean, non-leading research surveys",
        "Synthesizing qualitative feedback into actionable behavioral nudges",
      ],
      whatYouCanTryToday: "Track your own decision habits for 1 day: notice what friction stopped you from doing something good, and what trigger made you check your phone.",
      futureOpportunities: [
        "Behavioral Scientist at public policy labs, health tech, or consumer apps",
        "User Insights Specialist translating customer psychology for product teams",
        "Organizational Development & People Strategy Consultant",
      ],
      challenge: {
        title: "Diagnose Why Students Abandon a Study Habit",
        scenario: "A learning app notices 80% of users sign up with great intentions, but stop using the app by day 3.",
        taskDescription: "Identify the psychological barrier (cognitive overload vs. lack of immediate feedback) and choose the best behavioral nudge.",
        type: "analysis",
        options: [
          "Reduce daily goal from 45 mins to 5 mins ('micro-habits') and celebrate day-1 completion with an immediate micro-reward.",
          "Send 5 push notifications per day warning students they will fail their exams.",
          "Add 10 more lessons to the curriculum so there is more content to choose from."
        ],
        sampleGuidance: "Small wins and reduced initial cognitive friction beat high-pressure warnings every time.",
      },
      comparison: {
        whatIsIt: "Exploring the cognitive and emotional drivers behind human habits, decisions, and interactions.",
        whatWouldIDo: "Conduct qualitative studies, map cognitive friction, and design behavioral nudges.",
        creativeFactor: "Medium-High — creative experiment design and human-centered solutions.",
        problemSolving: "Very High — deciphering why people say one thing but do another.",
        workingWithPeople: "Very High — deep empathy, listening, and observing people in real settings.",
        beginnerDifficulty: "Gentle start — psychology begins with understanding yourself and those around you.",
        whatCanITryToday: "Read the first chapter of 'Atomic Habits' or 'Thinking, Fast and Slow'.",
        whoMightEnjoy: "Empathetic observers, deep listeners, and students of human nature.",
      },
    },

    law_governance: {
      id: "dir-legal-governance",
      directionName: "Legal Analysis & Corporate Governance",
      category: "Law",
      tagline: "Navigate complex regulations, protect rights, and structure fair agreements",
      simpleExplanation:
        "Legal specialists interpret statutes, draft contracts, protect intellectual property, and ensure organizations act ethically and within the law. You analyze facts with precision to solve high-stakes disputes.",
      whyItFitsYou: "You possess sharp analytical thinking, care about fairness and ethics, and enjoy examining the details of how rules govern society.",
      dayInTheLife: [
        "Reviewing contracts, partnership agreements, and compliance standards",
        "Researching legal precedents and statutory regulations",
        "Drafting clear, unambiguous briefs that protect client interests",
        "Advising decision-makers on ethical tradeoffs and regulatory risk",
      ],
      beginnerSkills: [
        "Reading and briefing legal cases (Facts, Issue, Rule, Application, Conclusion)",
        "Contract fundamentals (offer, acceptance, consideration, breach)",
        "Issue spotting: identifying potential legal conflicts before they arise",
        "Writing logically airtight arguments backed by verifiable citations",
      ],
      whatYouCanTryToday: "Read the terms of service of an app you use, and spot 1 clause regarding user privacy or copyright.",
      futureOpportunities: [
        "Corporate Legal Counsel / Attorney advising businesses on contracts and growth",
        "Public Interest Attorney advocating for civil rights and environmental policy",
        "Legal Operations & Compliance Specialist modernizing contract workflows",
      ],
      challenge: {
        title: "Spot the Legal Conflict in a Freelance Contract",
        scenario: "A graphic designer's client contract says: 'All work created, including preliminary sketches and unused ideas, becomes the exclusive property of the client worldwide forever, without royalty, even if the project is cancelled before payment.'",
        taskDescription: "Identify the unfair clause and propose an equitable revision that protects both parties.",
        type: "logic",
        options: [
          "Revise clause: Intellectual property transfers only upon full payment; preliminary unused sketches remain with the designer.",
          "Sign the agreement immediately without changes to avoid offending the client.",
          "Cross out the entire contract and work with no written agreement."
        ],
        sampleGuidance: "A balanced contract ensures copyright only transfers when agreed compensation has been fulfilled.",
      },
      comparison: {
        whatIsIt: "Structuring rules, agreements, and legal reasoning to resolve disputes and govern organizations.",
        whatWouldIDo: "Analyze regulations, draft contracts, research precedents, and advise on compliance.",
        creativeFactor: "Medium — creative problem-solving within the framework of existing law.",
        problemSolving: "Very High — precise logical analysis, spotting loopholes, and evaluating evidence.",
        workingWithPeople: "High — negotiating with opposing counsel, advising clients, and presenting cases.",
        beginnerDifficulty: "Moderate — requires rigorous reading comprehension and logical precision.",
        whatCanITryToday: "Read a famous landmark Supreme Court case summary on Oyez.org.",
        whoMightEnjoy: "Debaters, critical thinkers, and advocates for justice and clarity.",
      },
    },

    health_medicine: {
      id: "dir-clinical-medicine",
      directionName: "Clinical Medicine & Healthcare Practice",
      category: "Healthcare",
      isRegulatedProfession: true,
      tagline: "Diagnose conditions, heal patients, and advance public health wellbeing",
      simpleExplanation:
        "Medical practitioners combine deep biological sciences with bedside empathy to evaluate symptoms, diagnose disease, and guide patients back to health. This is an esteemed, regulated profession requiring formal medical training and clinical residency.",
      whyItFitsYou: "You possess a passion for the biological sciences, a desire to make an undeniable impact on human lives, and the grit to master rigorous medical knowledge.",
      dayInTheLife: [
        "Examining patients, listening to symptom histories, and ordering diagnostics",
        "Collaborating with nursing teams, surgeons, and specialists on patient care plans",
        "Interpreting lab tests, imaging, and vital signs to identify illnesses",
        "Counseling patients and families on treatments, medications, and preventative health",
      ],
      beginnerSkills: [
        "Foundational human anatomy and physiology principles",
        "Medical terminology and standard vital signs interpretation",
        "Active listening and empathetic patient communication",
        "Scientific literature evaluation and evidence-based practice",
      ],
      whatYouCanTryToday: "Learn how to read normal resting vital signs (Heart rate, Blood Pressure, SpO2, Temperature) and understand what each measures.",
      futureOpportunities: [
        "Attending Physician / Specialist in primary care, emergency, or specialty medicine",
        "Clinical Research Physician leading breakthrough clinical trials",
        "Hospital Medical Director guiding healthcare policy and patient safety",
      ],
      formalRequirements: {
        education: [
          "Bachelor's Degree with Pre-Med prerequisites (Biology, Chemistry, Physics, Organic Chemistry)",
          "Doctor of Medicine (MD) or DO degree from an accredited medical school (4 years)",
        ],
        eligibility: [
          "Competitive science and cumulative GPA (typically 3.6+)",
          "Documented clinical exposure, hospital volunteering, and physician shadowing hours",
          "Letters of recommendation from science professors and practicing clinicians",
        ],
        entranceExams: [
          "MCAT (Medical College Admission Test) covering biological systems, chemical foundations, and critical analysis",
        ],
        qualificationsAndLicensing: [
          "USMLE Step 1 and Step 2 CK examinations",
          "State Medical Board Physician License",
          "Board Certification in chosen medical specialty",
        ],
        practicalExperience: [
          "Clinical Clerkships (Years 3 & 4 of Medical School)",
          "Accredited Residency Training Program (3 to 7 years)",
          "Optional Sub-specialty Fellowship (1 to 3 years)",
        ],
        careerProgression: [
          "Pre-Med Student → Medical Student (MS1-MS4) → Resident Physician → Chief Resident / Fellow → Attending Physician",
        ],
      },
      challenge: {
        title: "Triage a Patient Symptom Scenario",
        scenario: "A 45-year-old patient comes to the clinic with sudden shortness of breath, sharp chest pain when breathing in, and a fast heart rate after a 12-hour international flight.",
        taskDescription: "Recognize the key clinical risk factors and determine the immediate diagnostic priority.",
        type: "case_study",
        options: [
          "Urgent evaluation for possible pulmonary embolism (blood clot after prolonged immobility); check vitals and alert clinical supervisor immediately.",
          "Give the patient a glass of water and tell them to sleep off jet lag at home.",
          "Diagnose immediate acid reflux and send them to the pharmacy."
        ],
        sampleGuidance: "Prolonged immobility on long flights is a classic risk factor for deep vein thrombosis and pulmonary embolism.",
      },
      comparison: {
        whatIsIt: "Diagnosing, treating, and preventing human illness through biological sciences and clinical care.",
        whatWouldIDo: "Examine patients, analyze diagnostic tests, perform procedures, and prescribe treatments.",
        creativeFactor: "Medium — clinical problem solving and personalized patient management.",
        problemSolving: "Extremely High — life-and-death diagnostic reasoning under time constraints.",
        workingWithPeople: "Very High — direct, compassionate care with patients and medical teams.",
        beginnerDifficulty: "High commitment — requires university pre-med prerequisites and medical school.",
        whatCanITryToday: "Shadow a local clinician or volunteer at a community health clinic.",
        whoMightEnjoy: "Dedicated learners who care deeply about biology, health, and helping people.",
      },
    },

    science_sustainable: {
      id: "dir-sustainable-energy",
      directionName: "Sustainable Energy & Climate Systems",
      category: "Science",
      tagline: "Engineer renewable power, climate technology, and resilient environmental systems",
      simpleExplanation:
        "Climate and clean energy specialists design solar arrays, battery storage, smart grids, and carbon reduction systems. You apply physics, materials science, and engineering to solve our planet's biggest challenge.",
      whyItFitsYou: "You care about environmental sustainability and enjoy applying physical sciences and engineering principles to tangible infrastructure.",
      dayInTheLife: [
        "Modeling energy generation and storage efficiency for renewable installations",
        "Analyzing environmental impact data and lifecycle carbon footprints",
        "Testing battery chemistries, solar cell efficiencies, or microgrid controls",
        "Collaborating with municipalities and utility providers to integrate clean power",
      ],
      beginnerSkills: [
        "Foundational thermodynamics, electricity, and power unit conversions (kWh, Megawatts)",
        "Spreadsheet modeling for energy yields and payback periods",
        "Basic GIS (geographic mapping) for renewable site evaluation",
        "Understanding grid storage, battery chemistry basics, and clean tech policy",
      ],
      whatYouCanTryToday: "Inspect your household electricity bill, calculate average daily kilowatt-hour usage, and estimate how many solar panels would cover it.",
      futureOpportunities: [
        "Renewable Energy Systems Engineer designing solar, wind, or storage installations",
        "Climate Tech Product Specialist building decarbonization hardware and software",
        "Environmental Infrastructure Consultant advising cities on net-zero roadmaps",
      ],
      challenge: {
        title: "Evaluate Solar Feasibility for a Community Center",
        scenario: "A community center uses 30,000 kWh of electricity per year at $0.20/kWh ($6,000/year). A 15kW solar array costs $25,000 installed and generates 25,000 kWh/year.",
        taskDescription: "Calculate the annual electricity cost savings and the simple payback period in years.",
        type: "analysis",
        options: [
          "Annual Savings: $5,000/year. Payback Period: 5.0 years ($25,000 ÷ $5,000). Highly recommended investment.",
          "Annual Savings: $1,000/year. Payback Period: 25 years. Not recommended.",
          "Annual Savings: $6,000/year. Payback Period: 1 year."
        ],
        sampleGuidance: "Annual savings = kWh generated × electricity rate ($0.20 × 25,000 = $5,000). Payback = Cost ÷ Annual Savings.",
      },
      comparison: {
        whatIsIt: "Applying physics, engineering, and environmental science to build clean energy systems.",
        whatWouldIDo: "Model energy yields, design renewable systems, analyze battery storage, and assess sites.",
        creativeFactor: "Medium-High — designing efficient physical and electrical systems.",
        problemSolving: "Very High — engineering physics, system efficiency, and environmental constraints.",
        workingWithPeople: "Medium — working with engineers, municipal leaders, and project managers.",
        beginnerDifficulty: "Moderate — requires comfort with high-school level physics and math.",
        whatCanITryToday: "Explore the National Renewable Energy Laboratory (NREL) PVWatts calculator online.",
        whoMightEnjoy: "People who love physical sciences and want to work on the climate transition.",
      },
    },

    tech_frontend: {
      id: "dir-frontend",
      directionName: "Creative Frontend & Interactive Web",
      category: "Technology",
      tagline: "Bring ideas to life on screen using code, motion, and visual creativity",
      simpleExplanation:
        "Frontend creators build everything you see, tap, and interact with on websites and web apps. It is the blend of visual design and logical problem-solving where you see results instantly.",
      whyItFitsYou: "You expressed curiosity in building things with immediate visual feedback. Frontend lets you write a few lines and immediately see buttons move, layouts adapt, and colors change.",
      dayInTheLife: [
        "Turning an idea or drawing into an interactive webpage",
        "Experimenting with animations, colors, and layout rhythm",
        "Solving puzzle-like bugs so everything works smoothly on phones and laptops",
        "Collaborating with designers to make screens easy and fun to use",
      ],
      beginnerSkills: [
        "HTML structure (the skeleton of the web)",
        "CSS styling & modern layouts (Flexbox, Grid, Tailwind)",
        "Modern JavaScript (making buttons react and data update dynamically)",
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
        scenario: "A creator wants a clean, interactive greeting card for their profile that changes moods and responds when clicked.",
        taskDescription: "Adjust the headline, select your color tone, and test the interactive button to see real-time updates.",
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
    },

    tech_backend: {
      id: "dir-backend",
      directionName: "Backend & Systems Engineering",
      category: "Technology",
      tagline: "Build the engines, databases, and APIs powering modern applications",
      simpleExplanation:
        "Backend engineers build the invisible machinery behind websites — storing user accounts, processing payments, and keeping databases fast, secure, and reliable under heavy loads.",
      whyItFitsYou: "You enjoy figuring out how things work behind the scenes. Backend lets you architect rock-solid logic, design clean schemas, and build real APIs.",
      dayInTheLife: [
        "Designing database schemas and writing clean, optimized queries",
        "Building REST and GraphQL APIs that apps use to fetch and store data",
        "Debugging performance bottlenecks to keep systems fast under heavy traffic",
        "Ensuring user passwords and sensitive data are safely encrypted",
      ],
      beginnerSkills: [
        "Python, Node.js, or Go for building server endpoints",
        "SQL and relational database fundamentals",
        "HTTP methods (GET, POST) and API architecture",
        "Basic terminal commands and server deployment",
      ],
      whatYouCanTryToday: "Create a 10-line Express server in Node.js that returns JSON data.",
      futureOpportunities: [
        "Backend Engineer at fast-growing SaaS startups",
        "Cloud / DevOps Specialist managing scalable infrastructure",
        "API & Platform Architect building developer tools",
      ],
      challenge: {
        title: "Design a Mini User Database Schema",
        scenario: "A music streaming app needs to store users, songs, and playlists without duplicates or missing tracks.",
        taskDescription: "Link the playlist table to user IDs and write a simple mock query to get all songs in a playlist.",
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
    },

    data_insights: {
      id: "dir-data",
      directionName: "Data Insights & Visual Storytelling",
      category: "Technology",
      tagline: "Uncover hidden patterns in numbers and tell compelling stories with charts",
      simpleExplanation:
        "Data specialists take raw tables and numbers, find surprising truths, and turn them into clear visuals so people can make smart decisions without getting overwhelmed.",
      whyItFitsYou: "You appreciate clarity and seeing patterns. Data allows you to explore real-world questions with evidence, combining analytical deduction with visual storytelling.",
      dayInTheLife: [
        "Exploring datasets to see what trends are emerging over time",
        "Cleaning messy tables and organizing rows for easy analysis",
        "Designing charts, graphs, and dashboards that make complex ideas clear",
        "Explaining findings to decision-makers using simple, compelling language",
      ],
      beginnerSkills: [
        "Spreadsheet mastery (formulas, pivot tables, clean formatting)",
        "Data visualization principles (choosing the right chart for the story)",
        "Introductory SQL for querying datasets",
        "Python basics (Pandas, Matplotlib) for deeper exploration",
      ],
      whatYouCanTryToday: "Take a dataset of your favorite music or sports and build 1 clear chart in Google Sheets.",
      futureOpportunities: [
        "Data Analyst at media, gaming, or consumer companies",
        "Business Intelligence Specialist building executive dashboards",
        "Product Data Partner helping teams decide which features to build",
      ],
      challenge: {
        title: "Find the Mystery in the Mini Dataset",
        scenario: "Here are daily visits to a community: Mon: 4,200 | Tue: 4,100 | Wed: 4,300 | Thu: 4,150 | Fri: 8,900 | Sat: 9,200 | Sun: 6,100.",
        taskDescription: "Spot the pattern and write a 1-sentence recommendation for when the community should host their weekly live event.",
        type: "logic",
        sampleGuidance: "Look at when visitors naturally flock to the platform without any marketing nudge.",
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
    },
  };

  // Select 3 Distinct, Highly Relevant Recommendations
  const selectedKeys: string[] = [];

  const domainToKeys: Record<string, string[]> = {
    design: ["design_ux", "business_marketing", "media_journalism"],
    business: ["business_pm", "business_marketing", "finance_analysis"],
    finance: ["finance_analysis", "business_pm", "data_insights"],
    media: ["media_journalism", "business_marketing", "psych_behavioral"],
    psychology: ["psych_behavioral", "design_ux", "business_pm"],
    law: ["law_governance", "media_journalism", "business_pm"],
    health: ["health_medicine", "psych_behavioral", "science_sustainable"],
    science: ["science_sustainable", "health_medicine", "data_insights"],
    tech: ["tech_frontend", "design_ux", "tech_backend"],
    general: ["design_ux", "business_pm", "media_journalism"],
  };

  // Add primary domain recommendations
  const primaryKeys = domainToKeys[topDomain] || domainToKeys.general;
  for (const k of primaryKeys) {
    if (!selectedKeys.includes(k) && CATALOG[k]) {
      selectedKeys.push(k);
    }
  }

  // Add secondary domain recommendations if space
  if (selectedKeys.length < 3 && secondDomain && secondDomain !== topDomain) {
    const secondaryKeys = domainToKeys[secondDomain] || [];
    for (const k of secondaryKeys) {
      if (!selectedKeys.includes(k) && CATALOG[k] && selectedKeys.length < 3) {
        selectedKeys.push(k);
      }
    }
  }

  // Backfill if needed
  const fallbackPool = ["design_ux", "business_pm", "media_journalism", "finance_analysis", "tech_frontend"];
  for (const k of fallbackPool) {
    if (selectedKeys.length >= 3) break;
    if (!selectedKeys.includes(k) && CATALOG[k]) {
      selectedKeys.push(k);
    }
  }

  const finalRecommendations = selectedKeys.slice(0, 3).map(k => CATALOG[k]);

  return {
    profile,
    recommendations: finalRecommendations,
  };
}

export function synthesizeRoadmapFallback(direction: any, profile: any) {
  const dirName = direction?.directionName || "Creative Practice & Professional Skills";
  const nameLower = dirName.toLowerCase();

  const isDesign = nameLower.includes("design") || nameLower.includes("ux") || nameLower.includes("ui") || nameLower.includes("art");
  const isBusiness = nameLower.includes("business") || nameLower.includes("product management") || nameLower.includes("marketing") || nameLower.includes("growth") || nameLower.includes("strategy") || nameLower.includes("entrepreneur");
  const isFinance = nameLower.includes("finance") || nameLower.includes("investment") || nameLower.includes("accounting") || nameLower.includes("valuation") || nameLower.includes("economic");
  const isMedia = nameLower.includes("journalism") || nameLower.includes("writing") || nameLower.includes("media") || nameLower.includes("editorial") || nameLower.includes("story");
  const isPsych = nameLower.includes("psychology") || nameLower.includes("behavior") || nameLower.includes("counsel") || nameLower.includes("people");
  const isHealth = nameLower.includes("health") || nameLower.includes("medicine") || nameLower.includes("clinical") || nameLower.includes("bio");

  const stage1 = isDesign
    ? {
        id: "stg-1",
        stageNumber: 1,
        stageKey: "START HERE",
        title: "Visual Foundations & Design Thinking",
        subtitle: `Get comfortable with design vocabulary and Figma without pressure`,
        whatToLearn: [
          "Core visual design fundamentals (contrast, hierarchy, spacing, typography)",
          "How UX differs from visual styling: solving human problems",
          "Free beginner tools (Figma, paper wireframes, color palette generators)",
        ],
        whyItMatters: "Great design starts with clear eyes and empathy, not complex software.",
        whatToPractice: [
          "Sketch 3 paper wireframes of an app screen you use every day",
          "Open Figma (free) and recreate a clean mobile card component",
        ],
        whatToBuild: `A visual mood board and starter component kit for ${dirName}`,
        whatSuccessLooksLike: "You can explain why a button or card layout looks clean and easy to navigate.",
        whatToDoNext: "Learn user journey mapping and auto-layout mechanics.",
        tasks: [
          { id: "t1-1", text: "Create a free Figma account and test out the rectangle, text, and frame tools", done: false },
          { id: "t1-2", text: "Analyze 2 popular mobile apps and write down what makes them easy to use", done: false },
          { id: "t1-3", text: "Bookmark 2 verified design hubs (Laws of UX, Nielsen Norman Group)", done: false },
        ],
      }
    : isBusiness
    ? {
        id: "stg-1",
        stageNumber: 1,
        stageKey: "START HERE",
        title: "Market Fundamentals & Customer Discovery",
        subtitle: `Learn how real businesses create value and identify customer problems`,
        whatToLearn: [
          "Understanding customer pain points vs. feature ideas",
          "Value proposition framing: why people choose one product over another",
          "Basic business models (subscription, marketplace, direct, transactional)",
        ],
        whyItMatters: "The #1 reason ventures and products fail is building something nobody wants.",
        whatToPractice: [
          "Interview 2 friends about an annoying everyday problem they face",
          "Deconstruct how Spotify, Airbnb, or Notion make money and retain users",
        ],
        whatToBuild: "A 1-page Customer Problem & Value Proposition Canvas",
        whatSuccessLooksLike: "You can articulate a real problem without prescribing an immediate tech solution.",
        whatToDoNext: "Learn product metrics and prioritization frameworks.",
        tasks: [
          { id: "t1-1", text: "Write down 3 daily frictions in your life and evaluate if they represent business opportunities", done: false },
          { id: "t1-2", text: "Deconstruct 1 company's business model (value delivered, cost structure, revenue)", done: false },
          { id: "t1-3", text: "Bookmark Y Combinator Startup School and Lenny's Product Archive", done: false },
        ],
      }
    : isFinance
    ? {
        id: "stg-1",
        stageNumber: 1,
        stageKey: "START HERE",
        title: "Financial Statements & Spreadsheet Foundations",
        subtitle: `Master the language of business: Balance Sheet, Income Statement, and Cash Flow`,
        whatToLearn: [
          "The three core financial statements and how they interlock",
          "Essential spreadsheet formulas (SUM, AVERAGE, XLOOKUP, IF)",
          "Key financial ratios (Gross Margin, Operating Margin, Return on Equity)",
        ],
        whyItMatters: "Finance is the universal language of business. Numbers tell the true story of performance.",
        whatToPractice: [
          "Build a clean personal cash flow tracker in Google Sheets or Excel",
          "Look up a public company 10-K report and locate total revenue and net income",
        ],
        whatToBuild: "A linked 3-statement personal or small business dynamic model",
        whatSuccessLooksLike: "You understand how revenue flows all the way to free cash flow.",
        whatToDoNext: "Explore corporate valuation and discounted cash flow modeling.",
        tasks: [
          { id: "t1-1", text: "Set up a clean spreadsheet and practice XLOOKUP and dynamic cell references", done: false },
          { id: "t1-2", text: "Download Apple, Microsoft, or Nike's latest quarterly report and find their profit margin", done: false },
          { id: "t1-3", text: "Bookmark Corporate Finance Institute (CFI) free learning library", done: false },
        ],
      }
    : isMedia
    ? {
        id: "stg-1",
        stageNumber: 1,
        stageKey: "START HERE",
        title: "Story Framing & Editorial Research",
        subtitle: `Learn how investigative writers find compelling angles and verify facts`,
        whatToLearn: [
          "The anatomy of a compelling feature story (hook, nut graf, evidence, takeaway)",
          "Ethical research and primary source verification standards",
          "Conducting friendly, inquisitive interviews that elicit authentic responses",
        ],
        whyItMatters: "Great writing brings order to chaos and informs public understanding.",
        whatToPractice: [
          "Read an award-winning article and outline its structural paragraphs",
          "Draft 5 non-leading interview questions for an expert in your community",
        ],
        whatToBuild: "A 300-word reported profile of an interesting person or local initiative",
        whatSuccessLooksLike: "Your writing is crisp, factual, and free of passive filler words.",
        whatToDoNext: "Move to deep-dive investigative techniques and long-form narrative arcs.",
        tasks: [
          { id: "t1-1", text: "Pick an award-winning story from ProPublica or The Atlantic and highlight the main hook", done: false },
          { id: "t1-2", text: "Conduct a 15-minute interview with someone about an experience they had", done: false },
          { id: "t1-3", text: "Bookmark Nieman Journalism Lab and Purdue Online Writing Lab (OWL)", done: false },
        ],
      }
    : isPsych
    ? {
        id: "stg-1",
        stageNumber: 1,
        stageKey: "START HERE",
        title: "Human Behavior & Cognitive Foundations",
        subtitle: `Understand the subconscious mental models and habits that shape human action`,
        whatToLearn: [
          "Core psychological heuristics: loss aversion, social proof, and cognitive load",
          "How environment design shapes daily habits and choices",
          "Ethical considerations in behavioral nudges and user research",
        ],
        whyItMatters: "Understanding human psychology makes you more empathetic and effective in any career.",
        whatToPractice: [
          "Observe your own daily decision triggers for 24 hours without judgment",
          "Map the cognitive friction in a confusing sign-up or registration form",
        ],
        whatToBuild: "A Cognitive Friction Audit of an everyday product or community service",
        whatSuccessLooksLike: "You can identify why people procrastinate or hesitate without blaming them.",
        whatToDoNext: "Design qualitative user interview studies and behavioral experiments.",
        tasks: [
          { id: "t1-1", text: "Read a summary of Kahneman's System 1 and System 2 cognitive thinking", done: false },
          { id: "t1-2", text: "Audit 1 routine habit and identify the cue, routine, and immediate reward", done: false },
          { id: "t1-3", text: "Bookmark Behavioral Scientist magazine and B-Hub research repository", done: false },
        ],
      }
    : isHealth
    ? {
        id: "stg-1",
        stageNumber: 1,
        stageKey: "START HERE",
        title: "Biological Foundations & Healthcare Orientation",
        subtitle: `Explore core physiological systems and the clinical mindset`,
        whatToLearn: [
          "Major human body systems and homeostatic balance",
          "Standard vital signs (heart rate, blood pressure, respiratory rate, temperature)",
          "The clinical method: gathering history, symptoms, and objective findings",
        ],
        whyItMatters: "A strong scientific baseline is required before advanced clinical training.",
        whatToPractice: [
          "Review normal vital sign ranges and what abnormal readings signify",
          "Learn the most common Greek and Latin medical prefixes and suffixes",
        ],
        whatToBuild: "A Patient Case History Study Sheet mapping symptoms to physiological systems",
        whatSuccessLooksLike: "You can describe how cardiovascular and respiratory systems collaborate.",
        whatToDoNext: "Explore diagnostic tests, clinical ethics, and shadowing opportunities.",
        tasks: [
          { id: "t1-1", text: "Learn the standard normal ranges for adult vital signs", done: false },
          { id: "t1-2", text: "Memorize 15 essential medical prefixes and suffixes (e.g., hyper-, cardio-, -itis)", done: false },
          { id: "t1-3", text: "Bookmark Medscape Reference and NCBI Bookshelf", done: false },
        ],
      }
    : {
        id: "stg-1",
        stageNumber: 1,
        stageKey: "START HERE",
        title: "Orientation & Zero-Pressure Playground",
        subtitle: `Get comfortable with ${dirName} without heavy barriers or fear`,
        whatToLearn: [
          "How this field works in the real world",
          "Key terminology explained simply without intimidating jargon",
          "Free beginner tools and sandbox environments",
        ],
        whyItMatters: "Removing the fear of getting started is the most important first win.",
        whatToPractice: [
          "Explore 2 well-known projects in this domain",
          "Tweak simple starter values in an interactive playground",
        ],
        whatToBuild: `A simple 'Hello World' milestone project for ${dirName}`,
        whatSuccessLooksLike: "You understand what the tools do and feel ready to make small edits.",
        whatToDoNext: "Move to foundational basics with structured bite-sized exercises.",
        tasks: [
          { id: "t1-1", text: "Open an interactive sandbox or tool and inspect a live project", done: false },
          { id: "t1-2", text: "Make your first 3 edits and observe the result in real time", done: false },
          { id: "t1-3", text: "Bookmark 2 reliable free beginner documentation hubs", done: false },
        ],
      };

  const stages = [
    stage1,
    {
      id: "stg-2",
      stageNumber: 2,
      stageKey: "BASICS",
      title: "Foundational Mechanics & First Habits",
      subtitle: "Learn the core concepts step-by-step with zero rush",
      whatToLearn: [
        "The 3 most fundamental building blocks of this discipline",
        "How to troubleshoot mistakes calmly and logically",
        "Setting up a clean, lightweight personal setup",
      ],
      whyItMatters: "Strong basics make every future framework or tool 5x easier to pick up.",
      whatToPractice: [
        "Replicate a clean, minimal example from memory",
        "Troubleshoot a deliberate mini error to understand the fix",
      ],
      whatToBuild: "A polished beginner component that does one thing really well",
      whatSuccessLooksLike: "You can write a basic module without copying line-by-line from a guide.",
      whatToDoNext: "Combine multiple basics together in your first complete project.",
      tasks: [
        { id: "t2-1", text: "Complete 3 hands-on interactive tutorials on core fundamentals", done: false },
        { id: "t2-2", text: "Create a personal cheat-sheet of key concepts and workflows", done: false },
        { id: "t2-3", text: "Build a mini standalone component from scratch", done: false },
      ],
    },
    {
      id: "stg-3",
      stageNumber: 3,
      stageKey: "FIRST PROJECT",
      title: "Your First Tangible Mini-Project",
      subtitle: "Build something working that you can show to a friend or peer",
      whatToLearn: [
        "Project planning from blank canvas to finished output",
        "Structuring simple inputs and clear outputs",
        "Deploying or sharing your creation for free online or with peers",
      ],
      whyItMatters: "Having something live that other people can experience builds real confidence.",
      whatToPractice: [
        "Plan a simple 3-step project workflow",
        "Build the project in 2-3 focused 30-minute sessions",
      ],
      whatToBuild: `A functional mini project or showcase tailored to ${dirName}`,
      whatSuccessLooksLike: "You have a live link or document that you can test and share.",
      whatToDoNext: "Refactor your work and add a second feature to deepen your intuition.",
      tasks: [
        { id: "t3-1", text: "Outline the 3 primary components of your mini-project", done: false },
        { id: "t3-2", text: "Implement the core flow and verify edge cases", done: false },
        { id: "t3-3", text: "Publish or share your live demo for free", done: false },
      ],
    },
    {
      id: "stg-4",
      stageNumber: 4,
      stageKey: "PRACTICE",
      title: "Building Muscle Memory & Routine",
      subtitle: "Solve varied mini-puzzles to handle real-world edge cases",
      whatToLearn: [
        "Common patterns used by industry professionals",
        "How to search effectively for solutions without getting stuck",
        "Shortcuts and faster iteration loops",
      ],
      whyItMatters: "Repetition turns conscious effort into effortless intuition.",
      whatToPractice: [
        "Rebuild 3 different classic discipline exercises",
        "Participate in a weekly challenge or case study exercise",
      ],
      whatToBuild: "A library of 3 reusable modular pieces or templates",
      whatSuccessLooksLike: "You can assemble common features without constantly getting stuck.",
      whatToDoNext: "Start building a full-sized standalone project from scratch.",
      tasks: [
        { id: "t4-1", text: "Build and test 2 small practical exercises from scratch", done: false },
        { id: "t4-2", text: "Learn how to use professional tools to profile quality and performance", done: false },
        { id: "t4-3", text: "Refactor messy drafts into clean, readable modular deliverables", done: false },
      ],
    },
    {
      id: "stg-5",
      stageNumber: 5,
      stageKey: "REAL PROJECTS",
      title: "Full-Scale Standalone Project",
      subtitle: "Solve a real human problem from start to finish",
      whatToLearn: [
        "Structuring a comprehensive multi-part deliverable with clean architecture",
        "Handling complex requirements and real feedback",
        "High aesthetic polish and responsive user experience",
      ],
      whyItMatters: "Employers and clients look for projects that solve real problems, not shallow tutorial clones.",
      whatToPractice: [
        "Talk to a peer or community member to find an annoying workflow to solve",
        "Build and ship a production-grade deliverable to solve it",
      ],
      whatToBuild: "A complete, polished project addressing a real need",
      whatSuccessLooksLike: "Real people can use your deliverable to accomplish a goal seamlessly.",
      whatToDoNext: "Document your design and strategic decisions in a public portfolio.",
      tasks: [
        { id: "t5-1", text: "Scope out requirements and user needs for a real project", done: false },
        { id: "t5-2", text: "Execute the core deliverable with attention to high craftsmanship", done: false },
        { id: "t5-3", text: "Perform a usability audit and fix the top 2 friction points", done: false },
      ],
    },
    {
      id: "stg-6",
      stageNumber: 6,
      stageKey: "PORTFOLIO",
      title: "Storytelling & Public Proof of Work",
      subtitle: "Showcase your best creations with clear impact",
      whatToLearn: [
        "How to write case studies that explain your thought process and trade-offs",
        "Taking crisp screenshots and recording 60-second walkthrough videos",
        "Presenting yourself authentically online",
      ],
      whyItMatters: "People hire people whose thought process and enthusiasm they can see.",
      whatToPractice: [
        "Explain your favorite project to someone non-technical in 2 minutes",
        "Write a concise case study detailing what you learned and what you would improve",
      ],
      whatToBuild: "A minimalist personal portfolio or case study document featuring your top projects",
      whatSuccessLooksLike: "A visitor can view your work, test the project, and contact you in under 60 seconds.",
      whatToDoNext: "Network, freelance, apply for opportunities, or explore advanced specializations.",
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
        "Advanced tooling, specialized frameworks, and systems thinking",
        "Contributing to industry communities and open research",
        "Mentoring someone who is 2 steps behind you",
      ],
      whyItMatters: "The best practitioners never stop exploring. Teaching others cements your own knowledge.",
      whatToPractice: [
        "Audit a large industry case study or design system",
        "Write a brief guide teaching an insight you recently mastered",
      ],
      whatToBuild: "A reusable community template, case analysis, or open resource",
      whatSuccessLooksLike: "You have your own autonomous creative rhythm and can learn any new tool quickly.",
      whatToDoNext: "Keep building things with joy and curiosity.",
      tasks: [
        { id: "t7-1", text: "Explore an advanced specialized topic in your field", done: false },
        { id: "t7-2", text: "Help answer a beginner's question in a community", done: false },
        { id: "t7-3", text: "Plan your next independent ambitious project idea", done: false },
      ],
    },
  ];

  const resources = isDesign
    ? [
        { id: "res-1", title: "Laws of UX", provider: "Jon Yablonski", type: "free" as const, format: "Interactive Reference", url: "https://lawsofux.com", description: "Collection of best practices considering how users interact with digital interfaces.", estimatedTime: "3 hours" },
        { id: "res-2", title: "Figma Community & Tutorials", provider: "Figma", type: "free" as const, format: "Video & Playgrounds", url: "https://help.figma.com", description: "Official Figma tutorials covering auto-layout, design tokens, and components.", estimatedTime: "10 hours" },
        { id: "res-3", title: "Nielsen Norman Group Articles", provider: "NN/g", type: "free" as const, format: "Research Library", url: "https://www.nngroup.com", description: "World-renowned research repository on user experience and usability testing.", estimatedTime: "Ongoing" },
        { id: "res-4", title: "Interaction Design Foundation", provider: "IxDF", type: "paid" as const, format: "Accredited UX Courses", url: "https://www.interaction-design.org", description: "Comprehensive UX certifications recognized by top tech design teams.", estimatedTime: "30 hours" },
      ]
    : isBusiness
    ? [
        { id: "res-1", title: "Y Combinator Startup School", provider: "Y Combinator", type: "free" as const, format: "Curriculum & Library", url: "https://www.startupschool.org", description: "Practical lessons on talking to users, finding product-market fit, and prioritization.", estimatedTime: "15 hours" },
        { id: "res-2", title: "Lenny's Product Archive", provider: "Lenny Rachitsky", type: "free" as const, format: "In-Depth Case Studies", url: "https://www.lennysnewsletter.com", description: "The definitive guide to product management, growth strategies, and execution.", estimatedTime: "Ongoing" },
        { id: "res-3", title: "Reforge Public Guides", provider: "Reforge", type: "free" as const, format: "Strategic Frameworks", url: "https://www.reforge.com/blog", description: "Advanced growth, retention, and product strategy mental models.", estimatedTime: "12 hours" },
      ]
    : isFinance
    ? [
        { id: "res-1", title: "Corporate Finance Institute Free Library", provider: "CFI", type: "free" as const, format: "Interactive Guides", url: "https://corporatefinanceinstitute.com", description: "Master 3-statement models, DCF valuation, and spreadsheet shortcuts.", estimatedTime: "20 hours" },
        { id: "res-2", title: "Damodaran Online Corporate Valuation", provider: "Prof. Aswath Damodaran (NYU)", type: "free" as const, format: "Lectures & Datasets", url: "https://pages.stern.nyu.edu/~adamodar/", description: "The gold standard university lecture series and valuation datasets.", estimatedTime: "40 hours" },
        { id: "res-3", title: "SEC EDGAR Search Engine", provider: "US SEC", type: "free" as const, format: "Public Filings Database", url: "https://www.sec.gov/edgar/searchedgar/companysearch", description: "Real quarterly (10-Q) and annual (10-K) audited financial statements.", estimatedTime: "Ongoing" },
      ]
    : isMedia
    ? [
        { id: "res-1", title: "Nieman Journalism Lab", provider: "Harvard University", type: "free" as const, format: "Industry Insights", url: "https://www.niemanlab.org", description: "Leading publication examining the future of reporting and storytelling.", estimatedTime: "Ongoing" },
        { id: "res-2", title: "Purdue Online Writing Lab (OWL)", provider: "Purdue University", type: "free" as const, format: "Style & Mechanics Guide", url: "https://owl.purdue.edu", description: "The premier resource for writing clarity and research attribution.", estimatedTime: "8 hours" },
        { id: "res-3", title: "ProPublica Investigative Guides", provider: "ProPublica", type: "free" as const, format: "Case Studies", url: "https://www.propublica.org", description: "Walkthroughs of how award-winning investigative stories were reported.", estimatedTime: "15 hours" },
      ]
    : [
        { id: "res-1", title: "freeCodeCamp Interactive Curriculum", provider: "freeCodeCamp", type: "free" as const, format: "Interactive Code", url: "https://www.freecodecamp.org", description: "World-renowned interactive curriculum with verified projects.", estimatedTime: "Self-paced" },
        { id: "res-2", title: "MDN Web Docs & Guides", provider: "Mozilla Developer Network", type: "free" as const, format: "Documentation", url: "https://developer.mozilla.org", description: "The definitive reference for web standards and modern tooling.", estimatedTime: "Ongoing" },
        { id: "res-3", title: "CS50x: Intro to Computer Science", provider: "Harvard University", type: "free" as const, format: "University Lectures", url: "https://cs50.harvard.edu", description: "David J. Malan's legendary introduction to computational thinking.", estimatedTime: "50 hours" },
      ];

  const projects = isDesign
    ? [
        {
          id: "proj-1",
          title: "Personal Visual Identity & UI Kit",
          level: "Beginner" as const,
          objective: "Create a cohesive color palette, typography hierarchy, and set of 5 reusable buttons and cards in Figma.",
          skillsPracticed: ["Typography pairing", "Color contrast (WCAG)", "Figma components", "Auto-layout"],
          expectedOutput: "A clean Figma file with a styled design system starter kit ready to export.",
          difficulty: "Gentle (1-2 days)",
          suggestedNextStep: "Apply the UI kit to a complete mobile screen layout.",
          completed: false,
        },
        {
          id: "proj-2",
          title: "Mobile Onboarding Flow & User Journey",
          level: "Intermediate" as const,
          objective: "Design a 4-screen mobile onboarding flow that welcomes new users and collects preferences without friction.",
          skillsPracticed: ["User journey mapping", "Micro-copywriting", "Interactive prototypes", "Usability testing"],
          expectedOutput: "An interactive Figma prototype that feels like a real mobile application.",
          difficulty: "Moderate (3-5 days)",
          suggestedNextStep: "Conduct a 10-minute feedback test with 2 peers.",
          completed: false,
        },
        {
          id: "proj-3",
          title: "End-to-End Usability Redesign Case Study",
          level: "Advanced" as const,
          objective: "Audit an existing confusing digital product, research user pain points, and design a full redesign case study.",
          skillsPracticed: ["Heuristic evaluation", "User interviews", "Information architecture", "Case study presentation"],
          expectedOutput: "A published case study article with before/after comparisons and design rationale.",
          difficulty: "Challenging (1-2 weeks)",
          suggestedNextStep: "Publish the case study on your portfolio or Medium.",
          completed: false,
        },
      ]
    : isBusiness
    ? [
        {
          id: "proj-1",
          title: "Customer Discovery & Competitive Matrix",
          level: "Beginner" as const,
          objective: "Identify a real customer friction, interview 3 potential users, and map 4 competing solutions in a 2x2 matrix.",
          skillsPracticed: ["Problem framing", "Customer interviewing", "Competitive analysis", "Value proposition design"],
          expectedOutput: "A structured 2-page brief identifying the unmet market opportunity.",
          difficulty: "Gentle (2-3 days)",
          suggestedNextStep: "Draft a Product Requirement Document (PRD) for the solution.",
          completed: false,
        },
        {
          id: "proj-2",
          title: "Product Requirement Document (PRD) & Roadmap",
          level: "Intermediate" as const,
          objective: "Write a complete PRD outlining feature scope, user stories, success metrics, and a 3-sprint delivery roadmap.",
          skillsPracticed: ["Writing user stories", "Success metrics definition", "Prioritization frameworks", "Scope negotiation"],
          expectedOutput: "A professional PRD ready to present to designers and engineering leads.",
          difficulty: "Moderate (4-6 days)",
          suggestedNextStep: "Design a launch experiment to validate customer demand.",
          completed: false,
        },
        {
          id: "proj-3",
          title: "Go-to-Market Strategy & Launch Campaign",
          level: "Advanced" as const,
          objective: "Design a full go-to-market plan including pricing tiers, channel distribution, launch timeline, and conversion goals.",
          skillsPracticed: ["Positioning & messaging", "Funnel economics", "Growth loop design", "Executive presentation"],
          expectedOutput: "A comprehensive GTM pitch deck and launch operational roadmap.",
          difficulty: "Challenging (1-2 weeks)",
          suggestedNextStep: "Present the launch plan to peers or advisors for critique.",
          completed: false,
        },
      ]
    : isFinance
    ? [
        {
          id: "proj-1",
          title: "Dynamic 3-Statement Forecasting Model",
          level: "Beginner" as const,
          objective: "Build a linked Income Statement, Balance Sheet, and Cash Flow spreadsheet with dynamic revenue assumptions.",
          skillsPracticed: ["Spreadsheet modeling", "Financial statement linkage", "Formula auditing", "Working capital mechanics"],
          expectedOutput: "A dynamic Excel or Sheets workbook that cleanly balances across 3 projected years.",
          difficulty: "Gentle (2-3 days)",
          suggestedNextStep: "Add scenario toggles for Best Case, Base Case, and Downside Case.",
          completed: false,
        },
        {
          id: "proj-2",
          title: "Comparable Company Valuation Matrix",
          level: "Intermediate" as const,
          objective: "Collect financial data for 5 public peers and benchmark EV/Revenue, P/E, and EBITDA valuation multiples.",
          skillsPracticed: ["Financial data extraction", "Multiple benchmarking", "Normalizing EBITDA", "Relative valuation"],
          expectedOutput: "A peer benchmark table with implied enterprise value ranges.",
          difficulty: "Moderate (3-5 days)",
          suggestedNextStep: "Build a Discounted Cash Flow (DCF) model to compare intrinsic vs. relative value.",
          completed: false,
        },
        {
          id: "proj-3",
          title: "Discounted Cash Flow (DCF) & Investment Memo",
          level: "Advanced" as const,
          objective: "Forecast 5-year free cash flows, calculate WACC, determine terminal value, and write a 2-page investment recommendation.",
          skillsPracticed: ["Discounted cash flow modeling", "WACC calculation", "Sensitivity analysis", "Investment thesis writing"],
          expectedOutput: "A professional investment memo complete with valuation football-field chart.",
          difficulty: "Challenging (1-2 weeks)",
          suggestedNextStep: "Present the memo in a mock investment committee review.",
          completed: false,
        },
      ]
    : [
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

  const isClinicalPsychology =
    goalLower.includes("psychologist") ||
    goalLower.includes("therapist") ||
    goalLower.includes("counselor") ||
    goalLower.includes("clinical psychology");

  const isDesign =
    goalLower.includes("design") ||
    goalLower.includes("ui") ||
    goalLower.includes("ux") ||
    goalLower.includes("graphic") ||
    goalLower.includes("visual") ||
    goalLower.includes("interior") ||
    goalLower.includes("fashion") ||
    goalLower.includes("product design") ||
    goalLower.includes("art director");

  const isBusiness =
    goalLower.includes("product manager") ||
    goalLower.includes("product management") ||
    goalLower.includes("pm") ||
    goalLower.includes("operations") ||
    goalLower.includes("strategy") ||
    goalLower.includes("consultant") ||
    goalLower.includes("consulting") ||
    goalLower.includes("business") ||
    goalLower.includes("management") ||
    goalLower.includes("chief of staff");

  const isMarketing =
    goalLower.includes("marketing") ||
    goalLower.includes("growth") ||
    goalLower.includes("brand") ||
    goalLower.includes("social media") ||
    goalLower.includes("advertising") ||
    goalLower.includes("public relations") ||
    goalLower.includes("pr");

  const isFinance =
    goalLower.includes("finance") ||
    goalLower.includes("investment") ||
    goalLower.includes("banking") ||
    goalLower.includes("valuation") ||
    goalLower.includes("equity") ||
    goalLower.includes("wealth") ||
    goalLower.includes("hedge fund") ||
    goalLower.includes("private equity");

  const isMedia =
    goalLower.includes("journalism") ||
    goalLower.includes("journalist") ||
    goalLower.includes("writer") ||
    goalLower.includes("author") ||
    goalLower.includes("editor") ||
    goalLower.includes("reporter") ||
    goalLower.includes("copywriter") ||
    goalLower.includes("media") ||
    goalLower.includes("content creator") ||
    goalLower.includes("podcast");

  const isPsychology =
    goalLower.includes("human resources") ||
    goalLower.includes("hr") ||
    goalLower.includes("talent") ||
    goalLower.includes("people ops") ||
    goalLower.includes("coach") ||
    goalLower.includes("organizational") ||
    goalLower.includes("recruiter");

  const isEducation =
    goalLower.includes("teacher") ||
    goalLower.includes("teaching") ||
    goalLower.includes("professor") ||
    goalLower.includes("educator") ||
    goalLower.includes("instructor") ||
    goalLower.includes("curriculum") ||
    goalLower.includes("instructional design");

  const isScience =
    goalLower.includes("science") ||
    goalLower.includes("scientist") ||
    goalLower.includes("researcher") ||
    goalLower.includes("biologist") ||
    goalLower.includes("chemist") ||
    goalLower.includes("physicist") ||
    goalLower.includes("climate") ||
    goalLower.includes("environmental");

  const isSoftwareDev =
    goalLower.includes("developer") ||
    goalLower.includes("software") ||
    goalLower.includes("programmer") ||
    goalLower.includes("coder") ||
    goalLower.includes("frontend") ||
    goalLower.includes("backend") ||
    goalLower.includes("fullstack") ||
    goalLower.includes("web dev");

  const isEntrepreneur =
    goalLower.includes("founder") ||
    goalLower.includes("entrepreneur") ||
    goalLower.includes("startup") ||
    goalLower.includes("indie");

  const isRegulated =
    isMedical ||
    isNursing ||
    isLaw ||
    isAviation ||
    isEngineeringPE ||
    isAccountingCPA ||
    isClinicalPsychology;

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
      : isClinicalPsychology
      ? "Licensed Clinical Psychologist / Counselor"
      : isAIEngineer
      ? "AI & Machine Learning Engineer"
      : isGameDev
      ? "Interactive Game Developer"
      : isCybersecurity
      ? "Cybersecurity & Defense Analyst"
      : isSoftwareDev
      ? "Software Systems & Web Engineer"
      : isDesign
      ? (goalLower.includes("interior")
          ? "Interior & Spatial Designer"
          : goalLower.includes("graphic")
          ? "Brand & Graphic Identity Designer"
          : "Product & UI/UX Designer")
      : isBusiness
      ? (goalLower.includes("product manager") || goalLower.includes("pm")
          ? "Product Manager (Tech & Digital)"
          : "Business Strategy & Operations Lead")
      : isMarketing
      ? "Growth & Brand Marketing Strategist"
      : isFinance
      ? "Financial Analyst & Investment Specialist"
      : isMedia
      ? (goalLower.includes("journalist") || goalLower.includes("journalism")
          ? "Investigative Journalist & Reporter"
          : "Editorial Writer & Media Producer")
      : isPsychology
      ? "People Operations & Behavioral Specialist"
      : isEducation
      ? "Educator & Instructional Designer"
      : isScience
      ? "Applied Research Scientist"
      : isEntrepreneur
      ? "Venture Founder & Independent Builder"
      : careerGoal
      ? careerGoal
          .trim()
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ")
      : "Professional Specialist";

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
    : isDesign
    ? [
        {
          id: "stg-1",
          stageNumber: 1,
          stageKey: "ORIENTATION & VISUAL INTUITION",
          title: "Design Thinking, Eye Training & Tool Setup",
          subtitle: `Get comfortable with the core vocabulary and daily creative process of a ${formattedTitle}`,
          estimatedTime: "1-2 weeks",
          whyLearningThis: `Demystifies design principles and visual hierarchy without intimidating technical software hurdles.`,
          howItHelpsCareer: "Builds the foundational observational eye required to critique and improve digital products.",
          whatComesAfter: "Information architecture, wireframing, and interactive design prototypes.",
          whatToLearn: [
            `What a ${formattedTitle} actually does on a typical day`,
            "Visual hierarchy, optical balance, typography scales, and color contrast",
            "Free browser-based Figma or Canva tools with zero local installation",
          ],
          whyItMatters: "A great design eye comes from deliberate observation, not genetic talent.",
          whatToPractice: [
            "Deconstruct 3 app screens you use every day into their basic layout boxes",
            "Experiment with typography pairings and accessible color palettes in Figma",
          ],
          whatToBuild: "A 1-page visual mood board and starter design token set (colors, type, spacing)",
          whatSuccessLooksLike: "You can open Figma comfortably, draw frames, and explain why a layout feels balanced.",
          whatToDoNext: "Move from static visuals to structured user journeys and wireframing.",
          tasks: [
            { id: "des-1", text: "Create a free Figma account and complete the official 15-minute starter tutorial", done: false, category: "Tooling" },
            { id: "des-2", text: "Screenshot your favorite mobile app and label the 5 primary visual hierarchy choices", done: false, category: "Analysis" },
            { id: "des-3", text: "Pick 2 complementary Google Fonts and test heading vs body pairings", done: false, category: "Typography" },
          ],
        },
        {
          id: "stg-2",
          stageNumber: 2,
          stageKey: "CORE UX & USER RESEARCH",
          title: "User Journeys, Information Architecture & Wireframes",
          subtitle: "Map how real humans navigate tasks without friction or confusion",
          estimatedTime: "2-3 weeks",
          whyLearningThis: "Visual beauty without intuitive flow creates frustrating products that users quickly abandon.",
          howItHelpsCareer: "Positions you as a strategic thinker who solves business and user problems, not just a decorator.",
          whatComesAfter: "High-fidelity interactive prototypes and design systems.",
          whatToLearn: [
            "User mental models, affordances, and cognitive load reduction",
            "Low-fidelity wireframing and sketching rapid paper concepts",
            "Conducting lightweight 15-minute user discovery interviews",
          ],
          whyItMatters: "Fixing an idea on paper takes 5 minutes; fixing it in final production takes weeks.",
          whatToPractice: [
            "Map out the exact steps a user takes to order food or book a ticket online",
            "Create low-fidelity wireframes for a 3-screen mobile flow",
          ],
          whatToBuild: "A clickable grayscale wireframe prototype mapping a seamless user onboarding journey",
          whatSuccessLooksLike: "A peer can navigate your wireframe and accomplish the goal without asking what to click.",
          whatToDoNext: "Apply visual polish, components, and interactive micro-animations.",
          tasks: [
            { id: "des-4", text: "Conduct a 10-minute user feedback interview on a confusing app", done: false, category: "Research" },
            { id: "des-5", text: "Create a 3-screen low-fidelity wireframe in Figma using auto-layout", done: false, category: "Wireframing" },
            { id: "des-6", text: "Test the grayscale flow with a friend and document 2 friction points", done: false, category: "Testing" },
          ],
        },
        {
          id: "stg-3",
          stageNumber: 3,
          stageKey: "HIGH-FIDELITY & DESIGN SYSTEMS",
          title: "Design Systems, Reusable Components & Auto-Layout",
          subtitle: "Build scalable, polished UI component libraries used by modern product teams",
          estimatedTime: "3-4 weeks",
          whyLearningThis: "Industry teams do not design screens one by one; they build flexible, reusable system kits.",
          howItHelpsCareer: "Teaches you the exact design-system workflows expected at leading tech and creative companies.",
          whatComesAfter: "Usability testing, edge-case handling, and interactive prototypes.",
          whatToLearn: [
            "Figma component properties, variants, and responsive auto-layout constraints",
            "Accessibility standards (WCAG 2.1 AA) and readable contrast ratios",
            "Exporting assets and creating design specifications for developers",
          ],
          whyItMatters: "Consistency and speed are the hallmarks of senior designers.",
          whatToPractice: [
            "Build a cohesive button system with primary, secondary, disabled, and hover states",
            "Design responsive cards that resize gracefully across mobile and desktop widths",
          ],
          whatToBuild: "A comprehensive UI component library with 10 production-ready elements",
          whatSuccessLooksLike: "When you update the primary color variable, every screen in your prototype updates instantly.",
          whatToDoNext: "Assemble these components into a flagship product redesign.",
          tasks: [
            { id: "des-7", text: "Build a complete button component set with 4 state variants", done: false, category: "Components" },
            { id: "des-8", text: "Audit your color palette with a WCAG contrast checker plugin", done: false, category: "Accessibility" },
            { id: "des-9", text: "Create an interactive micro-interaction prototype in Figma", done: false, category: "Prototyping" },
          ],
        },
        {
          id: "stg-4",
          stageNumber: 4,
          stageKey: "PRACTICE & CASE STUDY CRAFT",
          title: "End-to-End Product Redesign & Usability Audit",
          subtitle: "Find a broken real-world experience and redesign it with proof of improvement",
          estimatedTime: "3-4 weeks",
          whyLearningThis: "Hiring managers look for before-and-after rationale, not just pretty final images.",
          howItHelpsCareer: "Demonstrates your critical thinking, problem breakdown, and ability to measure UX success.",
          whatComesAfter: "Assembling a professional public portfolio and case study presentation.",
          whatToLearn: [
            "Heuristic evaluation frameworks (Nielsen Norman 10 Usability Heuristics)",
            "Structuring design case studies: Problem, Discovery, Iterations, Solution, Impact",
            "Presenting trade-offs and rationale clearly to non-design stakeholders",
          ],
          whyItMatters: "Anyone can copy a pretty dribbble shot; great designers explain why their solution works.",
          whatToPractice: [
            "Audit a clunky public service, university portal, or local business website",
            "Document 3 usability violations with screenshots and research citations",
          ],
          whatToBuild: "A structured 5-page case study documenting research, wireframes, and high-fidelity screens",
          whatSuccessLooksLike: "A reader who knows nothing about design immediately understands why your redesign is better.",
          whatToDoNext: "Publish your portfolio and prepare for design critique interviews.",
          tasks: [
            { id: "des-10", text: "Perform a heuristic evaluation on a real application", done: false, category: "Audit" },
            { id: "des-11", text: "Design the high-fidelity redesign screens with auto-layout", done: false, category: "Design" },
            { id: "des-12", text: "Record a 3-minute video walk-through demonstrating the prototype flow", done: false, category: "Presentation" },
          ],
        },
        {
          id: "stg-5",
          stageNumber: 5,
          stageKey: "FLAGSHIP PORTFOLIO",
          title: "Public Design Portfolio & Live Case Studies",
          subtitle: "Curate your best 2-3 case studies on a clean personal domain",
          estimatedTime: "2-3 weeks",
          whyLearningThis: "In design, your portfolio IS your resume. A clear, scannable portfolio creates career momentum.",
          howItHelpsCareer: "Converts recruiters, creative directors, and clients into interview invites and project briefs.",
          whatComesAfter: "Design interview whiteboarding and career launch.",
          whatToLearn: [
            "Portfolio curation: Quality over quantity (2 deep case studies beat 8 shallow ones)",
            "Responsive portfolio websites using Webflow, Framer, Notion, or custom site",
            "Personal bio, creative philosophy, and clear contact channels",
          ],
          whyItMatters: "Design recruiters spend 45 seconds scanning your portfolio. Visual clarity is paramount.",
          whatToPractice: [
            "Write punchy problem-solution summaries for your 2 featured projects",
            "Collect high-resolution mockups and interactive prototype embeds",
          ],
          whatToBuild: "A live portfolio website featuring 2 polished case studies and a clear about section",
          whatSuccessLooksLike: "Your portfolio loads fast, looks great on mobile, and clearly communicates your role in each project.",
          whatToDoNext: "Practice design critiques and whiteboarding challenges.",
          tasks: [
            { id: "des-13", text: "Deploy your portfolio site on a custom domain via Framer or Webflow", done: false, category: "Portfolio" },
            { id: "des-14", text: "Get constructive critique from 2 senior designers on Twitter/LinkedIn/ADPList", done: false, category: "Critique" },
            { id: "des-15", text: "Refine typography and mobile responsiveness across all portfolio pages", done: false, category: "Polish" },
          ],
        },
        {
          id: "stg-6",
          stageNumber: 6,
          stageKey: "CAREER LAUNCH & CLIENT MASTERY",
          title: "Design Challenges, App Presentations & Career Launch",
          subtitle: `Land your first role or high-value freelance clients as a ${formattedTitle}`,
          estimatedTime: "4-6 weeks",
          whyLearningThis: "Interviewing for design roles requires presenting case studies live and defending your choices calmly.",
          howItHelpsCareer: "Builds confidence in stakeholder negotiations, salary conversations, and client proposals.",
          whatComesAfter: "Continuous growth toward Senior Product Designer or Design Lead.",
          whatToLearn: [
            "Whiteboard design challenge frameworks (problem framing, user empathy, sketch solutions in 45 min)",
            "App presentation decks: Presenting a 20-minute slide deck of your flagship case study",
            "Freelance pricing models (value-based pricing vs hourly) and design contracts",
          ],
          whyItMatters: "Articulating design decisions with business impact is what separates junior and senior talent.",
          whatToPractice: [
            "Do 2 practice case study presentations with a mentor on ADPList",
            "Practice live app critique: pick an app and articulate 3 strengths and 2 opportunities in 5 minutes",
          ],
          whatToBuild: "A 10-slide keynote deck walking through your flagship project ready for interview presentations",
          whatSuccessLooksLike: "Receiving your first offer letter or signing your first freelance design client.",
          whatToDoNext: "Thrive in your new role, establish design rituals, and mentor up-and-coming designers.",
          tasks: [
            { id: "des-16", text: "Book 2 free mentorship sessions on ADPList.org with product design leads", done: false, category: "Mentorship" },
            { id: "des-17", text: "Create a tailored 10-slide presentation deck of your best case study", done: false, category: "Interview" },
            { id: "des-18", text: "Submit 10 high-intent applications with customized portfolio cover notes", done: false, category: "Outreach" },
          ],
        },
      ]
    : isBusiness || isMarketing
    ? [
        {
          id: "stg-1",
          stageNumber: 1,
          stageKey: "MARKET DYNAMICS & BUSINESS MODELS",
          title: "Market Analysis, Problem Framing & Business Models",
          subtitle: `Understand how modern organizations create, deliver, and capture value as a ${formattedTitle}`,
          estimatedTime: "1-2 weeks",
          whyLearningThis: "Every successful product or campaign starts by identifying an acute unmet need in a viable market.",
          howItHelpsCareer: "Gives you the strategic vocabulary used by executives, venture partners, and product leaders.",
          whatComesAfter: "Customer discovery, user interviewing, and value proposition mapping.",
          whatToLearn: [
            "Core business models: SaaS, marketplace, direct-to-consumer, subscription, and platform ecosystems",
            "The Business Model Canvas & Value Proposition Canvas",
            "Competitive landscape analysis and 2x2 positioning matrices",
          ],
          whyItMatters: "Building something nobody wants is the most expensive mistake in business.",
          whatToPractice: [
            "Map the Business Model Canvas for a company you admire (e.g., Airbnb, Spotify, or Duolingo)",
            "Identify 3 direct and 2 indirect competitors for a new startup concept",
          ],
          whatToBuild: "A 2-page competitive market brief analyzing an underserved customer segment",
          whatSuccessLooksLike: "You can articulate why customers switch from legacy alternatives to modern solutions.",
          whatToDoNext: "Validate assumptions directly with real potential customers.",
          tasks: [
            { id: "biz-1", text: "Complete a Business Model Canvas for an existing successful venture", done: false, category: "Analysis" },
            { id: "biz-2", text: "Draft a 2x2 positioning matrix comparing 4 competitors on customer value", done: false, category: "Strategy" },
            { id: "biz-3", text: "List 5 critical unverified assumptions about your target market segment", done: false, category: "Discovery" },
          ],
        },
        {
          id: "stg-2",
          stageNumber: 2,
          stageKey: "CUSTOMER DISCOVERY & USER RESEARCH",
          title: "Customer Interviews, Jobs-to-be-Done & Value Proposition",
          subtitle: "Learn to ask the right questions without biasing answers or hearing fake polite praise",
          estimatedTime: "2-3 weeks",
          whyLearningThis: "Customers often say one thing in surveys but do the exact opposite in reality.",
          howItHelpsCareer: "Mastering qualitative customer discovery makes your product and marketing choices bulletproof.",
          whatComesAfter: "Product specifications, roadmaps, and growth experimentation.",
          whatToLearn: [
            "The 'Mom Test' framework: Asking about past behavior rather than hypothetical future opinions",
            "Jobs-to-be-Done (JTBD) methodology and emotional switching triggers",
            "Synthesizing messy interview notes into actionable customer opportunity maps",
          ],
          whyItMatters: "Real customer insight is the rarest and most valuable asset in any business organization.",
          whatToPractice: [
            "Conduct 3 twenty-minute customer discovery interviews with real people in your target group",
            "Extract 5 verbatim quotes that capture acute pain points and emotional desires",
          ],
          whatToBuild: "A structured Customer Insights Dossier with 3 target personas and prioritized pain points",
          whatSuccessLooksLike: "You discover at least one major surprising insight that disproves your initial assumption.",
          whatToDoNext: "Translate customer opportunities into prioritized features and campaign initiatives.",
          tasks: [
            { id: "biz-4", text: "Draft a non-leading interview script based on 'The Mom Test' principles", done: false, category: "Research" },
            { id: "biz-5", text: "Conduct and record 3 qualitative discovery interviews", done: false, category: "Interviews" },
            { id: "biz-6", text: "Synthesize insights into a 1-page Customer Opportunity Matrix", done: false, category: "Synthesis" },
          ],
        },
        {
          id: "stg-3",
          stageNumber: 3,
          stageKey: "EXECUTION & ROADMAPPING",
          title: "PRDs, Agile Prioritization & Go-To-Market Architecture",
          subtitle: "Turn broad business strategy into clear, executable deliverables for cross-functional teams",
          estimatedTime: "3-4 weeks",
          whyLearningThis: "Ideas are cheap; the skill is translating ambiguous goals into crisp milestones.",
          howItHelpsCareer: "Proves you can lead cross-functional initiatives and communicate with clarity.",
          whatComesAfter: "Unit economics, funnel analytics, and growth experiments.",
          whatToLearn: [
            "Writing complete Product Requirement Documents (PRDs) or Campaign Briefs",
            "Prioritization frameworks: RICE (Reach, Impact, Confidence, Effort), MoSCoW, and Kano models",
            "Agile sprint planning, release milestones, and cross-functional dependency management",
          ],
          whyItMatters: "Clear written specs prevent weeks of wasted effort and team miscommunication.",
          whatToPractice: [
            "Draft a 3-page PRD defining problem statement, user stories, non-goals, and success metrics",
            "Score 6 competing feature requests using the RICE prioritization framework",
          ],
          whatToBuild: "A comprehensive PRD or Go-To-Market Plan ready to hand to designers and leads",
          whatSuccessLooksLike: "A technical or creative partner can read your document and immediately understand what needs to be built.",
          whatToDoNext: "Define the numbers: metrics, unit economics, and growth loops.",
          tasks: [
            { id: "biz-7", text: "Write a complete PRD with problem, scope, user stories, and acceptance criteria", done: false, category: "Spec" },
            { id: "biz-8", text: "Prioritize 8 initiative ideas using an Excel/Sheets RICE model", done: false, category: "Prioritization" },
            { id: "biz-9", text: "Map a 3-month phased release roadmap with target milestone dates", done: false, category: "Roadmap" },
          ],
        },
        {
          id: "stg-4",
          stageNumber: 4,
          stageKey: "METRICS & EXPERIMENTATION",
          title: "Unit Economics, Funnel Analytics & A/B Testing",
          subtitle: "Measure what actually matters: retention, conversion, CAC, LTV, and growth loops",
          estimatedTime: "3-4 weeks",
          whyLearningThis: "Great leaders do not guess; they build hypotheses and run fast, low-cost experiments.",
          howItHelpsCareer: "Elevates you into data-informed leadership, making you a trusted partner for executive leadership.",
          whatComesAfter: "A comprehensive flagship business case and pitch deck.",
          whatToLearn: [
            "Core metrics: Acquisition, Activation, Retention, Revenue, and Referral (AARRR Pirate Metrics)",
            "Unit economics: Customer Acquisition Cost (CAC) vs Lifetime Value (LTV) ratios",
            "Hypothesis-driven experimentation: Defining control vs test variants and sample size math",
          ],
          whyItMatters: "Sustainable businesses are built on strong unit economics, not vanity follower counts.",
          whatToPractice: [
            "Build a funnel model in Google Sheets showing where 1,000 visitors drop off",
            "Design an A/B test brief with clear hypothesis, primary metric, and minimum detectable effect",
          ],
          whatToBuild: "An interactive Google Sheets unit economics and growth funnel model",
          whatSuccessLooksLike: "You can calculate payback periods and identify the single highest-leverage conversion lever.",
          whatToDoNext: "Synthesize your research, product strategy, and economics into a flagship case study.",
          tasks: [
            { id: "biz-10", text: "Build a 3-tier acquisition-to-retention funnel spreadsheet", done: false, category: "Analytics" },
            { id: "biz-11", text: "Calculate blended CAC and estimated LTV for 2 customer cohorts", done: false, category: "Economics" },
            { id: "biz-12", text: "Write an experiment brief for a signup onboarding improvement", done: false, category: "Experiments" },
          ],
        },
        {
          id: "stg-5",
          stageNumber: 5,
          stageKey: "FLAGSHIP CASE STUDY",
          title: "Strategic Business Case, GTM Launch & Executive Pitch Deck",
          subtitle: "Create a boardroom-ready proposal demonstrating end-to-end commercial acumen",
          estimatedTime: "3-4 weeks",
          whyLearningThis: "Hiring panels and investors evaluate strategic candidates through deep case studies.",
          howItHelpsCareer: "Serves as the central proof-of-work centerpiece for your resume and executive portfolio.",
          whatComesAfter: "Case study interview mastery and leadership networking.",
          whatToLearn: [
            "Executive storytelling: The Minto Pyramid Principle and top-down communication",
            "Designing clean 10-slide strategy decks using clean data visualizations",
            "Anticipating pushback, counter-arguments, and risk mitigation strategies",
          ],
          whyItMatters: "The ability to persuade stakeholders with structured logic is the definition of leadership.",
          whatToPractice: [
            "Distill a complex 20-page business proposal into a crisp 10-slide executive pitch deck",
            "Record a 5-minute video presentation pitching your business case to an imaginary executive board",
          ],
          whatToBuild: "A comprehensive 10-slide pitch deck and 2-page executive summary memo",
          whatSuccessLooksLike: "Your presentation answers 'Why now?', 'Why this approach?', and 'What is the expected ROI?' in under 5 minutes.",
          whatToDoNext: "Practice case study interviews and begin strategic outreach.",
          tasks: [
            { id: "biz-13", text: "Create a 10-slide executive presentation using clean visual data charts", done: false, category: "Deck" },
            { id: "biz-14", text: "Write a 1-page memo following the Minto Pyramid Principle format", done: false, category: "Memo" },
            { id: "biz-15", text: "Conduct a practice presentation with a mentor or peer and incorporate critique", done: false, category: "Rehearsal" },
          ],
        },
        {
          id: "stg-6",
          stageNumber: 6,
          stageKey: "CAREER LAUNCH & LEADERSHIP",
          title: "Strategic Case Interviews, Stakeholder Alignment & Career Launch",
          subtitle: `Land your target role or scale client engagements as a ${formattedTitle}`,
          estimatedTime: "4-6 weeks",
          whyLearningThis: "Product and strategy interviews test structured thinking, situational judgment, and leadership under ambiguity.",
          howItHelpsCareer: "Prepares you to negotiate higher compensation, lead high-stakes initiatives, and drive results.",
          whatComesAfter: "Promotion to Senior Manager, Director, or scaling your own enterprise.",
          whatToLearn: [
            "Product sense & business strategy interview frameworks (CIRCLES, STAR, Profitability trees)",
            "Behavioral leadership questions: Managing conflict, cross-functional misalignment, and missed deadlines",
            "Strategic compensation negotiation and equity/bonus structuring",
          ],
          whyItMatters: "Communicating structured thought under interview pressure is a trainable skill.",
          whatToPractice: [
            "Complete 3 mock case study interviews with peers on platforms like StellarPeers or Exponent",
            "Prepare 5 STAR stories demonstrating leadership, data-driven decisions, and resilience",
          ],
          whatToBuild: "A strategic interview dossier with 5 tailored STAR stories and 3 case study walkthroughs",
          whatSuccessLooksLike: "Receiving competitive offers for high-impact strategy or product roles.",
          whatToDoNext: "Lead high-impact projects, deliver measurable ROI, and mentor emerging strategists.",
          tasks: [
            { id: "biz-16", text: "Practice 5 mock business case interviews with structured time limits", done: false, category: "Interview" },
            { id: "biz-17", text: "Connect with 5 senior product/strategy leaders for informal informational chats", done: false, category: "Networking" },
            { id: "biz-18", text: "Submit 10 targeted applications with custom executive memos attached", done: false, category: "Applications" },
          ],
        },
      ]
    : isFinance
    ? [
        {
          id: "stg-1",
          stageNumber: 1,
          stageKey: "ACCOUNTING & FINANCIAL STATEMENTS",
          title: "3-Statement Accounting, Cash Flow & Financial Ratios",
          subtitle: `Master the foundational financial mechanics required of a ${formattedTitle}`,
          estimatedTime: "2-3 weeks",
          whyLearningThis: "Accounting is the language of business. You must understand how money moves across an organization.",
          howItHelpsCareer: "Allows you to audit any corporate balance sheet and spot underlying financial health or distress.",
          whatComesAfter: "Financial modeling, DCF valuations, and capital market dynamics.",
          whatToLearn: [
            "How the Income Statement, Balance Sheet, and Cash Flow Statement link together",
            "Working capital dynamics, depreciation schedules, and operating leverage",
            "Key financial ratios: Liquidity, Solvency, Margins, and Return on Invested Capital (ROIC)",
          ],
          whyItMatters: "Net income does not equal cash; understanding cash flows prevents catastrophic investment mistakes.",
          whatToPractice: [
            "Download the real 10-K of a public company (e.g., Apple or Nike) from SEC EDGAR",
            "Trace how a $100 increase in depreciation flows through all 3 statements",
          ],
          whatToBuild: "A dynamic 3-statement financial model in Excel linking historical revenues to cash balances",
          whatSuccessLooksLike: "Your balance sheet balances automatically without plug numbers across all forecast years.",
          whatToDoNext: "Build valuation models to determine what a business is actually worth.",
          tasks: [
            { id: "fin-1", text: "Download and read the financial statements section of a recent 10-K filing", done: false, category: "Statements" },
            { id: "fin-2", text: "Build a dynamically linked 3-statement model in Excel from scratch", done: false, category: "Modeling" },
            { id: "fin-3", text: "Calculate 10 core financial ratios and compare across 2 industry competitors", done: false, category: "Ratios" },
          ],
        },
        {
          id: "stg-2",
          stageNumber: 2,
          stageKey: "VALUATION & FINANCIAL MODELING",
          title: "Discounted Cash Flow (DCF), Multiples & Sensitivity Analysis",
          subtitle: "Estimate the intrinsic value of businesses and investment assets with quantitative rigor",
          estimatedTime: "3-4 weeks",
          whyLearningThis: "Price is what you pay; value is what you get. Valuation is the core skill of finance professionals.",
          howItHelpsCareer: "Prepares you for equity research, investment banking, corporate finance, and private equity analyst tasks.",
          whatComesAfter: "Investment thesis synthesis, deal memos, and portfolio management.",
          whatToLearn: [
            "Discounted Cash Flow (DCF) mechanics: Free Cash Flow to Firm (FCFF), WACC, and terminal value",
            "Trading and Transaction Comparable Multiples (EV/EBITDA, P/E, EV/Revenue)",
            "Sensitivity tables: Testing what happens when growth rates or discount rates change by 1%",
          ],
          whyItMatters: "Understanding valuation assumptions prevents paying bubble valuations for hype assets.",
          whatToPractice: [
            "Build an unlevered DCF model forecasting 5 years of cash flows and terminal value",
            "Create a sensitivity matrix in Excel evaluating implied share price under various WACC scenarios",
          ],
          whatToBuild: "A complete DCF and Comparable Multiples valuation workbook for a public company",
          whatSuccessLooksLike: "You can explain and defend every underlying assumption behind your target valuation price.",
          whatToDoNext: "Formulate an original, evidence-based investment thesis.",
          tasks: [
            { id: "fin-4", text: "Calculate Weighted Average Cost of Capital (WACC) using CAPM", done: false, category: "WACC" },
            { id: "fin-5", text: "Build a 5-year DCF model with terminal value and sensitivity tables", done: false, category: "DCF" },
            { id: "fin-6", text: "Construct a peer comps table with at least 5 comparable companies", done: false, category: "Comps" },
          ],
        },
        {
          id: "stg-3",
          stageNumber: 3,
          stageKey: "INVESTMENT THESIS & DEAL MEMO",
          title: "Equity Research Report, Investment Memo & Risk Analysis",
          subtitle: "Communicate actionable investment recommendations backed by numbers and qualitative moats",
          estimatedTime: "3-4 weeks",
          whyLearningThis: "Models are just tools; the real deliverable is the reasoned investment argument.",
          howItHelpsCareer: "Becomes your flagship work sample for investment committees and hiring partners.",
          whatComesAfter: "Financial modeling tests, technical interview prep, and career launch.",
          whatToLearn: [
            "Analyzing competitive moats: Network effects, switching costs, cost advantages, and brand pricing power",
            "Identifying downside risks, management incentives, and regulatory catalysts",
            "Structuring an institutional equity research report or investment committee memo",
          ],
          whyItMatters: "Great investors are skeptical risk managers first and growth optimists second.",
          whatToPractice: [
            "Draft a 4-page formal investment memo recommending a BUY, HOLD, or SELL on an asset",
            "Summarize the 3 key catalyst drivers and 2 primary risk factors in a 1-page executive summary",
          ],
          whatToBuild: "A professional 5-page Equity Research Report with valuation tables and investment thesis",
          whatSuccessLooksLike: "A seasoned portfolio manager or finance lead finds your thesis coherent, realistic, and rigorous.",
          whatToDoNext: "Master financial modeling interview tests and prepare for market questions.",
          tasks: [
            { id: "fin-7", text: "Write a comprehensive 4-page investment memo with clear valuation target", done: false, category: "Thesis" },
            { id: "fin-8", text: "Identify and model 2 downside stress-test scenarios for the asset", done: false, category: "Risk" },
            { id: "fin-9", text: "Present your investment recommendation to a finance peer and defend your thesis", done: false, category: "Presentation" },
          ],
        },
        {
          id: "stg-4",
          stageNumber: 4,
          stageKey: "TECHNICAL INTERVIEWS & CAREER LAUNCH",
          title: "Timed Modeling Tests, Market Awareness & Career Launch",
          subtitle: `Ace technical finance interviews and secure your position as a ${formattedTitle}`,
          estimatedTime: "4-6 weeks",
          whyLearningThis: "Finance recruitment involves rapid 60-minute modeling tests and technical accounting drilling.",
          howItHelpsCareer: "Enables you to land analyst offers at top investment firms, corporate strategy teams, or banks.",
          whatComesAfter: "Fast-track promotions, deal execution, and senior portfolio leadership.",
          whatToLearn: [
            "Rapid 60-90 minute Excel modeling test shortcuts (zero mouse usage, clean formatting conventions)",
            "Technical accounting and valuation interview questions (400 Investment Banking Questions)",
            "Macroeconomic trends: Interest rate environments, inflation, and capital market liquidity",
          ],
          whyItMatters: "Speed and zero typographical errors in financial models build trust with senior partners.",
          whatToPractice: [
            "Complete 3 timed 60-minute 3-statement modeling drills without using a mouse",
            "Practice answering technical valuation and accounting questions under 2 minutes each",
          ],
          whatToBuild: "A clean portfolio of 2 completed valuation models and your flagship investment report",
          whatSuccessLooksLike: "Passing timed financial modeling technical tests with 100% accuracy.",
          whatToDoNext: "Begin your finance career, deliver accurate financial analysis, and build deal experience.",
          tasks: [
            { id: "fin-10", text: "Complete 3 timed 60-minute modeling exams from blank Excel templates", done: false, category: "Speed" },
            { id: "fin-11", text: "Drill 50 classic technical finance and accounting interview questions", done: false, category: "Interview" },
            { id: "fin-12", text: "Send 10 customized cold outreach emails with your investment report attached", done: false, category: "Outreach" },
          ],
        },
      ]
    : isMedia
    ? [
        {
          id: "stg-1",
          stageNumber: 1,
          stageKey: "FOUNDATIONAL REPORTING & CRAFT",
          title: "Story Hunting, Source Verification & Fact-Checking",
          subtitle: `Master the ethical standards and research rigor of a professional ${formattedTitle}`,
          estimatedTime: "1-2 weeks",
          whyLearningThis: "Credibility is the entire currency of journalism and non-fiction media.",
          howItHelpsCareer: "Protects your reputation and trains you to discover stories others miss.",
          whatComesAfter: "Interviewing techniques, narrative feature writing, and multimedia storytelling.",
          whatToLearn: [
            "Finding the story angle: Why does this matter right now, and to whom?",
            "Primary vs secondary sources, public records requests (FOIA), and verification standards",
            "Ethical standards, libel law basics, and attribution guidelines",
          ],
          whyItMatters: "A single unverified claim can destroy months of reporting and professional trust.",
          whatToPractice: [
            "Find a local civic issue and locate the relevant municipal public meeting minutes",
            "Cross-verify a controversial breaking news claim across 3 independent primary sources",
          ],
          whatToBuild: "A verified fact-checking briefing memo on an active current events topic",
          whatSuccessLooksLike: "Every statement in your brief has documented primary source proof.",
          whatToDoNext: "Master the art of conducting probing, empathetic interviews.",
          tasks: [
            { id: "med-1", text: "Search a public government database or court docket for a local story lead", done: false, category: "Records" },
            { id: "med-2", text: "Fact-check a 500-word article and create a source verification trail", done: false, category: "Verification" },
            { id: "med-3", text: "Write 3 distinct story pitches for the same underlying factual event", done: false, category: "Pitch" },
          ],
        },
        {
          id: "stg-2",
          stageNumber: 2,
          stageKey: "INTERVIEWS & NARRATIVE ARCHITECTURE",
          title: "Interview Techniques, Narrative Arc & Feature Writing",
          subtitle: "Turn raw quotes and facts into compelling narrative prose that keeps readers hooked",
          estimatedTime: "2-3 weeks",
          whyLearningThis: "Information alone is boring; stories with human stakes captivate minds and shift perspectives.",
          howItHelpsCareer: "Builds a distinctive editorial voice that editors and readers actively seek out.",
          whatComesAfter: "Long-form investigative packages, multimedia formats, and pitching editors.",
          whatToLearn: [
            "Interviewing psychology: Eliciting anecdotes, sensory details, and genuine emotional truth",
            "Narrative structure: The hook, the nut graf, tension, scenes, and resonant conclusions",
            "Tight line editing: Cutting jargon, passive voice, and unnecessary adverbs",
          ],
          whyItMatters: "The nut graf (why this story matters now) separates amateur blog posts from great reporting.",
          whatToPractice: [
            "Conduct a 30-minute in-depth interview with a subject on a pivotal decision in their life",
            "Write a 1,200-word feature story featuring at least 3 distinct character perspectives",
          ],
          whatToBuild: "A published 1,200-word narrative feature article ready for editorial submission",
          whatSuccessLooksLike: "Readers read your entire piece from start to finish without skipping paragraphs.",
          whatToDoNext: "Package your reporting for digital media and pitch major publication editors.",
          tasks: [
            { id: "med-4", text: "Conduct a 30-minute interview and transcribe the highest-impact moments", done: false, category: "Interview" },
            { id: "med-5", text: "Write a 1,200-word narrative feature with a clear nut graf and pacing", done: false, category: "Writing" },
            { id: "med-6", text: "Line-edit your draft to remove 20% of word count while sharpening clarity", done: false, category: "Editing" },
          ],
        },
        {
          id: "stg-3",
          stageNumber: 3,
          stageKey: "BYLINES & EDITORIAL LAUNCH",
          title: "Pitching Editors, Clip Portfolio & Professional Launch",
          subtitle: `Build your published byline portfolio and launch your career as a ${formattedTitle}`,
          estimatedTime: "4-6 weeks",
          whyLearningThis: "Editors receive hundreds of pitches daily; knowing how to pitch is as important as knowing how to write.",
          howItHelpsCareer: "Establishes your published byline footprint in recognized outlets and independent platforms.",
          whatComesAfter: "Staff writer roles, book proposals, investigative grants, or senior editor positions.",
          whatToLearn: [
            "The anatomy of a winning freelance pitch: Hook, thesis, access, format, and why you",
            "Building a minimalist digital clips portfolio on ReadCV, Substack, or a personal site",
            "Negotiating freelance rates, kill fees, and rights management",
          ],
          whyItMatters: "Good pitches get commissioned; great delivery gets repeat assignments.",
          whatToPractice: [
            "Draft 3 targeted pitch emails customized to specific section editors at major outlets",
            "Publish your top 3 clips on a clean personal domain with your bio and beats",
          ],
          whatToBuild: "A live professional writing portfolio featuring 3 verified published clips",
          whatSuccessLooksLike: "Receiving your first formal editorial commission and byline credit.",
          whatToDoNext: "Expand your investigative beats, build source networks, and publish consistently.",
          tasks: [
            { id: "med-7", text: "Build a clean portfolio website showcasing your 3 best writing clips", done: false, category: "Portfolio" },
            { id: "med-8", text: "Draft and submit 3 tailored pitches to editors at relevant publications", done: false, category: "Pitching" },
            { id: "med-9", text: "Build an active Twitter/Substack/LinkedIn presence covering your reporting beat", done: false, category: "Platform" },
          ],
        },
      ]
    : isPsychology || isEducation || isScience
    ? [
        {
          id: "stg-1",
          stageNumber: 1,
          stageKey: "FOUNDATIONS & SCIENTIFIC METHOD",
          title: "Core Frameworks, Literature Review & Research Ethics",
          subtitle: `Build deep grounding in the fundamental theories and methodologies of a ${formattedTitle}`,
          estimatedTime: "2-3 weeks",
          whyLearningThis: "Evidence-based practice requires understanding what research actually proves vs popular myths.",
          howItHelpsCareer: "Positions you as an authoritative, research-backed practitioner whom institutions respect.",
          whatComesAfter: "Applied methodologies, experimental design, and real-world intervention frameworks.",
          whatToLearn: [
            "Searching academic journals (PubMed, Google Scholar, JSTOR) and reading meta-analyses",
            "Research design: Control groups, randomized trials, qualitative case studies, and bias controls",
            "Professional ethics, institutional review board (IRB) standards, and informed consent",
          ],
          whyItMatters: "Applying debunked pseudoscience harms real human beings and destroys credibility.",
          whatToPractice: [
            "Perform a systematic literature review synthesizing 5 peer-reviewed papers on a central topic",
            "Critique an empirical study by identifying sample limitations and confounding variables",
          ],
          whatToBuild: "A 4-page evidence synthesis brief reviewing modern scientific consensus on a key challenge",
          whatSuccessLooksLike: "You can explain the current scientific consensus and limitations in plain, compelling English.",
          whatToDoNext: "Design applied interventions and measurement frameworks.",
          tasks: [
            { id: "sci-1", text: "Conduct an academic literature search and review 5 peer-reviewed journal articles", done: false, category: "Literature" },
            { id: "sci-2", text: "Write a 1,000-word evidence synthesis brief summarizing key empirical findings", done: false, category: "Synthesis" },
            { id: "sci-3", text: "Complete an ethics and research integrity checklist for an applied project", done: false, category: "Ethics" },
          ],
        },
        {
          id: "stg-2",
          stageNumber: 2,
          stageKey: "APPLIED PRACTICE & FIELD DESIGN",
          title: "Program Design, Intervention Frameworks & Assessment",
          subtitle: "Translate research insights into actionable, real-world solutions for people or organizations",
          estimatedTime: "3-4 weeks",
          whyLearningThis: "Theory without practical application remains trapped inside textbooks.",
          howItHelpsCareer: "Demonstrates your ability to solve complex organizational, human, or educational challenges.",
          whatComesAfter: "Data collection, outcome measurement, and capstone presentation.",
          whatToLearn: [
            "Designing measurable intervention protocols or comprehensive curriculum modules",
            "Formative vs summative assessment frameworks and qualitative feedback collection",
            "Facilitation techniques, active listening, and empathetic communication",
          ],
          whyItMatters: "Programs that fail to measure outcomes cannot prove their value or secure funding.",
          whatToPractice: [
            "Design a 4-week structured workshop or learning module with clear behavioral objectives",
            "Facilitate a 30-minute pilot session and gather structured feedback from participants",
          ],
          whatToBuild: "A comprehensive Intervention Program Guide or Curriculum Toolkit ready for deployment",
          whatSuccessLooksLike: "Participants demonstrate measurable behavioral or knowledge progress from pre-test to post-test.",
          whatToDoNext: "Measure outcomes and package your results into a professional dossier.",
          tasks: [
            { id: "sci-4", text: "Design a complete 4-week intervention curriculum or research protocol", done: false, category: "Design" },
            { id: "sci-5", text: "Conduct a pilot test session and collect anonymous participant evaluations", done: false, category: "Pilot" },
            { id: "sci-6", text: "Analyze participant outcomes and document 2 key programmatic improvements", done: false, category: "Evaluation" },
          ],
        },
        {
          id: "stg-3",
          stageNumber: 3,
          stageKey: "PROFESSIONAL DOSSIER & LAUNCH",
          title: "Capstone Study, Professional Portfolio & Career Launch",
          subtitle: `Showcase your practical expertise and launch your career as a ${formattedTitle}`,
          estimatedTime: "4-6 weeks",
          whyLearningThis: "Institutions, schools, and organizations look for verified proof of real-world impact.",
          howItHelpsCareer: "Opens doors for specialist roles, consulting contracts, research fellowships, or faculty spots.",
          whatComesAfter: "Senior advisory roles, published research, or directing institutional programs.",
          whatToLearn: [
            "Synthesizing pilot results into an executive white paper or peer-reviewed report",
            "Presenting evidence and programmatic ROI to institutional stakeholders",
            "Networking within professional associations (APA, AERA, SHRM, or scientific societies)",
          ],
          whyItMatters: "Clear presentation turns hard-won evidence into funded, influential initiatives.",
          whatToPractice: [
            "Create a 15-minute presentation walking through your intervention, methodology, and results",
            "Publish your white paper or project dossier on a public academic/professional profile",
          ],
          whatToBuild: "A comprehensive Professional Dossier featuring your research synthesis, curriculum, and pilot results",
          whatSuccessLooksLike: "Receiving offers from institutions or clients seeking your evidence-based guidance.",
          whatToDoNext: "Continue practicing with high ethical standards and contributing to community growth.",
          tasks: [
            { id: "sci-7", text: "Publish your completed capstone study or intervention dossier online", done: false, category: "Publication" },
            { id: "sci-8", text: "Present your findings at a seminar, community workshop, or peer panel", done: false, category: "Presentation" },
            { id: "sci-9", text: "Submit 5 tailored applications to leading institutions or organizations in your field", done: false, category: "Applications" },
          ],
        },
      ]
    : (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity)
    ? [
        // Tech & Software Careers
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
          whatSuccessLooksLike: "You understand what the tools do and look forward to writing code.",
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
            "Variables, control flow, functions, and state transformations",
            "Common syntax errors, how to read error messages calmly, and how to debug",
            "Reading official documentation rather than guessing blindly",
          ],
          whyItMatters: "Debugging is 80% of building. Understanding error logs gives you independence.",
          whatToPractice: [
            "Solve 10 small coding exercises that drill the fundamentals",
            "Intentionally break your code and read the resulting error banner",
          ],
          whatToBuild: "A small interactive calculator, quiz, or utility tool running cleanly",
          whatSuccessLooksLike: "You can write small functions and solve small bugs without asking for help.",
          whatToDoNext: "Build muscle memory by creating your first mini-application from a blank canvas.",
          tasks: [
            { id: "t-4", text: "Complete 10 hands-on fundamental coding exercises", done: false, category: "Practice" },
            { id: "t-5", text: "Build a single-file interactive utility with clean logic", done: false, category: "Mini-App" },
            { id: "t-6", text: "Document 3 errors you encountered and how you fixed them", done: false, category: "Debugging" },
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
            "Performance optimization, accessibility (WCAG AA), and responsive ergonomics",
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
      ]
    : [
        // General Professional Career (Any other field)
        {
          id: "stg-1",
          stageNumber: 1,
          stageKey: "DOMAIN IMMERSION & STANDARDS",
          title: "Core Vocabulary, Operating Standards & Mental Models",
          subtitle: `Build fundamental orientation in the day-to-day practice of a ${formattedTitle}`,
          estimatedTime: "1-2 weeks",
          whyLearningThis: "Understanding domain vocabulary and industry workflows eliminates beginner hesitation.",
          howItHelpsCareer: "Enables you to speak the professional language used by seasoned practitioners.",
          whatComesAfter: "Applied tool mastery, routine workflows, and first deliverables.",
          whatToLearn: [
            `What an experienced ${formattedTitle} focuses on during a typical week`,
            "Industry standard terminology, quality benchmarks, and ethical guidelines",
            "Essential free tools and resources used by practitioners in this discipline",
          ],
          whyItMatters: "Knowing industry standards keeps you from repeating amateur mistakes.",
          whatToPractice: [
            "Review 3 case studies of successful projects delivered by leaders in this field",
            "Document 10 core domain terms and their practical meanings",
          ],
          whatToBuild: "A 2-page domain summary outlining standard practices and quality benchmarks",
          whatSuccessLooksLike: "You understand the workflow from client/project brief to final delivery.",
          whatToDoNext: "Apply foundational techniques to create your first practical work sample.",
          tasks: [
            { id: "gen-1", text: "Research the standard operating workflow used by top practitioners in this role", done: false, category: "Research" },
            { id: "gen-2", text: "Create a glossary of 10 essential terms used in day-to-day operations", done: false, category: "Vocab" },
            { id: "gen-3", text: "Audit 2 real-world projects in this field and note what made them successful", done: false, category: "Analysis" },
          ],
        },
        {
          id: "stg-2",
          stageNumber: 2,
          stageKey: "APPLIED PRACTICE & TOOLS",
          title: "Tool Mastery, Standard Execution & First Deliverable",
          subtitle: "Master the essential tools and produce your first structured project artifact",
          estimatedTime: "2-3 weeks",
          whyLearningThis: "Practical skill only comes from hands-on production, not just reading theory.",
          howItHelpsCareer: "Builds confidence in turning guidelines into concrete client or team outcomes.",
          whatComesAfter: "Handling complex scenarios, edge cases, and cross-functional collaboration.",
          whatToLearn: [
            "Primary software, instruments, or operational templates used by practitioners",
            "Standard operating procedures (SOPs) and quality checklist routines",
            "Soliciting and incorporating constructive feedback from experienced peers",
          ],
          whyItMatters: "Consistency and attention to detail are what clients and employers value most.",
          whatToPractice: [
            "Complete a hands-on project artifact following professional standards",
            "Run your deliverable through a 5-point quality checklist before sharing",
          ],
          whatToBuild: "A completed initial project deliverable demonstrating solid foundational competence",
          whatSuccessLooksLike: "A practitioner in the field reviews your deliverable and confirms it meets professional baseline standards.",
          whatToDoNext: "Tackle more complex edge cases and real-world client constraints.",
          tasks: [
            { id: "gen-4", text: "Complete an initial hands-on project deliverable according to industry standards", done: false, category: "Production" },
            { id: "gen-5", text: "Run a quality audit checklist and fix any identified inconsistencies", done: false, category: "Quality" },
            { id: "gen-6", text: "Get feedback on your deliverable from at least one mentor or community peer", done: false, category: "Feedback" },
          ],
        },
        {
          id: "stg-3",
          stageNumber: 3,
          stageKey: "CAPSTONE DELIVERABLE & PORTFOLIO",
          title: "Flagship Capstone Project, Case Studies & Career Launch",
          subtitle: `Package your proof of work and launch your professional career as a ${formattedTitle}`,
          estimatedTime: "3-5 weeks",
          whyLearningThis: "Proof of work speaks louder than credentials. A tangible capstone proves your readiness.",
          howItHelpsCareer: "Attracts employers, clients, and partners by showing real capability rather than theoretical claims.",
          whatComesAfter: "Career growth, client retention, and specialization.",
          whatToLearn: [
            "Documenting project case studies: Problem, approach, trade-offs, and final outcome",
            "Creating a clean professional portfolio or dossier highlighting your best deliverables",
            "Interview storytelling, client proposal writing, and pricing negotiation",
          ],
          whyItMatters: "Visibility creates opportunity. When your work is documented clearly, opportunities come to you.",
          whatToPractice: [
            "Assemble a 3-part portfolio showcasing your best work with clear case study narratives",
            "Practice presenting your project approach in a 5-minute overview",
          ],
          whatToBuild: "A professional dossier or portfolio website showcasing your flagship project and credentials",
          whatSuccessLooksLike: "Securing interviews or client contracts based on the strength of your documented work.",
          whatToDoNext: "Deliver excellent results in your role and continue expanding your professional impact.",
          tasks: [
            { id: "gen-7", text: "Assemble your flagship project into a polished 3-page case study narrative", done: false, category: "Case Study" },
            { id: "gen-8", text: "Build an online profile or portfolio summarizing your capabilities and samples", done: false, category: "Portfolio" },
            { id: "gen-9", text: "Reach out to 5 target employers or clients with your portfolio attached", done: false, category: "Outreach" },
          ],
        },
      ];

  // Resources tailored to domain
  const resources = [
    {
      id: "res-c1",
      name: isMedical
        ? "Khan Academy MCAT & Biology"
        : isLaw
        ? "Harvard Law Review Case Studies"
        : isDesign
        ? "Nielsen Norman Group (NN/g) Usability Guides"
        : isBusiness || isMarketing
        ? "Harvard Business Review & Reforge Knowledge Base"
        : isFinance
        ? "Corporate Finance Institute (CFI) & SEC EDGAR"
        : isMedia
        ? "Columbia Journalism Review & Poynter Institute"
        : isPsychology || isEducation || isScience
        ? "APA PsycNet & PubMed Scientific Literature"
        : (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity)
        ? "MDN Web Docs & Official Guides"
        : "Industry Standards & Professional Guidelines",
      type: "free" as const,
      category: "Official Curriculum",
      description: "The gold-standard reference for fundamental principles, methodology, and best practices.",
      urlOrNote: isDesign
        ? "https://www.nngroup.com"
        : isBusiness || isMarketing
        ? "https://hbr.org"
        : isFinance
        ? "https://corporatefinanceinstitute.com"
        : isMedia
        ? "https://www.cjr.org"
        : isPsychology || isEducation || isScience
        ? "https://pubmed.ncbi.nlm.nih.gov"
        : isMedical
        ? "https://www.khanacademy.org"
        : isLaw
        ? "https://harvardlawreview.org"
        : "https://developer.mozilla.org",
    },
    {
      id: "res-c2",
      name: isRegulated
        ? "National Board Review & Licensure Guidelines"
        : isDesign
        ? "Figma Official Tutorials & Community UI Kits"
        : isBusiness || isMarketing
        ? "Strategyzer Business Models & YC Startup School"
        : isFinance
        ? "Wall Street Prep Financial Modeling Templates"
        : isMedia
        ? "Associated Press (AP) Stylebook & Narrative Arc Guides"
        : isPsychology || isEducation || isScience
        ? "Edutopia & Empirical Research Methodology Archives"
        : (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity)
        ? "freeCodeCamp Interactive Coding Tracks"
        : "Foundational Practitioner Toolkit & Exercises",
      type: "free" as const,
      category: "Interactive Practice",
      description: "Comprehensive step-by-step curriculum with hands-on practice problems and case studies.",
      urlOrNote: isDesign
        ? "https://help.figma.com"
        : isBusiness || isMarketing
        ? "https://www.startupschool.org"
        : isFinance
        ? "https://www.wallstreetprep.com"
        : isMedia
        ? "https://www.apstylebook.com"
        : (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity)
        ? "https://www.freecodecamp.org"
        : "https://www.edutopia.org",
    },
    {
      id: "res-c3",
      name: isRegulated
        ? "Kaplan / Princeton Review Professional Exam Prep"
        : isDesign
        ? "Interaction Design Foundation (IxDF) Masterclasses"
        : isBusiness || isMarketing
        ? "Reforge Strategy & Product Executive Programs"
        : isFinance
        ? "CFA Institute Investment Analysis Curriculum"
        : isMedia
        ? "Nieman Storyboard & Investigative Reporters and Editors (IRE)"
        : isPsychology || isEducation || isScience
        ? "MIT OpenCourseWare Advanced Behavioral & Sciences Library"
        : (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity)
        ? "Frontend Masters / O'Reilly Technical Library"
        : "Executive Masterclass Library & Field Certifications",
      type: "paid" as const,
      category: "In-Depth Mastery",
      description: "Deep-dive workshops and comprehensive courses taught by recognized industry and board leaders.",
      urlOrNote: isDesign
        ? "https://www.interaction-design.org"
        : isBusiness || isMarketing
        ? "https://www.reforge.com"
        : isFinance
        ? "https://www.cfainstitute.org"
        : isMedia
        ? "https://niemanstoryboard.org"
        : (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity)
        ? "https://frontendmasters.com"
        : "https://ocw.mit.edu",
    },
  ];

  // Projects tailored to domain
  const projects = [
    {
      id: "proj-c1",
      title: isRegulated
        ? "Foundational Research & Case Synthesis"
        : isDesign
        ? "Figma UI Kit & Design System Style Guide"
        : isBusiness || isMarketing
        ? "Market Opportunity Brief & 2x2 Positioning Matrix"
        : isFinance
        ? "Dynamic 3-Statement Excel Financial Model"
        : isMedia
        ? "Fact-Checked Investigation & Public Records Dossier"
        : isPsychology || isEducation || isScience
        ? "Evidence Synthesis Brief of 5 Peer-Reviewed Studies"
        : (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity)
        ? "Minimal Interactive Tool / Sandbox"
        : "Domain Operating Analysis & Work Sample",
      level: "Beginner" as const,
      objective: `Build a clean proof-of-concept milestone for ${formattedTitle}`,
      skillsPracticed: ["Core concepts", "Clean formatting", "Basic problem solving"],
      expectedOutput: "A completed initial artifact showing fundamental grasp of the material.",
      difficulty: "Gentle (1-3 days)",
      suggestedNextStep: isDesign
        ? "Create clickable interactive user flows in Figma."
        : isBusiness || isMarketing
        ? "Conduct 3 qualitative customer discovery interviews."
        : isFinance
        ? "Add Discounted Cash Flow valuation formulas."
        : (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity)
        ? "Add automated tests or interactive features."
        : "Expand into a comprehensive multi-part deliverable.",
      completed: false,
    },
    {
      id: "proj-c2",
      title: isRegulated
        ? "Comprehensive Clinical / Case Review Study"
        : isDesign
        ? "Interactive Grayscale User Flow & Usability Wireframes"
        : isBusiness || isMarketing
        ? "Product Requirements Document (PRD) & Funnel Model"
        : isFinance
        ? "Discounted Cash Flow (DCF) Valuation & Sensitivity Table"
        : isMedia
        ? "1,200-Word Narrative Feature with In-Depth Interviews"
        : isPsychology || isEducation || isScience
        ? "Applied 4-Week Intervention Curriculum / Workshop Module"
        : (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity)
        ? "Dynamic Application with Live Data"
        : "Structured Practice Deliverable with Real Constraints",
      level: "Intermediate" as const,
      objective: "Build a multi-step solution incorporating research data, user context, and edge cases.",
      skillsPracticed: ["Data handling", "Edge-case logic", "Professional standards"],
      expectedOutput: "A functional deliverable that addresses real-world challenges without breaking.",
      difficulty: "Moderate (1-2 weeks)",
      suggestedNextStep: isDesign
        ? "Conduct live usability testing with 3 users."
        : isBusiness || isMarketing
        ? "Design an A/B growth experiment brief."
        : isFinance
        ? "Draft a formal investment committee memo."
        : (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity)
        ? "Deploy to production with user authentication."
        : "Package your deliverable for public presentation.",
      completed: false,
    },
    {
      id: "proj-c3",
      title: isRegulated
        ? "Peer-Reviewed Thesis or Clinical Capstone"
        : isDesign
        ? "End-to-End Product Redesign & Complete Usability Case Study"
        : isBusiness || isMarketing
        ? "Strategic GTM Pitch Deck & Executive Board Memo"
        : isFinance
        ? "Institutional Equity Research Report & Investment Memo"
        : isMedia
        ? "Published Investigative Feature Package with Verified Bylines"
        : isPsychology || isEducation || isScience
        ? "Capstone Pilot Study & Empirical Outcome White Paper"
        : (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity)
        ? "Full-Stack Flagship Product with Database"
        : "Flagship Capstone Project & Proof-of-Work Portfolio",
      level: "Advanced" as const,
      objective: `Create a complete, polished, high-finish deliverable solving a real need in ${formattedTitle}.`,
      skillsPracticed: ["Strategic thinking", "High-finish execution", "Clear documentation", "Impact measurement"],
      expectedOutput: "A high-finish public artifact suitable for client pitches or hiring panels.",
      difficulty: "Challenging (3-4 weeks)",
      suggestedNextStep: "Present to prospective employers, clients, or institutional stakeholders.",
      completed: false,
    },
  ];

  const recommendation = {
    id: `dir-${Date.now()}`,
    directionName: formattedTitle,
    careerGoal: careerGoal,
    tagline: isRegulated
      ? `A rigorous, highly respected professional journey requiring formal credentials and statutory licensing`
      : isDesign
      ? `Shape intuitive, beautiful user experiences and design systems that delight real people`
      : isBusiness || isMarketing
      ? `Drive organizational growth, product strategy, and market leadership with commercial rigor`
      : isFinance
      ? `Master financial modeling, capital markets, and valuation to make high-conviction decisions`
      : isMedia
      ? `Uncover impactful stories, verify truth, and craft narrative journalism with editorial integrity`
      : isPsychology || isEducation || isScience
      ? `Apply scientific research, behavioral insights, and proven methodologies to help humans thrive`
      : (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity)
      ? `Build, create, and launch modern software solutions in ${formattedTitle} with project-driven mastery`
      : `Master the core crafts, standards, and practical outcomes of a ${formattedTitle}`,
    simpleExplanation: isRegulated
      ? `${formattedTitle} is a licensed profession requiring formal education, state examinations, and supervised practice to protect public health, safety, or legal rights.`
      : isDesign
      ? `${formattedTitle} focuses on understanding user needs and crafting visual, interactive, and accessible digital products.`
      : isBusiness || isMarketing
      ? `${formattedTitle} focuses on identifying market opportunities, aligning teams, and delivering products that create measurable commercial value.`
      : isFinance
      ? `${formattedTitle} focuses on analyzing financial performance, assessing investment risk, and determining the true economic value of organizations.`
      : isMedia
      ? `${formattedTitle} focuses on researching facts, interviewing key stakeholders, and producing trustworthy reporting that informs the public.`
      : isPsychology || isEducation || isScience
      ? `${formattedTitle} focuses on studying human behavior, learning principles, or natural phenomena to design evidence-based solutions.`
      : (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity)
      ? `${formattedTitle} focuses on solving real human problems by writing software, designing system architectures, and shipping reliable applications.`
      : `${formattedTitle} focuses on mastering specialized knowledge and delivering high-quality deliverables that solve problems for teams and clients.`,
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
      : isDesign
      ? [
          "Conducting user interviews or reviewing usability test recordings",
          "Iterating wireframes and high-fidelity components in Figma",
          "Collaborating with developers to ensure design system fidelity",
          "Presenting design trade-offs and rationale in design critiques",
        ]
      : isBusiness || isMarketing
      ? [
          "Analyzing customer metrics, churn rates, and growth funnel drop-offs",
          "Writing clear Product Requirement Documents (PRDs) or campaign briefs",
          "Aligning engineering, design, and sales on roadmap milestones",
          "Running customer discovery calls and evaluating competitive moves",
        ]
      : isFinance
      ? [
          "Updating 3-statement forecast models and checking balance sheet integrity",
          "Analyzing corporate 10-K filings, earnings transcripts, and peer comps",
          "Running sensitivity scenarios on interest rates, growth, and margins",
          "Drafting investment memos and presenting recommendations to partners",
        ]
      : isMedia
      ? [
          "Reviewing public records, news feeds, and story tips for investigation",
          "Conducting interviews with key sources and transcribing crucial quotes",
          "Drafting narrative feature sections and fact-checking every claim",
          "Pitching section editors and revising drafts for editorial publication",
        ]
      : isPsychology || isEducation || isScience
      ? [
          "Reviewing recent peer-reviewed literature and empirical findings",
          "Designing intervention sessions, lesson plans, or research protocols",
          "Facilitating structured assessments and observing participant responses",
          "Synthesizing qualitative and quantitative outcomes into action reports",
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
      : isDesign
      ? [
          "Visual hierarchy, spacing & optical balance",
          "Typography pairings & color accessibility (WCAG)",
          "Low-fidelity wireframing & user flow mapping",
          "Figma components, variants & auto-layout",
        ]
      : isBusiness || isMarketing
      ? [
          "Business Model Canvas & competitive positioning",
          "Customer discovery interviewing (The Mom Test)",
          "Writing clear, unambiguous PRDs and user stories",
          "Funnel analytics (AARRR) & unit economics (CAC/LTV)",
        ]
      : isFinance
      ? [
          "3-Statement financial accounting linkages",
          "Financial ratio analysis & cash flow mechanics",
          "DCF modeling, WACC & terminal valuation",
          "Excel keyboard shortcuts & clean model formatting",
        ]
      : isMedia
      ? [
          "Story angle discovery & nut graf framing",
          "Source verification & ethical attribution",
          "Conducting probing, empathetic interviews",
          "Clear, concise narrative prose & line editing",
        ]
      : isPsychology || isEducation || isScience
      ? [
          "Systematic literature review & research appraisal",
          "Formative & summative assessment design",
          "Active listening & empathetic facilitation",
          "Research integrity & informed consent protocols",
        ]
      : [
          "Core syntax & fundamental mental models",
          "Problem breakdown & algorithmic thinking",
          "Version control with Git & command line basics",
          "Building responsive, user-centered solutions",
        ],
    whatYouCanTryToday: isRegulated
      ? "Review a real diagnostic case study or official exam sample question to test your analytical instincts."
      : isDesign
      ? "Open Figma for free, pick an app you use every day, and redraw 3 screens using basic geometric frames."
      : isBusiness || isMarketing
      ? "Pick a product you love and complete a 1-page Business Model Canvas mapping its value propositions."
      : isFinance
      ? "Download Apple or Nike's latest 10-K from SEC EDGAR and calculate their operating profit margin."
      : isMedia
      ? "Find a local city council agenda and draft a 3-paragraph news pitch explaining why residents should care."
      : isPsychology || isEducation || isScience
      ? "Search Google Scholar or PubMed for a meta-analysis on a topic you are curious about and summarize its findings."
      : "Open a free browser playground and build a 10-line interactive test in 5 minutes.",
    futureOpportunities: isRegulated
      ? [
          "Licensed Specialist at leading hospitals, firms, or major airlines",
          "Department Director or Senior Partner overseeing operations",
          "Academic Clinical Faculty or Institutional Consultant",
        ]
      : isDesign
      ? [
          "Senior Product Designer or Design Systems Specialist at top teams",
          "Independent UX Consultant or Creative Agency Director",
          "Head of Design leading cross-functional creative departments",
        ]
      : isBusiness || isMarketing
      ? [
          "Senior Product Manager / VP of Product at high-growth organizations",
          "Growth Marketing Director or Chief Commercial Officer",
          "Venture Founder building and scaling your own enterprise",
        ]
      : isFinance
      ? [
          "Private Equity / Venture Capital Investment Associate or Partner",
          "Senior Equity Research Analyst or Portfolio Manager",
          "Chief Financial Officer (CFO) directing corporate capital allocation",
        ]
      : isMedia
      ? [
          "Staff Investigative Reporter at leading newsrooms or magazines",
          "Editorial Director, Newsletter Founder, or Author",
          "Senior Communications Strategist or Media Executive",
        ]
      : isPsychology || isEducation || isScience
      ? [
          "Senior Research Scientist or Clinical Program Director",
          "Chief Learning Officer (CLO) or Educational Technology Leader",
          "Independent Organizational Consultant or Faculty Scholar",
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
        : isDesign
        ? `A mobile checkout flow has an 80% cart abandonment rate. Users report feeling overwhelmed by dense forms and unclear button hierarchy.`
        : isBusiness || isMarketing
        ? `A promising SaaS product has high trial signups but 70% churn before day 14. Leadership asks for a strategic diagnosis and plan.`
        : isFinance
        ? `A public company is considering acquiring a competitor at a 30% premium. The CFO needs an initial valuation check on whether this creates shareholder value.`
        : isMedia
        ? `Breaking news claims an official acted improperly, but the primary source is an anonymous online forum post with screenshots.`
        : isPsychology || isEducation || isScience
        ? `A classroom or team reports low engagement and high anxiety during collaborative group tasks.`
        : (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity)
        ? `A user needs a responsive solution that updates in real time and provides clean, clear feedback.`
        : `A client approaches you with an ambiguous request that needs clear scoping and professional recommendations.`,
      taskDescription: isRegulated
        ? "Analyze the given circumstances and outline your initial diagnostic reasoning in 2 clear sentences."
        : isDesign
        ? "Identify 3 specific UX improvements you would make to reduce cognitive load in this flow."
        : isBusiness || isMarketing
        ? "Formulate 2 hypotheses for the activation drop-off and propose 1 immediate customer discovery interview question."
        : isFinance
        ? "List the 3 primary financial metrics and valuation approaches you would run to assess this deal."
        : isMedia
        ? "Explain the exact 3-step verification process you must execute before publishing any claim."
        : isPsychology || isEducation || isScience
        ? "Propose 1 evidence-based intervention based on cognitive or motivational principles to test with the group."
        : (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity)
        ? "Make a small adjustment to the template code, test the interactive button, and observe the result."
        : "Outline your initial 3-step assessment and communication plan for the client in 2-3 sentences.",
      type: (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity) ? ("code" as const) : ("logic" as const),
      starterTemplate: (isAIEngineer || isSoftwareDev || isGameDev || isCybersecurity)
        ? `<div class="p-6 bg-white rounded-2xl border border-neutral-200">
  <h3 class="text-lg font-bold text-neutral-900">${formattedTitle} Sandbox</h3>
  <p class="text-sm text-neutral-600 mt-1">Ready to test your hands-on instincts.</p>
  <button class="mt-4 px-4 py-2 bg-neutral-900 text-white text-xs rounded-full font-medium hover:bg-black transition">Run Test →</button>
</div>`
        : undefined,
      sampleGuidance: isDesign
        ? "Consider visual hierarchy, single-column progressive disclosure, and clear primary CTA contrast."
        : isBusiness || isMarketing
        ? "Focus on the 'aha' moment of user activation and qualitative feedback rather than vanity metrics."
        : isFinance
        ? "Think about accretive vs dilutive EPS, EV/EBITDA multiples, and cash flow stability."
        : isMedia
        ? "Emphasize primary document trails, on-the-record corroboration, and fairness of reply."
        : "Focus on clarity and simplicity over complicated jargon.",
    },
    comparison: {
      whatIsIt: isRegulated
        ? "A legally regulated, highly specialized professional service."
        : `Professional practice and impact delivery in ${formattedTitle}.`,
      whatWouldIDo: isRegulated
        ? "Diagnose, evaluate, document, and treat or represent patients/clients."
        : isDesign
        ? "Research user behavior, design intuitive interface systems, and prototype flows."
        : isBusiness || isMarketing
        ? "Analyze market opportunities, lead cross-functional product initiatives, and drive growth."
        : isFinance
        ? "Build valuation models, analyze financial statements, and structure investment decisions."
        : isMedia
        ? "Investigate leads, interview sources, and report accurate, engaging stories for the public."
        : isPsychology || isEducation || isScience
        ? "Conduct research, design learning/behavioral interventions, and measure human outcomes."
        : "Plan, design, code, and deploy real systems.",
      creativeFactor: isDesign || isMedia
        ? "Very High — crafting original aesthetics, narratives, and user experiences."
        : isBusiness || isMarketing
        ? "High — creative strategy, problem framing, and innovative business models."
        : isRegulated
        ? "Medium — creative problem solving within rigorous safety and ethical bounds."
        : "High — turning imagination into working systems.",
      problemSolving: "Very High — systematic analysis, evidence evaluation, and critical decision-making.",
      workingWithPeople: isRegulated || isPsychology || isEducation
        ? "Very High — continuous interaction with patients, clients, students, and teams."
        : isBusiness || isMarketing || isDesign || isMedia
        ? "High — daily interviews, stakeholder presentations, and team collaboration."
        : "Medium to High — collaboration with teammates, peers, and stakeholders.",
      beginnerDifficulty: isRegulated
        ? "High — requires multi-year academic degrees and licensing exams."
        : "Gentle to Moderate start with structured free resources and practical exercises.",
      whatCanITryToday: isRegulated
        ? "Read a real clinical case, legal brief, or pilot checklist."
        : isDesign
        ? "Open Figma for free and recreate 3 screens of your favorite app."
        : isBusiness || isMarketing
        ? "Complete a 1-page Business Model Canvas on an innovative startup."
        : isFinance
        ? "Calculate the gross and operating margin of a public company from their 10-K."
        : isMedia
        ? "Draft a 3-paragraph news angle on a recent local government action."
        : isPsychology || isEducation || isScience
        ? "Read an open-access review paper on PubMed and write down 3 key takeaways."
        : "Write a 5-minute script or test an interactive sandbox.",
      whoMightEnjoy: isRegulated
        ? "People who value deep mastery, rigorous ethics, and helping people directly."
        : isDesign
        ? "Visual thinkers who care deeply about usability, aesthetics, and how people feel using products."
        : isBusiness || isMarketing
        ? "Strategic thinkers who enjoy market dynamics, leading teams, and commercial impact."
        : isFinance
        ? "Analytical thinkers who love numbers, financial modeling, and evaluating investment risks."
        : isMedia
        ? "Curious investigators who love storytelling, asking questions, and seeking truth."
        : isPsychology || isEducation || isScience
        ? "Empathetic thinkers fascinated by human behavior, learning, and scientific discovery."
        : "Curious builders who like seeing their work come alive and solving concrete problems.",
    },
  };

  return {
    recommendation,
    roadmap: stages,
    resources,
    projects,
  };
}
