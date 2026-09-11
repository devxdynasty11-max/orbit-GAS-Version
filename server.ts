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
  getJourneyHistory,
  ensureUser,
  getUser,
  findUserByIdentifier,
  saveOnboardingDraft,
  updateUserProfile
} from "./server/db";

import {
  callAIModel,
  callAIChat,
  extractCleanJson,
  synthesizeRecommendationsFallback,
  synthesizeRoadmapFallback,
  synthesizeCareerPathwayFallback
} from "./server/ai";

dotenv.config();

const app = express();
const PORT = 3000;

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
      gemini: "gemini-3.6-flash",
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

// Initialize or verify user session in PostgreSQL
app.post("/api/user/session/init", async (req, res) => {
  try {
    const { userId, name, email } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    await ensureUser(userId, name, email);
    const state = await loadFullUserState(userId);
    res.json({ success: true, state });
  } catch (err: any) {
    console.error("Error in /api/user/session/init:", err);
    res.status(500).json({ error: "Failed to initialize user session" });
  }
});

// Look up existing user by Email or Account ID (cross-device profile retrieval)
app.post("/api/user/session/lookup", async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      return res.status(400).json({ error: "Identifier is required" });
    }
    const foundUser = await findUserByIdentifier(identifier.trim());
    if (!foundUser) {
      return res.json({ found: false });
    }
    const state = await loadFullUserState(foundUser.id);
    res.json({
      found: true,
      userId: foundUser.id,
      user: foundUser,
      state
    });
  } catch (err: any) {
    console.error("Error in /api/user/session/lookup:", err);
    res.status(500).json({ error: "Failed to lookup user" });
  }
});

// Save incremental onboarding draft step to prevent data loss on refresh or interruption
app.post("/api/user/onboarding/draft", async (req, res) => {
  try {
    const { userId = "default-explorer", step = 0, draftAnswers = {}, name, email } = req.body;
    await saveOnboardingDraft(userId, Number(step), draftAnswers, name, email);
    res.json({ success: true, message: "Draft step saved to PostgreSQL" });
  } catch (err: any) {
    console.error("Error saving onboarding draft:", err);
    res.status(500).json({ error: "Failed to save draft progress" });
  }
});

