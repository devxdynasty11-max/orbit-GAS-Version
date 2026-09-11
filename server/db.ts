import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';

export interface DbStatus {
  connected: boolean;
  engine: 'remote_postgres' | 'embedded_postgres';
  host?: string;
  database?: string;
  tables: string[];
  isPlaceholderPassword?: boolean;
  message: string;
}

let pgPool: Pool | null = null;
let pgliteDb: PGlite | null = null;
let activeEngine: 'remote_postgres' | 'embedded_postgres' = 'embedded_postgres';
let dbInitialized = false;

// Migration SQL statements for PostgreSQL
const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS onboarding_responses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  education_stage TEXT,
  free_time_activities JSONB,
  disliked_tasks JSONB,
  problem_solving_style TEXT,
  work_environment TEXT,
  priorities JSONB,
  current_skill_level TEXT,
  freeform_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  natural_strengths JSONB NOT NULL,
  work_style TEXT NOT NULL,
  motivation TEXT NOT NULL,
  things_to_avoid JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction_name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  simple_explanation TEXT NOT NULL,
  why_it_fits_you TEXT NOT NULL,
  day_in_the_life JSONB NOT NULL,
  beginner_skills JSONB NOT NULL,
  future_opportunities JSONB NOT NULL,
  challenge JSONB NOT NULL,
  comparison JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS selected_paths (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_id TEXT,
  direction_name TEXT NOT NULL,
  tagline TEXT,
  selected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roadmaps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction_name TEXT NOT NULL,
  stage_number INT NOT NULL,
  stage_key TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  what_to_learn JSONB NOT NULL,
  why_it_matters TEXT NOT NULL,
  what_to_practice JSONB NOT NULL,
  what_to_build TEXT NOT NULL,
  what_success_looks_like TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roadmap_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  roadmap_id TEXT REFERENCES roadmaps(id) ON DELETE CASCADE,
  stage_number INT NOT NULL,
  task_text TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  level TEXT NOT NULL,
  objective TEXT NOT NULL,
  skills_practiced JSONB NOT NULL,
  expected_output TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS progress_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenge_reflections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_id TEXT NOT NULL,
  user_submission TEXT NOT NULL,
  enjoyed TEXT NOT NULL,
  easy TEXT NOT NULL,
  frustrating TEXT NOT NULL,
  ai_feedback TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_mentor_context (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  stage_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journey_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_number INT NOT NULL DEFAULT 1,
  direction_name TEXT NOT NULL,
  tagline TEXT,
  headline TEXT,
  profile JSONB,
  recommendations JSONB,
  selected_direction JSONB,
  roadmap JSONB,
  completed_task_ids JSONB,
  completed_project_ids JSONB,
  completed_tasks_count INT DEFAULT 0,
  total_tasks_count INT DEFAULT 0,
  completed_projects_count INT DEFAULT 0,
  reflections JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ DEFAULT NOW()
);
`;

/**
 * Execute raw SQL query across active PostgreSQL provider
 */
export async function dbQuery<T = any>(text: string, params: any[] = []): Promise<T[]> {
  await ensureDbReady();

  if (activeEngine === 'remote_postgres' && pgPool) {
    const res = await pgPool.query(text, params);
    return res.rows;
  } else if (pgliteDb) {
    const res = await pgliteDb.query(text, params);
    return res.rows as T[];
  }
  throw new Error('No active database engine initialized');
}

/**
 * Initialize Database and run all migrations
 */
export async function initDatabase(): Promise<DbStatus> {
  if (dbInitialized) {
    return getDbStatus();
  }

  const dbUrl = process.env.DATABASE_URL;
  let hasValidRemoteUrl = false;
  let isPlaceholderPassword = false;

  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      const decodedPassword = decodeURIComponent(parsed.password || '');
      if (
        decodedPassword.includes('YOUR-PASSWORD') ||
        decodedPassword === '' ||
        decodedPassword === '[YOUR-PASSWORD]'
      ) {
        isPlaceholderPassword = true;
      } else {
        hasValidRemoteUrl = true;
      }
    } catch {
      // invalid URL format
    }
  }

  // Attempt remote PostgreSQL connection if valid credentials are found
  if (hasValidRemoteUrl && dbUrl) {
    try {
      console.log('Testing remote PostgreSQL connection via DATABASE_URL...');
      const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
      });

      // Quick ping test
      await pool.query('SELECT 1 as test');
      pgPool = pool;
      activeEngine = 'remote_postgres';
      console.log('Connected to remote PostgreSQL successfully!');

      // Run migrations on remote PostgreSQL
      await pgPool.query(MIGRATION_SQL);
      console.log('All migrations applied successfully to remote PostgreSQL!');

      dbInitialized = true;
      return getDbStatus();
    } catch (err: any) {
      console.warn('Remote PostgreSQL connection failed, switching to embedded PostgreSQL engine:', err.message);
    }
  }

  // Fallback to embedded PostgreSQL (PGlite)
  try {
    const dataDir = path.join(process.cwd(), 'data', 'orbit_pg');
    fs.mkdirSync(path.dirname(dataDir), { recursive: true });

    pgliteDb = new PGlite(dataDir);
    activeEngine = 'embedded_postgres';
    console.log('Initialized local embedded PostgreSQL engine at:', dataDir);

    // Run migrations on embedded PostgreSQL
    await pgliteDb.exec(MIGRATION_SQL);
    console.log('All migrations applied successfully to embedded PostgreSQL engine!');

    dbInitialized = true;
    return getDbStatus();
  } catch (err: any) {
    console.warn('Persistent PGlite failed, falling back to in-memory PGlite:', err?.message || err);
    try {
      pgliteDb = new PGlite();
      activeEngine = 'embedded_postgres';
      await pgliteDb.exec(MIGRATION_SQL);
      console.log('All migrations applied successfully to in-memory PostgreSQL engine!');
      dbInitialized = true;
      return getDbStatus();
    } catch (inMemErr: any) {
      console.error('Failed to initialize embedded PostgreSQL engine:', inMemErr);
      throw inMemErr;
    }
  }
}

async function ensureDbReady() {
  if (!dbInitialized) {
    await initDatabase();
  }
}

/**
 * Return current connection status & table statistics
 */
export async function getDbStatus(): Promise<DbStatus> {
  try {
    let tables: string[] = [];

    if (activeEngine === 'remote_postgres' && pgPool) {
      const res = await pgPool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
      );
      tables = res.rows.map((r: any) => r.table_name);
      const url = new URL(process.env.DATABASE_URL || '');

      return {
        connected: true,
        engine: 'remote_postgres',
        host: url.hostname,
        database: url.pathname.replace('/', '') || 'postgres',
        tables,
        isPlaceholderPassword: false,
        message: 'Connected to remote PostgreSQL database. All schemas and tables verified.',
      };
    } else if (pgliteDb) {
      const res = await pgliteDb.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
      );
      tables = (res.rows as any[]).map(r => r.table_name);

      const isPlaceholder =
        process.env.DATABASE_URL?.includes('YOUR-PASSWORD') ||
        process.env.DATABASE_URL?.includes('%5BYOUR-PASSWORD%5D') ||
        false;

      return {
        connected: true,
        engine: 'embedded_postgres',
        database: 'orbit_pg (PostgreSQL)',
        tables,
        isPlaceholderPassword: isPlaceholder,
        message: isPlaceholder
          ? 'PostgreSQL active with embedded instance. Update [YOUR-PASSWORD] in DATABASE_URL anytime to route to remote Supabase.'
          : 'PostgreSQL active and operational. All tables and migrations are ready.',
      };
    }
  } catch (err: any) {
    return {
      connected: false,
      engine: activeEngine,
      tables: [],
      message: `Database error: ${err.message}`,
    };
  }

  return {
    connected: false,
    engine: activeEngine,
    tables: [],
    message: 'Database not initialized',
  };
}

/**
 * Ensure user record exists
 */
export async function ensureUser(userId: string, name?: string, email?: string) {
  await dbQuery(
    `INSERT INTO users (id, name, email) 
     VALUES ($1, $2, $3) 
     ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
    [userId, name || 'Explorer', email || null]
  );
}

