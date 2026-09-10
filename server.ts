import express from "express";
import path from "path";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import { createServer as createViteServer } from "vite";
import {
  initDatabase,
  getDbStatus,
  saveOnboardingData,
  saveSelectedPathAndRoadmap,
  toggleTaskInDb,
  toggleProjectInDb,
  saveChallengeReflection,
  saveMentorMessage,
  getMentorHistory,
  loadFullUserState,
  logProgress
} from "./server/db";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "2mb" }));

// Server-side environment configuration
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";
const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || "openai/gpt-oss-20b";

function getOpenAIClient(): OpenAI | null {
  if (!NVIDIA_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: NVIDIA_API_KEY,
    baseURL: NVIDIA_BASE_URL,
  });
}

// Health check route
app.get("/api/health", async (_req, res) => {
  const dbStatus = await getDbStatus();
  res.json({
    status: "ok",
    model: NVIDIA_MODEL,
    hasApiKey: Boolean(NVIDIA_API_KEY && NVIDIA_API_KEY.length > 5),
    database: {
      connected: dbStatus.connected,
      engine: dbStatus.engine,
      tablesCount: dbStatus.tables.length,
    }
  });
});

// Database status and verification route
app.get("/api/db/status", async (_req, res) => {
  try {
    const status = await getDbStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Load persistent user state from PostgreSQL
app.get("/api/user/state", async (req, res) => {
  try {
    const userId = (req.query.userId as string) || "default-explorer";
    const state = await loadFullUserState(userId);
    res.json(state);
  } catch (err: any) {
    console.error("Error in /api/user/state:", err);
    res.status(500).json({ error: "Failed to load user state from database" });
  }
});

// Persist onboarding and recommendations to PostgreSQL
app.post("/api/user/onboarding", async (req, res) => {
  try {
    const { userId = "default-explorer", answers, profile, recommendations } = req.body;
    if (!answers || !profile || !recommendations) {
      return res.status(400).json({ error: "Missing required onboarding data" });
    }
    await saveOnboardingData(userId, answers, profile, recommendations);
    res.json({ success: true, message: "Onboarding data saved to PostgreSQL" });
  } catch (err: any) {
    console.error("Error saving onboarding to DB:", err);
    res.status(500).json({ error: "Database error saving onboarding data" });
  }
});

// Persist selected path and generated roadmap to PostgreSQL
app.post("/api/user/select-path", async (req, res) => {
  try {
    const { userId = "default-explorer", recommendation, roadmap } = req.body;
    if (!recommendation || !roadmap) {
      return res.status(400).json({ error: "Missing recommendation or roadmap" });
    }
    await saveSelectedPathAndRoadmap(userId, recommendation, roadmap);
    res.json({ success: true, message: "Selected path and roadmap saved to PostgreSQL" });
  } catch (err: any) {
    console.error("Error saving path to DB:", err);
    res.status(500).json({ error: "Database error saving selected path" });
  }
});

// Toggle roadmap task completion in PostgreSQL
app.post("/api/user/task-toggle", async (req, res) => {
  try {
    const { userId = "default-explorer", taskId, isCompleted } = req.body;
    if (!taskId) return res.status(400).json({ error: "Task ID is required" });
    await toggleTaskInDb(userId, taskId, isCompleted);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error toggling task in DB:", err);
    res.status(500).json({ error: "Database error updating task" });
  }
});

// Toggle project completion in PostgreSQL
app.post("/api/user/project-toggle", async (req, res) => {
  try {
    const { userId = "default-explorer", projectId, isCompleted } = req.body;
    if (!projectId) return res.status(400).json({ error: "Project ID is required" });
    await toggleProjectInDb(userId, projectId, isCompleted);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error toggling project in DB:", err);
    res.status(500).json({ error: "Database error updating project" });
  }
});

// Save challenge reflection to PostgreSQL
app.post("/api/user/challenge-reflection", async (req, res) => {
  try {
    const { userId = "default-explorer", recommendationId, submission } = req.body;
    if (!recommendationId || !submission) {
      return res.status(400).json({ error: "Missing required challenge reflection data" });
    }
    await saveChallengeReflection(userId, recommendationId, submission);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error saving challenge reflection to DB:", err);
    res.status(500).json({ error: "Database error saving challenge reflection" });
  }
});

// Fetch AI Mentor chat history from PostgreSQL
app.get("/api/user/chat-history", async (req, res) => {
  try {
    const userId = (req.query.userId as string) || "default-explorer";
    const history = await getMentorHistory(userId);
    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

// Helper to clean JSON string from LLM responses
function extractCleanJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    // Attempt markdown code fence extraction
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]);
      } catch (innerErr) {
        console.error("Failed to parse extracted code block JSON:", innerErr);
      }
    }
    // Attempt greedy object/array extraction
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const slice = text.substring(firstBrace, lastBrace + 1);
      return JSON.parse(slice);
    }
    throw new Error("Unable to parse JSON from AI response");
  }
}