// Update user profile details from Settings/Profile modal
app.post("/api/user/profile/update", async (req, res) => {
  try {
    const { userId = "default-explorer", ...profileUpdates } = req.body;
    await updateUserProfile(userId, profileUpdates);
    const updatedState = await loadFullUserState(userId);
    res.json({ success: true, message: "Profile updated successfully", state: updatedState });
  } catch (err: any) {
    console.error("Error updating user profile:", err);
    res.status(500).json({ error: "Failed to update user profile" });
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

// 1. AI Chat Route for Contextual Mentor & Career Guide
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { messages, userContext } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required." });
    }

    const userId = req.body.userId || "default-explorer";
    const lastUserMsg = messages[messages.length - 1]?.content || "";

    // Contextual Mentor Persona
    const chosenDirection = userContext?.chosenDirection || "Exploring career paths";
    const currentStage = userContext?.currentStage || "Foundation";
    const completedCount = userContext?.completedTasksCount ?? 0;
    const profileSummary = userContext?.profileSummary || "";
    const strengths = Array.isArray(userContext?.strengths) ? userContext.strengths.join(", ") : "";
    const hesitations = Array.isArray(userContext?.hesitations) ? userContext.hesitations.join(", ") : "";
    const isRegulated = Boolean(userContext?.isRegulatedProfession);
    const userName = userContext?.userName || userContext?.name || "";
    const educationStage = userContext?.educationStage || userContext?.educationLevel || "";
    const fieldOfStudy = userContext?.fieldOfStudy || "";
    const learningStyle = userContext?.learningStyle || "";
    const careerGoal = userContext?.careerGoal || "";

    const systemInstruction = `You are ORBIT's dedicated AI Career & Learning Mentor.
You are NOT a generic search bot or chatbot. You are an experienced, empathetic, highly contextual career guide who understands that deciding a future can feel overwhelming.

Philosophy & Identity:
- Brand: ORBIT (built by ADITYAX / Aetherix).
- Core philosophy: "Everyone is running. But where are you going?"
- Your mission is to help the explorer go from confused to understood, then explore, try, choose, learn, build, and grow.

User Current Context:
${userName ? `- User's Name: ${userName} (speak naturally with them, use their name warmly where appropriate, but do NOT overuse it)` : ""}
${educationStage ? `- Current Background: ${educationStage}${fieldOfStudy ? ` (Field: ${fieldOfStudy})` : ""}` : ""}
${learningStyle ? `- Preferred Learning Style: ${learningStyle}` : ""}
${careerGoal ? `- Primary Career Target: ${careerGoal}` : ""}
- Target Direction: ${chosenDirection} (${isRegulated ? "Regulated Profession with statutory licensing/education requirements" : "Specialized professional & practical pathway"})
- Current Active Stage: ${currentStage}
- Completed Roadmap Milestones: ${completedCount} completed
- Profile Snapshot: ${profileSummary || "Self-directed learner"}
${strengths ? `- Identified Strengths: ${strengths}` : ""}
${hesitations ? `- Reported Hesitations/Avoidances: ${hesitations}` : ""}

Mentor Interaction Rules:
1. Speak with warmth, clarity, and authentic mentorship. Avoid corporate buzzwords, filler phrases ("Certainly!", "As an AI..."), and robotic bullet lists.
2. Be concise by default (1 to 3 short, easy-to-read paragraphs), but deep and insightful when the user asks a complex question.
3. Help the user reflect on their own tendencies and interests rather than prescribing a one-size-fits-all formula.
4. End with at most ONE gentle, thoughtful follow-up question or a single 15-minute micro-step to keep momentum going without overwhelming them.
5. If the user expresses confusion, imposter syndrome, or uncertainty, validate their feeling first and ground them in their next immediate action.
6. If the path is a regulated profession (Medicine, Law, Aviation, Civil Engineering, CPA), clearly distinguish formal academic/licensing checkpoints from self-study tips.
7. ORBIT is a truly field-agnostic platform spanning Healthcare, Business, Design, Law, Sciences, Psychology, Education, Trades, and Technology. NEVER assume or force coding, GitHub, tech jargon, or software tools unless the user's specific field or explicit question is in computing or technology.`;

    // Filter messages for chat
    const chatSequence = messages
      .slice(-10)
      .map((m: any) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: String(m.content || "").trim(),
      }))
      .filter((m) => m.content.length > 0);

    let aiMessage = "";
    try {
      aiMessage = await callAIChat({
        systemPrompt: systemInstruction,
        messages: chatSequence,
        temperature: 0.65,
        maxTokens: 1024,
        timeoutMs: 25000,
      });
    } catch (aiErr: any) {
      console.warn("[AI Chat] Fallback triggered:", aiErr?.message);
      if (lastUserMsg.toLowerCase().includes("stuck") || lastUserMsg.toLowerCase().includes("confus")) {
        aiMessage = `Feeling unsure is completely normal when you're navigating ${chosenDirection}. When everything feels big, zoom in: what is one 15-minute concept or tiny task you could look at today just to see how it feels?`;
      } else if (lastUserMsg.toLowerCase().includes("project") || lastUserMsg.toLowerCase().includes("build")) {
        aiMessage = `The best first projects are tiny, personal, and tangible. For ${chosenDirection}, pick something with just 2 features that solves a small annoyance you face daily. Would you like a beginner idea to spark your thinking?`;
      } else {
        aiMessage = `Looking at your progress in ${chosenDirection} (currently in ${currentStage}), you've already made meaningful moves with ${completedCount} milestones reached. What's the one concept that felt most interesting so far?`;
      }
    }

    // Persist conversation turn in PostgreSQL
    if (lastUserMsg) {
      saveMentorMessage(userId, "user", lastUserMsg, currentStage).catch((e) =>
        console.warn("Could not persist user chat message to DB:", e.message)
      );
    }
    saveMentorMessage(userId, "assistant", aiMessage, currentStage).catch((e) =>
      console.warn("Could not persist AI chat message to DB:", e.message)
    );

    return res.json({ content: aiMessage });
  } catch (error: any) {
    console.error("Error in /api/ai/chat:", error?.message || error);
    return res.json({
      content:
        "I'm right here with you. Take a breath—you don't need to master the whole mountain today. Let's look at your next 15 minutes. What would you like to explore?",
    });
  }
});

