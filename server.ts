import express from "express";
import path from "path";
import fs from "fs";
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
  logProgress,
  startFreshJourney,
  getJourneyHistory
} from "./server/db";

import {
  callAIModel,
  extractCleanJson,
  synthesizeRecommendationsFallback,
  synthesizeRoadmapFallback
} from "./server/ai";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "2mb" }));

// Server-side environment configuration
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.2-11b-vision-instruct";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Health check route
app.get("/api/health", async (_req, res) => {
  const dbStatus = await getDbStatus();
  res.json({
    status: "ok",
    models: {
      nvidia: NVIDIA_MODEL,
      nvidiaActive: Boolean(NVIDIA_API_KEY && NVIDIA_API_KEY.length > 5),
      gemini: "gemini-3.8-flash",
      geminiActive: Boolean(GEMINI_API_KEY && GEMINI_API_KEY.length > 5),
    },
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

// START FRESH: Safely archive current journey, preserve history & reset active session
app.post("/api/user/start-fresh", async (req, res) => {
  try {
    const userId = req.body.userId || "default-explorer";
    const result = await startFreshJourney(userId);
    res.json(result);
  } catch (err: any) {
    console.error("Error in /api/user/start-fresh:", err);
    res.status(500).json({ error: "Failed to start fresh journey" });
  }
});

// Fetch historical journeys
app.get("/api/user/journey-history", async (req, res) => {
  try {
    const userId = (req.query.userId as string) || "default-explorer";
    const history = await getJourneyHistory(userId);
    res.json({ journeys: history });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch journey history" });
  }
});

// 1. AI Chat Route for Mentor & Interactive Guide
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { messages, userContext } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required." });
    }

    const userId = req.body.userId || "default-explorer";
    const lastUserMsg = messages[messages.length - 1]?.content || "";

    // Prepare system prompt with friendly ORBIT personality and user context
    let systemInstruction = `You are ORBIT's intelligent personal career and skill guide for students and young people.
Your brand is ORBIT, built by ADITYAX.
Core philosophy: "Everyone is running. But where are you going?"
Help users go from confused to understood, then explore, try, choose, learn, build, and grow.

Personality:
- Friendly, patient, encouraging, honest, concise, curious, and non-judgmental.
- Speak in simple, natural, everyday language. Never use corporate jargon or buzzwords.
- Keep answers practical, grounded, and bite-sized (1-2 short paragraphs).
- If the user is overwhelmed, break the next step into something tiny and achievable in 15 minutes.
- CHANGING DIRECTION IS ALWAYS ALLOWED: If the user has started fresh or changed their mind, never anchor on old abandoned choices. Look at their current direction with fresh eyes!`;

    if (userContext) {
      systemInstruction += `\n\nUser Context:\n${JSON.stringify(userContext, null, 2)}`;
    }

    const conversationText = messages
      .slice(-6)
      .map((m: any) => `${m.role === "user" ? "User" : "Mentor"}: ${m.content}`)
      .join("\n\n");

    let aiMessage = "";
    try {
      aiMessage = await callAIModel({
        systemPrompt: systemInstruction,
        userPrompt: conversationText,
        temperature: 0.6,
        maxTokens: 1024,
        timeoutMs: 6000,
      });
    } catch (aiErr: any) {
      console.warn("[AI Chat] Fallback triggered:", aiErr?.message);
      const chosenDir = userContext?.chosenDirection || "your path";
      aiMessage = `I'm right here with you! When exploring ${chosenDir}, remember the most important rule: start tiny. Pick just one 15-minute concept or interactive test today. You don't need to know the next 5 years—just your next single step. What part feels most interesting to try?`;
    }

    // Persist conversation turn in PostgreSQL ai_mentor_context table
    if (lastUserMsg) {
      saveMentorMessage(userId, "user", lastUserMsg, userContext?.currentStage).catch(e =>
        console.warn("Could not persist user chat message to DB:", e.message)
      );
    }
    saveMentorMessage(userId, "assistant", aiMessage, userContext?.currentStage).catch(e =>
      console.warn("Could not persist AI chat message to DB:", e.message)
    );

    return res.json({ content: aiMessage });
  } catch (error: any) {
    console.error("Error in /api/ai/chat:", error?.message || error);
    return res.json({
      content: "I'm here to help you figure this out step-by-step. Pick one small project or skill you feel curious about today, and let's test it together!",
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

    const prompt = `You are ORBIT's career and skill discovery guide.
A student just completed onboarding with these answers:
${JSON.stringify(answers, null, 2)}

Output strictly valid JSON with EXACTLY this schema:
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
    }
  ]
}
Output strictly valid JSON only without markdown fences or preamble. Exactly 3 recommendations.`;

    let data: any = null;
    try {
      const rawText = await callAIModel({
        systemPrompt: "You are ORBIT career discovery AI. You output strictly valid JSON matching the user's schema without preamble.",
        userPrompt: prompt,
        temperature: 0.3,
        maxTokens: 3000,
        timeoutMs: 3500,
      });
      data = extractCleanJson(rawText);
      if (!data?.profile || !Array.isArray(data?.recommendations) || data.recommendations.length === 0) {
        throw new Error("Missing required profile or recommendations array");
      }
    } catch (err: any) {
      console.warn("[AI Recommendations] Using dynamic tailored fallback:", err?.message);
      data = synthesizeRecommendationsFallback(answers);
    }

    // Persist to PostgreSQL in background
    const userId = req.body.userId || "default-explorer";
    saveOnboardingData(userId, answers, data.profile, data.recommendations).catch(e =>
      console.warn("Could not persist onboarding data to PostgreSQL:", e.message)
    );

    return res.json(data);
  } catch (error: any) {
    console.error("Critical error in /api/ai/generate-recommendations:", error?.message || error);
    const fallbackData = synthesizeRecommendationsFallback(req.body?.answers || {});
    return res.json(fallbackData);
  }
});

// 3. Generate 7-Stage Personalized Roadmap & Learning Projects
app.post("/api/ai/generate-roadmap", async (req, res) => {
  try {
    const { direction, profile } = req.body;
    if (!direction) {
      return res.status(400).json({ error: "Chosen direction is required." });
    }

    const prompt = `Create a 7-stage personalized roadmap for a beginner learning: "${direction.directionName}".
User background: ${JSON.stringify(profile || {}, null, 2)}

Respond ONLY in valid JSON matching:
{
  "roadmap": [
    {
      "id": "stg-1",
      "stageNumber": 1,
      "stageKey": "START HERE",
      "title": "string",
      "subtitle": "string",
      "whatToLearn": ["string"],
      "whyItMatters": "string",
      "whatToPractice": ["string"],
      "whatToBuild": "string",
      "whatSuccessLooksLike": "string",
      "whatToDoNext": "string",
      "tasks": [
        { "id": "t1-1", "text": "string", "done": false }
      ]
    }
  ],
  "resources": [
    {
      "id": "res-1",
      "title": "string",
      "provider": "string",
      "type": "free",
      "format": "string",
      "url": "https://example.com",
      "description": "string",
      "estimatedTime": "string"
    }
  ],
  "projects": [
    {
      "id": "proj-1",
      "title": "string",
      "level": "Beginner",
      "objective": "string",
      "skillsPracticed": ["string"],
      "expectedOutput": "string",
      "difficulty": "string",
      "suggestedNextStep": "string",
      "completed": false
    }
  ]
}`;

    let data: any = null;
    try {
      const rawText = await callAIModel({
        systemPrompt: "You are ORBIT curriculum planner. Output strictly valid JSON without conversational preamble.",
        userPrompt: prompt,
        temperature: 0.3,
        maxTokens: 3500,
        timeoutMs: 3500,
      });
      data = extractCleanJson(rawText);
      if (!Array.isArray(data?.roadmap) || data.roadmap.length === 0) {
        throw new Error("Missing roadmap array");
      }
    } catch (err: any) {
      console.warn("[AI Roadmap] Using curated blueprint fallback:", err?.message);
      data = synthesizeRoadmapFallback(direction, profile);
    }

    return res.json(data);
  } catch (error: any) {
    console.error("Critical error in /api/ai/generate-roadmap:", error?.message || error);
    const fallbackData = synthesizeRoadmapFallback(req.body?.direction, req.body?.profile);
    return res.json(fallbackData);
  }
});

// 4. Challenge Feedback Route
app.post("/api/ai/challenge-feedback", async (req, res) => {
  try {
    const { direction, challengeTitle, userSubmission, reflection } = req.body;

    const prompt = `A student just tried a practical challenge for: "${direction}".
Challenge: "${challengeTitle}"
User's submission: "${userSubmission || '(Completed the interactive test)'}"
User reflection:
- Did they enjoy it? "${reflection?.enjoyed || 'Yes'}"
- What felt easy? "${reflection?.easy || 'Getting started'}"
- What felt frustrating? "${reflection?.frustrating || 'Minor debugging'}"

Give a friendly, encouraging, thoughtful review (around 2-3 short paragraphs):
1. Celebrate their attempt honestly and validate whatever they felt.
2. Explain what their reaction reveals about whether this path fits them.
3. A zero-pressure next step to explore if they feel like continuing.
Respond in plain text.`;

    let feedback = "";
    try {
      feedback = await callAIModel({
        systemPrompt: "You are a warm, supportive, honest mentor for young people. Keep your tone uplifting and conversational.",
        userPrompt: prompt,
        temperature: 0.6,
        maxTokens: 800,
        timeoutMs: 6000,
      });
    } catch (err: any) {
      console.warn("[AI Feedback] Using tailored reflection fallback:", err?.message);
      feedback = `Great work trying out this practical test for ${direction}! You noticed that you ${reflection?.enjoyed ? reflection.enjoyed.toLowerCase() : 'enjoyed the challenge'} and that "${reflection?.easy || 'getting started'}" felt approachable. Taking 5 minutes to test an actual skill before committing months of study is exactly how clear directions are found. Whenever you feel ready, take your next step with zero pressure!`;
    }

    return res.json({ feedback });
  } catch (error: any) {
    console.error("Critical error in /api/ai/challenge-feedback:", error?.message || error);
    return res.json({
      feedback: "Great job completing this practical test! Your honest reaction is the best guide for what fits your natural instincts.",
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

  // Determine production mode: explicit NODE_ENV=production, or running as bundled .cjs, or dist/index.html exists
  const isProduction =
    process.env.NODE_ENV === "production" ||
    (typeof __filename !== "undefined" && __filename.endsWith(".cjs")) ||
    (!process.env.NODE_ENV && fs.existsSync(path.join(process.cwd(), "dist", "index.html")));

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    // Protect server bundle and sourcemap files from public downloads
    app.use((req, res, next) => {
      if (req.path === "/server.cjs" || req.path.endsWith(".cjs") || req.path.endsWith(".map")) {
        return res.status(404).end();
      }
      next();
    });
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