// 1. AI Chat Route for Mentor & Interactive Guide
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { messages, userContext } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required." });
    }

    const client = getOpenAIClient();
    if (!client) {
      return res.status(503).json({
        error: "NVIDIA_API_KEY is not configured on the server. Please provide it in your environment settings.",
      });
    }

    // Prepare system prompt with friendly ORBIT personality and user context
    let systemInstruction = `You are ORBIT's intelligent personal career and skill guide for students and young people.
Your brand is ORBIT, built by ADITYAX.
Core philosophy: "Everyone is running. But where are you going?"
Help users go from confused to understood, then explore, try, choose, learn, build, and grow.

Personality:
- Friendly, patient, encouraging, honest, concise, curious, and non-judgmental.
- Speak in simple, natural, everyday language. Never use corporate jargon or buzzwords like "career trajectory", "competency matrix", "optimization", "skill taxonomy".
- Never pretend to know the user better than you do. Never say "You are definitely meant to be...". Say "This could be worth exploring because...".
- Keep answers practical, grounded, and bite-sized. Do not dump walls of text.
- If the user is overwhelmed, break the next step into something tiny and achievable in 15 minutes.`;

    if (userContext) {
      systemInstruction += `\n\nUser Context:\n${JSON.stringify(userContext, null, 2)}`;
    }

    const fullMessages = [
      { role: "system" as const, content: systemInstruction },
      ...messages.slice(-10), // keep last 10 messages for context
    ];

    const completion = await client.chat.completions.create({
      model: NVIDIA_MODEL,
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 2048,
    });

    const choice = completion.choices?.[0];
    const aiMessage = choice?.message?.content || "I'm here to help you figure this out. What's on your mind?";

    // Persist conversation turn in PostgreSQL ai_mentor_context table
    const userId = req.body.userId || "default-explorer";
    const lastUserMsg = messages[messages.length - 1]?.content;
    if (lastUserMsg) {
      saveMentorMessage(userId, "user", lastUserMsg, userContext?.currentStage).catch(e =>
        console.warn("Could not persist user chat message to DB:", e.message)
      );
    }
    saveMentorMessage(userId, "assistant", aiMessage, userContext?.currentStage).catch(e =>
      console.warn("Could not persist AI chat message to DB:", e.message)
    );

    return res.json({
      content: aiMessage,
    });
  } catch (error: any) {
    console.error("Error in /api/ai/chat:", error?.message || error);
    return res.status(500).json({
      error: "Something went wrong while talking to your AI guide. Let's try again.",
    });
  }
});