/**
 * Save complete onboarding responses and AI generated recommendations
 */
export async function saveOnboardingData(
  userId: string,
  answers: any,
  profile: any,
  recommendations: any[]
) {
  await ensureUser(userId);

  // 1. Save onboarding responses
  const respId = `resp-${Date.now()}`;
  await dbQuery(
    `INSERT INTO onboarding_responses (
      id, user_id, education_stage, free_time_activities, disliked_tasks,
      problem_solving_style, work_environment, priorities, current_skill_level, freeform_notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      respId,
      userId,
      answers.educationStage || '',
      JSON.stringify(answers.freeTimeActivities || []),
      JSON.stringify(answers.dislikedTasks || []),
      answers.problemSolvingStyle || '',
      answers.workEnvironment || '',
      JSON.stringify(answers.priorities || []),
      answers.currentSkillLevel || '',
      answers.freeformNotes || null,
    ]
  );

  // 2. Save structured AI profile
  if (profile) {
    const profId = `prof-${Date.now()}`;
    await dbQuery(
      `INSERT INTO ai_profiles (
        id, user_id, headline, summary, natural_strengths, work_style, motivation, things_to_avoid
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        profId,
        userId,
        profile.headline || 'Career Explorer',
        profile.summary || 'Profile generated based on honest exploration',
        JSON.stringify(profile.naturalStrengths || []),
        profile.workStyle || 'Independent & Thoughtful',
        profile.motivation || 'Curiosity and creative freedom',
        JSON.stringify(profile.thingsToAvoid || []),
      ]
    );
  }

  // 3. Save recommendations
  if (Array.isArray(recommendations)) {
    // Clear previous recommendations for this user to keep exactly 3 current
    await dbQuery('DELETE FROM recommendations WHERE user_id = $1', [userId]);

    for (const rec of recommendations) {
      await dbQuery(
        `INSERT INTO recommendations (
          id, user_id, direction_name, tagline, simple_explanation, why_it_fits_you,
          day_in_the_life, beginner_skills, future_opportunities, challenge, comparison
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          rec.id || `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          userId,
          rec.directionName || 'Career Direction',
          rec.tagline || 'Explore what fits you best',
          rec.simpleExplanation || '',
          rec.whyItFitsYou || '',
          JSON.stringify(rec.dayInTheLife || []),
          JSON.stringify(rec.beginnerSkills || []),
          JSON.stringify(rec.futureOpportunities || []),
          JSON.stringify(rec.challenge || {}),
          JSON.stringify(rec.comparison || {}),
        ]
      );
    }
  }

  // Log activity
  await logProgress(userId, 'onboarding_completed', 'Completed conversational onboarding and generated 3 paths');
}