// 1b. Dynamic Career Pathway Generator (Supports ANY career goal & regulated professions)
app.post("/api/ai/generate-career-pathway", async (req, res) => {
  try {
    const { careerGoal, profile, userId = "default-explorer" } = req.body;
    if (!careerGoal || typeof careerGoal !== "string" || careerGoal.trim().length === 0) {
      return res.status(400).json({ error: "Career goal is required." });
    }

    const cleanGoal = careerGoal.trim();

    const prompt = `You are ORBIT's career pathways engine.
Create a rich, personalized career roadmap for: "${cleanGoal}".
User Profile: ${JSON.stringify(profile || {}, null, 2)}

Determine if this is a regulated profession (e.g. Medicine, Law, Aviation, Structural Engineering, CPA, Nursing, etc.).
If regulated:
- set "isRegulatedProfession": true
- provide "formalRequirements": {
    "education": ["..."],
    "eligibility": ["..."],
    "entranceExams": ["..."],
    "qualificationsAndLicensing": ["..."],
    "practicalExperience": ["..."],
    "careerProgression": ["..."]
  }
- generate 5-7 realistic stages reflecting the academic, exam, practicum, and licensing checkpoints.

If not regulated (tech, design, entrepreneurship, creative, business):
- set "isRegulatedProfession": false
- generate 6-7 progressive stages (Orientation/Sandbox -> Core Skills -> First Tangible Project -> Problem Solving -> Real-world Flagship Projects -> Portfolio -> Career Launch).

Every stage MUST have:
- "id": "stg-1", etc.
- "stageNumber": number
- "stageKey": short uppercase title (e.g. "ORIENTATION", "FOUNDATION", "FIRST PROJECT", etc.)
- "title": string
- "subtitle": string
- "estimatedTime": string (e.g. "2-4 weeks")
- "whyLearningThis": "Why am I learning this?" (clear plain-English answer)
- "howItHelpsCareer": "How does this help my career?" (direct career benefit)
- "whatComesAfter": "What comes after this?"
- "whatToLearn": ["string"]
- "whyItMatters": "string"
- "whatToPractice": ["string"]
- "whatToBuild": "string"
- "whatSuccessLooksLike": "string"
- "whatToDoNext": "string"
- "tasks": [{ "id": "t-1", "text": "string", "done": false, "category": "string" }]

Output strictly valid JSON only:
{
  "recommendation": {
    "id": "dir-custom",
    "directionName": "string",
    "careerGoal": "${cleanGoal}",
    "tagline": "string",
    "simpleExplanation": "string",
    "whyItFitsYou": "string",
    "dayInTheLife": ["string"],
    "beginnerSkills": ["string"],
    "whatYouCanTryToday": "string",
    "futureOpportunities": ["string"],
    "isRegulatedProfession": boolean,
    "formalRequirements": null or object,
    "challenge": {
      "title": "string",
      "scenario": "string",
      "taskDescription": "string",
      "type": "code" or "logic",
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
  "roadmap": [ ... ],
  "resources": [
    { "id": "res-1", "name": "string", "type": "free", "category": "string", "description": "string", "urlOrNote": "string" }
  ],
  "projects": [
    { "id": "proj-1", "title": "string", "level": "Beginner", "objective": "string", "skillsPracticed": ["string"], "expectedOutput": "string", "difficulty": "string", "suggestedNextStep": "string", "completed": false }
  ]
}`;

    let data: any = null;
    try {
      const rawText = await callAIModel({
        systemPrompt: "You are ORBIT curriculum and career path architect. You produce strictly valid JSON matching the schema.",
        userPrompt: prompt,
        temperature: 0.3,
        maxTokens: 3500,
        timeoutMs: 25000,
      });
      data = extractCleanJson(rawText);
      if (!data?.recommendation || !Array.isArray(data?.roadmap) || data.roadmap.length === 0) {
        throw new Error("Invalid AI generated pathway payload");
      }
    } catch (aiErr: any) {
      console.warn("[AI Career Pathway] Falling back to robust deterministic synthesis:", aiErr?.message);
      data = synthesizeCareerPathwayFallback(cleanGoal, profile);
    }

    // Persist path if requested
    if (data?.recommendation && data?.roadmap) {
      saveSelectedPathAndRoadmap(userId, data.recommendation, data.roadmap).catch((e) =>
        console.warn("Failed to auto-persist pathway to DB:", e.message)
      );
    }

    return res.json(data);
  } catch (error: any) {
    console.error("Critical error in /api/ai/generate-career-pathway:", error?.message || error);
    const fallback = synthesizeCareerPathwayFallback(req.body?.careerGoal || "Career Explorer", req.body?.profile);
    return res.json(fallback);
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
ORBIT is a truly field-agnostic platform spanning Healthcare, Business, Design, Law, Psychology, Education, Media & Journalism, Sciences, Skilled Crafts, and Technology.
Analyze the student's authentic answers:
${JSON.stringify(answers, null, 2)}

GUIDELINES:
- Recommend 3 diverse, genuinely fitting directions that reflect their actual interests.
- If they prefer working with people or helping, suggest Psychology, Healthcare, Education, or People Operations.
- If they enjoy writing, storytelling, or analysis, suggest Journalism, Content Strategy, or Policy.
- If they enjoy visual aesthetics and layout, suggest UI/UX or Brand Design.
- If they enjoy numbers and strategy, suggest Finance, Product Strategy, or Operations.
- Only suggest coding/software engineering if their answers explicitly state an appetite for computer programming.
- DO NOT default to tech or AI careers unless requested.

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
        "type": "logic" or "code",
        "starterTemplate": "string (optional, only include if type is code)",
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
        timeoutMs: 25000,
      });
      data = extractCleanJson(rawText);
      if (!data?.profile || !Array.isArray(data?.recommendations) || data.recommendations.length === 0) {
        throw new Error("Missing required profile or recommendations array");
      }
    } catch (err: any) {
      console.warn("[AI Recommendations] Using dynamic tailored fallback:", err?.message);
      data = synthesizeRecommendationsFallback(answers);
    }

    // Persist to PostgreSQL deterministically
    const userId = req.body.userId || "default-explorer";
    try {
      await saveOnboardingData(userId, answers, data.profile, data.recommendations);
    } catch (e: any) {
      console.warn("Could not persist onboarding data to PostgreSQL:", e?.message || e);
    }

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

IMPORTANT: Match all curriculum, resources, practical tasks, and projects directly to the real professional domain of "${direction.directionName}" (e.g. Design, Healthcare, Law, Business, Finance, Media, Education, or Technology). Do NOT prescribe coding or software developer tools unless "${direction.directionName}" is genuinely a software/tech role.

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
        timeoutMs: 25000,
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
        timeoutMs: 20000,
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
  // Determine production mode: explicit NODE_ENV=production, Render environment, or running as bundled .cjs
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.RENDER === "true" ||
    Boolean(process.env.RENDER_SERVICE_ID) ||
    Boolean(process.env.RENDER_INSTANCE_ID) ||
    (typeof __filename !== "undefined" && __filename.endsWith(".cjs")) ||
    (!process.env.NODE_ENV && fs.existsSync(path.join(process.cwd(), "dist", "index.html")));

  // Initialize PostgreSQL and run all migrations
  try {
    const dbStatus = await initDatabase();
    console.log(`[ORBIT Database] Database ready (${dbStatus.engine}). Tables: ${dbStatus.tables.length}`);
  } catch (err: any) {
    console.error("[ORBIT Database] Startup error:", err.message);
  }

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