// 2. Generate Profile and 3 Recommendations from Onboarding Answers
app.post("/api/ai/generate-recommendations", async (req, res) => {
  try {
    const { answers } = req.body;
    if (!answers) {
      return res.status(400).json({ error: "Onboarding answers are required." });
    }

    const client = getOpenAIClient();
    if (!client) {
      return res.status(503).json({
        error: "NVIDIA_API_KEY is not configured on the server. Please provide it in your environment settings.",
      });
    }

    const prompt = `You are ORBIT's career and skill discovery guide.
A student or beginner just completed onboarding. Here are their honest answers:
${JSON.stringify(answers, null, 2)}

Create:
1. A structured user profile: "What seems to fit you" (simple, non-jargon, warm summary).
2. EXACTLY 3 distinct, practical career / skill directions that naturally align with their curiosity and preferences.
Do NOT give 20 careers. Exactly 3.
3. For each direction, provide:
   - directionName (clear, accessible name like 'Creative Frontend Development', 'Product UX & Interface Design', 'Data Analysis & Visual Storytelling')
   - tagline (short, inspiring one-liner)
   - simpleExplanation (what this really is in plain words a 16-year-old understands)
   - whyItFitsYou (direct connection to what they said they like / dislike)
   - dayInTheLife (3-4 bullet points of what people actually do)
   - beginnerSkills (3-4 foundational things to learn first)
   - whatYouCanTryToday (a specific quick action they can do in 10 minutes)
   - futureOpportunities (3 real possibilities / paths)
   - challenge: a practical "Try Before You Commit" challenge with:
       title: string
       scenario: string (a friendly realistic mini-task)
       taskDescription: string
       type: 'code' | 'design' | 'creative' | 'logic'
       sampleGuidance: string (tips to complete it)
   - comparison:
       whatIsIt: string
       whatWouldIDo: string
       creativeFactor: string (e.g., 'High - designing visual feel')
       problemSolving: string (e.g., 'Medium - debugging logic')
       workingWithPeople: string (e.g., 'Medium - small team')
       beginnerDifficulty: string (e.g., 'Gentle - fast visual rewards')
       whatCanITryToday: string
       whoMightEnjoy: string

Respond ONLY in valid JSON matching this structure:
{
  "profile": {
    "headline": "string",
    "summary": "string",
    "naturalStrengths": ["string"],
    "workStyle": "string",
    "motivation": "string",
    "thingsToAvoid": ["string"],
    "curiosityAreas": ["string"],
    "startingLevel": "string"
  },
  "recommendations": [
    {
      "id": "dir-1",
      "directionName": "string",
      "tagline": "string",
      "simpleExplanation": "string",
      "whyItFitsYou": "string",
      "dayInTheLife": ["string"],
      "beginnerSkills": ["string"],
      "whatYouCanTryToday": "string",
      "futureOpportunities": ["string"],
      "challenge": {
        "title": "string",
        "scenario": "string",
        "taskDescription": "string",
        "type": "code",
        "starterTemplate": "string",
        "sampleGuidance": "string"
      },
      "comparison": {
        "whatIsIt": "string",
        "whatWouldIDo": "string",
        "creativeFactor": "string",
        "problemSolving": "string",
        "workingWithPeople": "string",
        "beginnerDifficulty": "string",
        "whatCanITryToday": "string",
        "whoMightEnjoy": "string"
      }
    },
    // exactly 2 more recommendations (total 3)
  ]
}`;

    const completion = await client.chat.completions.create({
      model: NVIDIA_MODEL,
      messages: [
        {
          role: "system",
          content: "You output strictly valid JSON without conversational preamble. Use simple, warm, supportive language with zero jargon.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });

    const content = completion.choices?.[0]?.message?.content || "{}";
    const data = extractCleanJson(content);

    return res.json(data);
  } catch (error: any) {
    console.error("Error in /api/ai/generate-recommendations:", error?.message || error);
    return res.status(500).json({
      error: "Something went wrong while talking to your AI guide. Let's try again.",
    });
  }
});

// 3. Generate 7-Stage Personalized Roadmap & Learning Projects
app.post("/api/ai/generate-roadmap", async (req, res) => {
  try {
    const { direction, profile } = req.body;
    if (!direction) {
      return res.status(400).json({ error: "Chosen direction is required." });
    }

    const client = getOpenAIClient();
    if (!client) {
      return res.status(503).json({
        error: "NVIDIA_API_KEY is not configured on the server. Please provide it in your environment settings.",
      });
    }

    const prompt = `Create a 7-stage personalized roadmap for a beginner learning: "${direction.directionName}".
User background & strengths: ${JSON.stringify(profile || {}, null, 2)}

Structure MUST follow these exact 7 progressive stages:
1. START HERE (orientation, zero pressure, setting up simple free tools)
2. BASICS (core foundational concepts explained simply)
3. FIRST PROJECT (a tiny win that works in 1-2 days)
4. PRACTICE (building confidence with mini experiments)
5. REAL PROJECTS (standalone portfolio pieces solving real needs)
6. PORTFOLIO (showcasing your work to friends, clients, or employers)
7. NEXT LEVEL (deepening skills, staying curious, choosing a specialization)

For EACH stage include:
- stageNumber (1 to 7)
- stageKey: EXACTLY one of ['START HERE', 'BASICS', 'FIRST PROJECT', 'PRACTICE', 'REAL PROJECTS', 'PORTFOLIO', 'NEXT LEVEL']
- title: clear stage name
- subtitle: short welcoming focus
- whatToLearn: 3-4 key concepts
- whyItMatters: why this step is essential in plain language
- whatToPractice: 2-3 exercises
- whatToBuild: a tangible small milestone
- whatSuccessLooksLike: how the user knows they are ready to move forward
- whatToDoNext: immediate next action
- tasks: 3 actionable checkbox items { id: string, text: string, done: false }

Also provide:
- resources: list of 6 curated learning resources, strictly categorized into 'free' or 'paid' (use real, well-known platforms like freeCodeCamp, MDN Web Docs, official tutorials, Coursera, YouTube documentation; DO NOT fabricate fake courses, fake prices, or fake credentials).
- projects: 3 project-based learning items (1 Beginner, 1 Intermediate, 1 Advanced) with:
    id: string
    title: string
    level: 'Beginner' | 'Intermediate' | 'Advanced'
    objective: string
    skillsPracticed: string[]
    expectedOutput: string
    difficulty: string
    suggestedNextStep: string
    completed: false

Respond ONLY in valid JSON:
{
  "roadmap": [ ... 7 stages ... ],
  "resources": [ ... 6 resources ... ],
  "projects": [ ... 3 projects ... ]
}`;

    const completion = await client.chat.completions.create({
      model: NVIDIA_MODEL,
      messages: [
        {
          role: "system",
          content: "You output strictly valid JSON without conversational preamble. Use simple, warm, supportive language with zero jargon.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });

    const content = completion.choices?.[0]?.message?.content || "{}";
    const data = extractCleanJson(content);

    return res.json(data);
  } catch (error: any) {
    console.error("Error in /api/ai/generate-roadmap:", error?.message || error);
    return res.status(500).json({
      error: "Something went wrong while talking to your AI guide. Let's try again.",
    });
  }
});

// 4. Challenge Feedback Route
app.post("/api/ai/challenge-feedback", async (req, res) => {
  try {
    const { direction, challengeTitle, userSubmission, reflection } = req.body;

    const client = getOpenAIClient();
    if (!client) {
      return res.status(503).json({
        error: "NVIDIA_API_KEY is not configured on the server. Please provide it in your environment settings.",
      });
    }

    const prompt = `A student just tried a practical challenge for: "${direction}".
Challenge: "${challengeTitle}"
User's submission / output: "${userSubmission || '(Completed the interactive test)'}"
User reflection:
- Did they enjoy it? "${reflection?.enjoyed || 'Yes'}"
- What felt easy? "${reflection?.easy || 'Getting started'}"
- What felt frustrating? "${reflection?.frustrating || 'Minor debugging'}"

Give a friendly, encouraging, thoughtful review (around 3 short paragraphs):
1. Celebrate their attempt honestly and validate whatever they felt.
2. Explain what their reaction reveals about whether this path fits them (e.g. if debugging was frustrating vs exciting, what that means).
3. A zero-pressure next step to explore if they feel like continuing.

Never say "You are destined for this". Say "This reaction shows that...".
Respond in plain text.`;

    const completion = await client.chat.completions.create({
      model: NVIDIA_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a warm, supportive, honest mentor for young people. Keep your tone uplifting and conversational.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const feedback = completion.choices?.[0]?.message?.content || "Great job trying this out!";
    return res.json({ feedback });
  } catch (error: any) {
    console.error("Error in /api/ai/challenge-feedback:", error?.message || error);
    return res.status(500).json({
      error: "Something went wrong while talking to your AI guide. Let's try again.",
    });
  }
});

async function startServer() {
  // Initialize PostgreSQL and run all migrations
  try {
    const dbStatus = await initDatabase();
    console.log(`[ORBIT Database] Status: ${dbStatus.engine}, Tables: ${dbStatus.tables.length}`);
  } catch (err: any) {
    console.error("[ORBIT Database] Startup error:", err.message);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ORBIT server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