/**
 * Save selected direction and roadmap stages
 */
export async function saveSelectedPathAndRoadmap(
  userId: string,
  recommendation: any,
  roadmapStages: any[]
) {
  await ensureUser(userId);

  // 1. Insert selected path
  const pathId = `sel-${Date.now()}`;
  await dbQuery(
    `INSERT INTO selected_paths (id, user_id, recommendation_id, direction_name, tagline)
     VALUES ($1, $2, $3, $4, $5)`,
    [pathId, userId, recommendation.id || null, recommendation.directionName, recommendation.tagline || '']
  );

  // 2. Clear previous roadmap and tasks for this user
  await dbQuery('DELETE FROM roadmaps WHERE user_id = $1', [userId]);
  await dbQuery('DELETE FROM roadmap_tasks WHERE user_id = $1', [userId]);

  // 3. Insert roadmap stages and tasks
  for (const stg of roadmapStages) {
    const stageId = `stg-${userId}-${stg.stageNumber}`;
    await dbQuery(
      `INSERT INTO roadmaps (
        id, user_id, direction_name, stage_number, stage_key, title, subtitle,
        what_to_learn, why_it_matters, what_to_practice, what_to_build, what_success_looks_like
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        stageId,
        userId,
        recommendation.directionName,
        stg.stageNumber,
        stg.stageKey,
        stg.title,
        stg.subtitle || '',
        JSON.stringify(stg.whatToLearn || []),
        stg.whyItMatters || '',
        JSON.stringify(stg.whatToPractice || []),
        stg.whatToBuild || '',
        stg.whatSuccessLooksLike || '',
      ]
    );

    if (Array.isArray(stg.tasks)) {
      for (const t of stg.tasks) {
        await dbQuery(
          `INSERT INTO roadmap_tasks (id, user_id, roadmap_id, stage_number, task_text, is_completed)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [t.id, userId, stageId, stg.stageNumber, t.text, false]
        );
      }
    }
  }

  // Log activity
  await logProgress(userId, 'direction_selected', `Selected career direction: ${recommendation.directionName}`);
}

/**
 * Toggle task completion status
 */
export async function toggleTaskInDb(userId: string, taskId: string, isCompleted: boolean) {
  await dbQuery(
    `UPDATE roadmap_tasks 
     SET is_completed = $1, completed_at = CASE WHEN $1 = TRUE THEN NOW() ELSE NULL END
     WHERE id = $2 AND user_id = $3`,
    [isCompleted, taskId, userId]
  );

  const taskRows = await dbQuery('SELECT task_text FROM roadmap_tasks WHERE id = $1', [taskId]);
  const taskName = taskRows[0]?.task_text || taskId;

  await logProgress(
    userId,
    isCompleted ? 'task_completed' : 'task_uncompleted',
    `${isCompleted ? 'Completed' : 'Reopened'} roadmap task: "${taskName}"`
  );
}

/**
 * Toggle project completion status
 */
export async function toggleProjectInDb(userId: string, projectId: string, isCompleted: boolean) {
  // Upsert project record
  await dbQuery(
    `INSERT INTO projects (id, user_id, title, level, objective, skills_practiced, expected_output, difficulty, is_completed, completed_at)
     VALUES ($1, $2, $3, 'Custom', '', '[]'::jsonb, '', '', $4, CASE WHEN $4 = TRUE THEN NOW() ELSE NULL END)
     ON CONFLICT (id) DO UPDATE 
     SET is_completed = $4, completed_at = CASE WHEN $4 = TRUE THEN NOW() ELSE NULL END`,
    [projectId, userId, projectId, isCompleted]
  );

  await logProgress(
    userId,
    isCompleted ? 'project_completed' : 'project_uncompleted',
    `${isCompleted ? 'Finished build milestone' : 'Reset project'}: ${projectId}`
  );
}

/**
 * Save practical challenge reflection
 */
export async function saveChallengeReflection(
  userId: string,
  recommendationId: string,
  data: {
    userSubmission: string;
    enjoyed: string;
    easy: string;
    frustrating: string;
    aiFeedback: string;
  }
) {
  await ensureUser(userId);
  const id = `ref-${Date.now()}`;
  await dbQuery(
    `INSERT INTO challenge_reflections (
      id, user_id, recommendation_id, user_submission, enjoyed, easy, frustrating, ai_feedback
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, userId, recommendationId, data.userSubmission, data.enjoyed, data.easy, data.frustrating, data.aiFeedback]
  );

  await logProgress(userId, 'challenge_completed', `Completed practical mini-challenge for ${recommendationId}`);
}

/**
 * Save AI Mentor conversation turn
 */
export async function saveMentorMessage(
  userId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  stageContext?: string
) {
  await ensureUser(userId);
  const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await dbQuery(
    `INSERT INTO ai_mentor_context (id, user_id, role, content, stage_context)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, role, content, stageContext || null]
  );
}

/**
 * Fetch recent chat history from PostgreSQL
 */
export async function getMentorHistory(userId: string, limit: number = 20) {
  await ensureDbReady();
  const rows = await dbQuery(
    `SELECT id, role, content, stage_context, created_at 
     FROM ai_mentor_context 
     WHERE user_id = $1 
     ORDER BY created_at ASC 
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

/**
 * Record a progress event in the database
 */
export async function logProgress(userId: string, eventType: string, description: string, metadata: any = {}) {
  await ensureUser(userId);
  const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await dbQuery(
    `INSERT INTO progress_logs (id, user_id, event_type, description, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, eventType, description, JSON.stringify(metadata)]
  );
}

/**
 * Load full persistent state for a user from PostgreSQL
 */
export async function loadFullUserState(userId: string) {
  await ensureDbReady();
  await ensureUser(userId);

  // 1. Profile
  const profileRows = await dbQuery(
    `SELECT * FROM ai_profiles WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  let profile = null;
  if (profileRows[0]) {
    const p = profileRows[0];
    profile = {
      headline: p.headline,
      summary: p.summary,
      naturalStrengths: typeof p.natural_strengths === 'string' ? JSON.parse(p.natural_strengths) : p.natural_strengths,
      workStyle: p.work_style,
      motivation: p.motivation,
      thingsToAvoid: typeof p.things_to_avoid === 'string' ? JSON.parse(p.things_to_avoid) : p.things_to_avoid,
    };
  }

  // 2. Recommendations
  const recRows = await dbQuery(
    `SELECT * FROM recommendations WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  const recommendations = recRows.map((r: any) => ({
    id: r.id,
    directionName: r.direction_name,
    tagline: r.tagline,
    simpleExplanation: r.simple_explanation,
    whyItFitsYou: r.why_it_fits_you,
    dayInTheLife: typeof r.day_in_the_life === 'string' ? JSON.parse(r.day_in_the_life) : r.day_in_the_life,
    beginnerSkills: typeof r.beginner_skills === 'string' ? JSON.parse(r.beginner_skills) : r.beginner_skills,
    futureOpportunities: typeof r.future_opportunities === 'string' ? JSON.parse(r.future_opportunities) : r.future_opportunities,
    challenge: typeof r.challenge === 'string' ? JSON.parse(r.challenge) : r.challenge,
    comparison: typeof r.comparison === 'string' ? JSON.parse(r.comparison) : r.comparison,
  }));

  // 3. Selected path
  const pathRows = await dbQuery(
    `SELECT * FROM selected_paths WHERE user_id = $1 ORDER BY selected_at DESC LIMIT 1`,
    [userId]
  );
  let selectedDirection = null;
  if (pathRows[0]) {
    const p = pathRows[0];
    selectedDirection = recommendations.find(r => r.id === p.recommendation_id) || {
      id: p.recommendation_id || 'custom-path',
      directionName: p.direction_name,
      tagline: p.tagline,
    };
  }

  // 4. Roadmap & Tasks
  const roadmapRows = await dbQuery(
    `SELECT * FROM roadmaps WHERE user_id = $1 ORDER BY stage_number ASC`,
    [userId]
  );
  const taskRows = await dbQuery(
    `SELECT * FROM roadmap_tasks WHERE user_id = $1`,
    [userId]
  );

  const completedTaskIds = taskRows.filter((t: any) => t.is_completed).map((t: any) => t.id);

  const roadmap = roadmapRows.map((stg: any) => ({
    id: stg.id,
    stageNumber: stg.stage_number,
    stageKey: stg.stage_key,
    title: stg.title,
    subtitle: stg.subtitle,
    whatToLearn: typeof stg.what_to_learn === 'string' ? JSON.parse(stg.what_to_learn) : stg.what_to_learn,
    whyItMatters: stg.why_it_matters,
    whatToPractice: typeof stg.what_to_practice === 'string' ? JSON.parse(stg.what_to_practice) : stg.what_to_practice,
    whatToBuild: stg.what_to_build,
    whatSuccessLooksLike: stg.what_success_looks_like,
    tasks: taskRows
      .filter((t: any) => t.stage_number === stg.stage_number)
      .map((t: any) => ({ id: t.id, text: t.task_text })),
  }));

  // 5. Projects
  const projectRows = await dbQuery(
    `SELECT * FROM projects WHERE user_id = $1 AND is_completed = TRUE`,
    [userId]
  );
  const completedProjectIds = projectRows.map((p: any) => p.id);

  // 6. Challenge reflections
  const reflections = await dbQuery(
    `SELECT * FROM challenge_reflections WHERE user_id = $1`,
    [userId]
  );
  const completedChallengeIds = Array.from(new Set(reflections.map((r: any) => r.recommendation_id)));
  const challengeReflections: Record<string, any> = {};
  reflections.forEach((r: any) => {
    challengeReflections[r.recommendation_id] = {
      submission: r.user_submission,
      enjoyed: r.enjoyed,
      easy: r.easy,
      frustrating: r.frustrating,
      wouldPursue: r.would_pursue,
    };
  });

  // 7. Recent activity logs
  const activityRows = await dbQuery(
    `SELECT id, description as text, to_char(created_at, 'HH12:MI AM') as timestamp 
     FROM progress_logs 
     WHERE user_id = $1 
     ORDER BY created_at DESC 
     LIMIT 15`,
    [userId]
  );

  // 8. Safely preserved Journey History
  const journeyHistory = await getJourneyHistory(userId);
  const sessionNumber = journeyHistory.length + 1;

  return {
    onboardingCompleted: !!profile,
    sessionNumber,
    profile,
    recommendations,
    selectedDirectionId: selectedDirection?.id || null,
    selectedDirection,
    completedChallengeIds,
    challengeReflections,
    roadmap,
    completedTaskIds,
    completedProjectIds,
    recentActivities: activityRows,
    journeyHistory,
  };
}

/**
 * Fetch safely preserved journey archives from PostgreSQL
 */
export async function getJourneyHistory(userId: string) {
  await ensureDbReady();
  await ensureUser(userId);
  const rows = await dbQuery(
    `SELECT id, session_number as "sessionNumber", direction_name as "directionName",
            tagline, headline, profile, recommendations, selected_direction as "selectedDirection",
            roadmap, completed_task_ids as "completedTaskIds", completed_project_ids as "completedProjectIds",
            completed_tasks_count as "completedTasksCount", total_tasks_count as "totalTasksCount",
            completed_projects_count as "completedProjectsCount", reflections,
            to_char(archived_at, 'Mon DD, YYYY') as "formattedDate", archived_at as "archivedAt"
     FROM journey_history
     WHERE user_id = $1
     ORDER BY session_number DESC`,
    [userId]
  );
  return rows.map((r: any) => ({
    ...r,
    profile: typeof r.profile === 'string' ? JSON.parse(r.profile) : r.profile,
    recommendations: typeof r.recommendations === 'string' ? JSON.parse(r.recommendations) : r.recommendations,
    selectedDirection: typeof r.selectedDirection === 'string' ? JSON.parse(r.selectedDirection) : r.selectedDirection,
    roadmap: typeof r.roadmap === 'string' ? JSON.parse(r.roadmap) : r.roadmap,
    completedTaskIds: typeof r.completedTaskIds === 'string' ? JSON.parse(r.completedTaskIds) : r.completedTaskIds,
    completedProjectIds: typeof r.completedProjectIds === 'string' ? JSON.parse(r.completedProjectIds) : r.completedProjectIds,
    reflections: typeof r.reflections === 'string' ? JSON.parse(r.reflections) : r.reflections,
  }));
}

/**
 * Execute Start Fresh:
 * - Safely archives current journey to journey_history with timestamps & completed metrics
 * - Preserves user account, completed projects log, and activity history
 * - Clears active session so user begins fresh discovery with zero bias
 */
export async function startFreshJourney(userId: string) {
  await ensureDbReady();
  await ensureUser(userId);

  // 1. Fetch current active state to archive
  const currentState = await loadFullUserState(userId);

  const existingJourneys = await dbQuery(
    `SELECT COUNT(*) as count FROM journey_history WHERE user_id = $1`,
    [userId]
  );
  const sessionNumber = parseInt(existingJourneys[0]?.count || '0', 10) + 1;

  let archivedJourney: any = null;

  // If user completed onboarding or picked a direction, safely preserve it in history
  if (currentState.onboardingCompleted || currentState.selectedDirection) {
    const archiveId = `journey-${Date.now()}-${sessionNumber}`;
    const allTasks = currentState.roadmap?.flatMap((s: any) => s.tasks || []) || [];
    const completedTasksCount = currentState.completedTaskIds?.length || 0;
    const completedProjectsCount = currentState.completedProjectIds?.length || 0;

    const dirName =
      currentState.selectedDirection?.directionName ||
      currentState.profile?.headline ||
      'Exploration Session';

    await dbQuery(
      `INSERT INTO journey_history (
        id, user_id, session_number, direction_name, tagline, headline,
        profile, recommendations, selected_direction, roadmap,
        completed_task_ids, completed_project_ids, completed_tasks_count,
        total_tasks_count, completed_projects_count, reflections, archived_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())`,
      [
        archiveId,
        userId,
        sessionNumber,
        dirName,
        currentState.selectedDirection?.tagline || '',
        currentState.profile?.headline || 'Explorer Profile',
        JSON.stringify(currentState.profile || {}),
        JSON.stringify(currentState.recommendations || []),
        JSON.stringify(currentState.selectedDirection || {}),
        JSON.stringify(currentState.roadmap || []),
        JSON.stringify(currentState.completedTaskIds || []),
        JSON.stringify(currentState.completedProjectIds || []),
        completedTasksCount,
        allTasks.length,
        completedProjectsCount,
        JSON.stringify(currentState.challengeReflections || {}),
      ]
    );

    archivedJourney = {
      id: archiveId,
      sessionNumber,
      directionName: dirName,
      headline: currentState.profile?.headline || 'Explorer Profile',
      completedTasksCount,
      totalTasksCount: allTasks.length,
      completedProjectsCount,
      archivedAt: new Date().toISOString(),
      formattedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };
  }

  // 2. Clear current active state from tables WITHOUT deleting the user or history
  await dbQuery('DELETE FROM selected_paths WHERE user_id = $1', [userId]);
  await dbQuery('DELETE FROM roadmap_tasks WHERE user_id = $1', [userId]);
  await dbQuery('DELETE FROM roadmaps WHERE user_id = $1', [userId]);
  await dbQuery('DELETE FROM recommendations WHERE user_id = $1', [userId]);
  await dbQuery('DELETE FROM ai_profiles WHERE user_id = $1', [userId]);

  // Tag mentor context with a reset notice so the AI looks with fresh eyes
  await dbQuery(
    `INSERT INTO ai_mentor_context (id, user_id, role, content, stage_context)
     VALUES ($1, $2, 'system', 'User started fresh for Journey #${sessionNumber + 1}. Treat new answers as primary context with zero bias from old choices.', 'start_fresh')`,
    [`sys-${Date.now()}`, userId]
  );

  // 3. Log progress
  await logProgress(
    userId,
    'started_fresh',
    `Started fresh discovery journey #${sessionNumber + 1}. Previous journey safely preserved in history.`
  );

  const updatedHistory = await getJourneyHistory(userId);

  return {
    success: true,
    newSessionNumber: sessionNumber + 1,
    archivedJourney,
    journeyHistory: updatedHistory,
  };
}
