import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Pool } from 'pg';

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
let pgliteDb: any = null;
let activeEngine: 'remote_postgres' | 'embedded_postgres' = 'remote_postgres';
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

-- Backward-compatible schema extensions for user profile & interactive onboarding
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_range TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS education_level TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS field_of_study TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_level TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS target_goal TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS learning_style TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_draft JSONB;

ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS age_range TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS field_of_study TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS existing_skills JSONB;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS curious_topics JSONB;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS career_goal TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS learning_style TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS experience_level TEXT;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_key TEXT;

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
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
 * Detect production environment (e.g. Render, Cloud deployment, or bundled .cjs)
 */
export function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.RENDER === 'true' ||
    Boolean(process.env.RENDER_SERVICE_ID) ||
    Boolean(process.env.RENDER_INSTANCE_ID) ||
    (typeof __filename !== 'undefined' && __filename.endsWith('.cjs'))
  );
}

/**
 * Safely sanitize and normalize DATABASE_URL without trailing quotes or spaces
 */
export function cleanDatabaseUrl(raw?: string): string {
  if (!raw) return '';
  let url = raw.trim();
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1).trim();
  }
  return url;
}

/**
 * Check if connection string contains unconfigured placeholder tokens
 */
export function isPlaceholderDatabaseUrl(url: string): boolean {
  if (!url) return true;
  return (
    url.includes('YOUR-PASSWORD') ||
    url.includes('[YOUR-PASSWORD]') ||
    url.includes('%5BYOUR-PASSWORD%5D') ||
    url.includes('<YOUR-PASSWORD>') ||
    url.toLowerCase().includes('your-password')
  );
}

/**
 * Initialize Database and run all migrations
 */
export async function initDatabase(): Promise<DbStatus> {
  if (dbInitialized) {
    return getDbStatus();
  }

  const rawUrl = process.env.DATABASE_URL;
  const dbUrl = cleanDatabaseUrl(rawUrl);

  // 1. If remote DATABASE_URL is provided, attempt connection
  if (dbUrl && !isPlaceholderDatabaseUrl(dbUrl)) {
    try {
      console.log('[ORBIT Database] Testing remote PostgreSQL connection via DATABASE_URL...');
      const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 8000,
      });

      await pool.query('SELECT 1 as test');
      pgPool = pool;
      activeEngine = 'remote_postgres';
      console.log('[ORBIT Database] Connected to remote PostgreSQL successfully!');

      await pgPool.query(MIGRATION_SQL);
      console.log('[ORBIT Database] Migrations applied successfully to remote PostgreSQL!');

      dbInitialized = true;
      return getDbStatus();
    } catch (err: any) {
      console.warn('[ORBIT Database] Remote PostgreSQL connection failed, falling back to embedded PostgreSQL:', err.message);
    }
  }

  // 2. Embedded PostgreSQL engine (PGlite) with filesystem or in-memory fallback
  try {
    const { PGlite } = await import('@electric-sql/pglite');
    const dataDir = path.join(process.cwd(), 'data', 'orbit_pg');
    fs.mkdirSync(path.dirname(dataDir), { recursive: true });

    let instance: any = null;
    try {
      instance = new PGlite(dataDir);
      await instance.waitReady;
    } catch (persistentErr: any) {
      console.warn('[ORBIT Database] Clearing stale PGlite directory and re-initializing at:', dataDir);
      try {
        if (instance && typeof instance.close === 'function') {
          await instance.close().catch(() => {});
        }
      } catch {}
      fs.rmSync(dataDir, { recursive: true, force: true });
      fs.mkdirSync(dataDir, { recursive: true });
      instance = new PGlite(dataDir);
      await instance.waitReady;
    }

    pgliteDb = instance;
    activeEngine = 'embedded_postgres';
    console.log('[ORBIT Database] Initialized embedded PostgreSQL engine at:', dataDir);

    await pgliteDb.exec(MIGRATION_SQL);
    console.log('[ORBIT Database] All migrations applied successfully to embedded PostgreSQL engine!');

    dbInitialized = true;
    return getDbStatus();
  } catch (err: any) {
    console.warn('[ORBIT Database] Using in-memory PostgreSQL engine:', err?.message || err);
    try {
      const { PGlite } = await import('@electric-sql/pglite');
      pgliteDb = new PGlite();
      await pgliteDb.waitReady;
      activeEngine = 'embedded_postgres';
      await pgliteDb.exec(MIGRATION_SQL);
      console.log('[ORBIT Database] Migrations applied to in-memory PostgreSQL engine!');
      dbInitialized = true;
      return getDbStatus();
    } catch (inMemErr: any) {
      console.error('[ORBIT Database] Could not initialize in-memory database:', inMemErr?.message || inMemErr);
      return {
        connected: false,
        engine: activeEngine,
        tables: [],
        message: 'Database initialization failed; using fallback mode',
      };
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

      let host = 'remote-postgres';
      let database = 'postgres';
      try {
        const cleanUrl = cleanDatabaseUrl(process.env.DATABASE_URL);
        if (cleanUrl) {
          const url = new URL(cleanUrl);
          host = url.hostname;
          database = url.pathname.replace('/', '') || 'postgres';
        }
      } catch {
        // Keep safe defaults if URL cannot be parsed
      }

      return {
        connected: true,
        engine: 'remote_postgres',
        host,
        database,
        tables,
        isPlaceholderPassword: false,
        message: 'Connected to remote PostgreSQL database. All schemas and tables verified.',
      };
    } else if (pgliteDb) {
      const res = await pgliteDb.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
      );
      tables = (res.rows as any[]).map(r => r.table_name);

      const isPlaceholder = isPlaceholderDatabaseUrl(cleanDatabaseUrl(process.env.DATABASE_URL));

      return {
        connected: true,
        engine: 'embedded_postgres',
        database: 'orbit_pg (Local Dev)',
        tables,
        isPlaceholderPassword: isPlaceholder,
        message: isPlaceholder
          ? 'PostgreSQL active with embedded local dev instance. Update DATABASE_URL with your Supabase credentials to use remote PostgreSQL.'
          : 'Local development PostgreSQL active and operational.',
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
export async function ensureUser(userId: string, name?: string, email?: string, accountKey?: string) {
  const fallbackName = name && name.trim() ? name.trim() : 'Explorer';
  await dbQuery(
    `INSERT INTO users (id, name, full_name, email, account_key) 
     VALUES ($1, $2, $2, $3, $4) 
     ON CONFLICT (id) DO UPDATE SET 
       name = COALESCE(NULLIF($2, ''), users.name),
       full_name = COALESCE(NULLIF($2, ''), users.full_name, users.name),
       email = COALESCE(NULLIF($3, ''), users.email),
       account_key = COALESCE(NULLIF($4, ''), users.account_key),
       updated_at = NOW()`,
    [userId, fallbackName, email || null, accountKey || null]
  );
}

/**
 * Create a new unique user with cryptographically random ID and account secret key
 */
export async function createUniqueUser(name?: string, email?: string): Promise<{ userId: string; accountKey: string }> {
  await ensureDbReady();
  const userId = 'usr_' + crypto.randomBytes(12).toString('hex');
  const accountKey = 'key_' + crypto.randomBytes(16).toString('hex');
  await ensureUser(userId, name, email, accountKey);
  return { userId, accountKey };
}

/**
 * Create a new session token for a user
 */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  await ensureDbReady();
  const token = 'orbit_tok_' + crypto.randomBytes(32).toString('hex');
  const sessionId = 'sess_' + crypto.randomBytes(12).toString('hex');
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

  await dbQuery(
    `INSERT INTO user_sessions (id, user_id, token, created_at, last_active_at, expires_at)
     VALUES ($1, $2, $3, NOW(), NOW(), $4)`,
    [sessionId, userId, token, expiresAt]
  );
  return { token, expiresAt };
}

/**
 * Validate session token and return user info if valid and active
 */
export async function validateSession(token: string): Promise<{ userId: string; user: any } | null> {
  if (!token || typeof token !== 'string') return null;
  await ensureDbReady();
  const clean = token.trim();
  if (!clean) return null;

  const rows = await dbQuery(
    `SELECT s.user_id, s.expires_at, u.id, u.name, u.full_name, u.email, u.account_key
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()
     LIMIT 1`,
    [clean]
  );
  if (!rows || rows.length === 0) return null;

  // Non-blocking update of last_active_at
  dbQuery('UPDATE user_sessions SET last_active_at = NOW() WHERE token = $1', [clean]).catch(() => {});

  return {
    userId: rows[0].user_id,
    user: rows[0],
  };
}

/**
 * Revoke/delete a session token (on logout)
 */
export async function revokeSession(token: string): Promise<void> {
  if (!token || typeof token !== 'string') return;
  await ensureDbReady();
  await dbQuery('DELETE FROM user_sessions WHERE token = $1', [token.trim()]);
}

/**
 * Authenticate with exact Account Key or Private Account ID
 */
export async function authenticateWithAccountKey(identifierOrKey: string): Promise<{ userId: string; user: any } | null> {
  if (!identifierOrKey || typeof identifierOrKey !== 'string') return null;
  const clean = identifierOrKey.trim();
  if (!clean) return null;
  await ensureDbReady();

  const rows = await dbQuery(
    `SELECT id, name, full_name, email, account_key
     FROM users
     WHERE (account_key = $1 OR id = $1)
     LIMIT 1`,
    [clean]
  );
  if (!rows || rows.length === 0) return null;
  return {
    userId: rows[0].id,
    user: rows[0],
  };
}

/**
 * Get user profile and account details
 */
export async function getUser(userId: string) {
  await ensureDbReady();
  const rows = await dbQuery(
    `SELECT id, email, name, full_name, age_range, education_level, field_of_study, current_level, target_goal, learning_style, onboarding_step, onboarding_completed, onboarding_draft, created_at, updated_at
     FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Lookup user by email or user ID (for returning users across devices)
 */
export async function findUserByIdentifier(identifier: string) {
  await ensureDbReady();
  const trimmed = identifier ? identifier.trim() : '';
  if (!trimmed) return null;

  const rows = await dbQuery(
    `SELECT id, email, name, full_name, onboarding_completed, created_at, updated_at
     FROM users 
     WHERE id = $1 OR LOWER(email) = LOWER($1)
     ORDER BY updated_at DESC LIMIT 1`,
    [trimmed]
  );
  return rows[0] || null;
}

/**
 * Save in-progress onboarding draft step
 */
export async function saveOnboardingDraft(
  userId: string,
  step: number,
  draftData: any,
  name?: string,
  email?: string
) {
  await ensureDbReady();
  await ensureUser(userId, name, email);

  await dbQuery(
    `UPDATE users 
     SET onboarding_step = $1,
         onboarding_draft = $2,
         name = COALESCE(NULLIF($3, ''), name),
         full_name = COALESCE(NULLIF($3, ''), full_name, name),
         email = COALESCE(NULLIF($4, ''), email),
         updated_at = NOW()
     WHERE id = $5`,
    [step, JSON.stringify(draftData || {}), name || null, email || null, userId]
  );
}

/**
 * Update user profile details from Settings/Profile modal
 */
export async function updateUserProfile(
  userId: string,
  updates: {
    fullName?: string;
    email?: string;
    ageRange?: string;
    educationLevel?: string;
    fieldOfStudy?: string;
    careerGoal?: string;
    targetGoal?: string;
    learningStyle?: string;
    currentLevel?: string;
    headline?: string;
    summary?: string;
  }
) {
  await ensureDbReady();
  await ensureUser(userId, updates.fullName, updates.email);

  const goal = updates.careerGoal || updates.targetGoal || null;

  await dbQuery(
    `UPDATE users 
     SET full_name = COALESCE(NULLIF($1, ''), full_name),
         name = COALESCE(NULLIF($1, ''), name),
         email = COALESCE(NULLIF($2, ''), email),
         age_range = COALESCE(NULLIF($3, ''), age_range),
         education_level = COALESCE(NULLIF($4, ''), education_level),
         field_of_study = COALESCE(NULLIF($5, ''), field_of_study),
         target_goal = COALESCE(NULLIF($6, ''), target_goal),
         learning_style = COALESCE(NULLIF($7, ''), learning_style),
         current_level = COALESCE(NULLIF($8, ''), current_level),
         updated_at = NOW()
     WHERE id = $9`,
    [
      updates.fullName || null,
      updates.email || null,
      updates.ageRange || null,
      updates.educationLevel || null,
      updates.fieldOfStudy || null,
      goal,
      updates.learningStyle || null,
      updates.currentLevel || null,
      userId,
    ]
  );

  if (updates.headline || updates.summary) {
    await dbQuery(
      `UPDATE ai_profiles 
       SET headline = COALESCE(NULLIF($1, ''), headline),
           summary = COALESCE(NULLIF($2, ''), summary)
       WHERE user_id = $3`,
      [updates.headline || null, updates.summary || null, userId]
    );
  }

  await logProgress(userId, 'profile_updated', 'Updated personal profile details');
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
  const userName = answers.fullName || answers.name || 'Explorer';
  await ensureUser(userId, userName, answers.email);

  // 1. Mark onboarding completed in users table with rich discovery attributes
  await dbQuery(
    `UPDATE users 
     SET onboarding_completed = TRUE,
         onboarding_step = 8,
         full_name = COALESCE(NULLIF($2, ''), full_name, name),
         name = COALESCE(NULLIF($2, ''), name),
         email = COALESCE(NULLIF($3, ''), email),
         age_range = COALESCE(NULLIF($4, ''), age_range),
         education_level = COALESCE(NULLIF($5, ''), education_level),
         field_of_study = COALESCE(NULLIF($6, ''), field_of_study),
         current_level = COALESCE(NULLIF($7, ''), current_level),
         target_goal = COALESCE(NULLIF($8, ''), target_goal),
         learning_style = COALESCE(NULLIF($9, ''), learning_style),
         onboarding_draft = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [
      userId,
      userName,
      answers.email || null,
      answers.ageRange || null,
      answers.educationStage || answers.educationLevel || null,
      answers.fieldOfStudy || null,
      answers.currentSkillLevel || answers.experienceLevel || null,
      answers.careerGoal || (answers.priorities ? answers.priorities[0] : null),
      answers.learningStyle || null,
    ]
  );

  // 2. Save onboarding responses
  const respId = `resp-${Date.now()}`;
  await dbQuery(
    `INSERT INTO onboarding_responses (
      id, user_id, education_stage, free_time_activities, disliked_tasks,
      problem_solving_style, work_environment, priorities, current_skill_level, freeform_notes,
      full_name, age_range, field_of_study, existing_skills, curious_topics, career_goal, learning_style, experience_level
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [
      respId,
      userId,
      answers.educationStage || answers.educationLevel || '',
      JSON.stringify(answers.freeTimeActivities || []),
      JSON.stringify(answers.dislikedTasks || []),
      answers.problemSolvingStyle || '',
      answers.workEnvironment || '',
      JSON.stringify(answers.priorities || []),
      answers.currentSkillLevel || answers.experienceLevel || '',
      answers.freeformNotes || null,
      userName,
      answers.ageRange || null,
      answers.fieldOfStudy || null,
      JSON.stringify(answers.existingSkills || []),
      JSON.stringify(answers.curiousTopics || []),
      answers.careerGoal || null,
      answers.learningStyle || null,
      answers.experienceLevel || answers.currentSkillLevel || null,
    ]
  );

  // 3. Save structured AI profile
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

  // 4. Save recommendations
  if (Array.isArray(recommendations)) {
    // Clear previous recommendations for this user to keep exactly 3 current
    await dbQuery('DELETE FROM recommendations WHERE user_id = $1', [userId]);

    for (const rec of recommendations) {
      const rawId = rec.id || `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const scopedId = rawId.startsWith(userId + '_') ? rawId : `${userId}_${rawId}`;
      await dbQuery(
        `INSERT INTO recommendations (
          id, user_id, direction_name, tagline, simple_explanation, why_it_fits_you,
          day_in_the_life, beginner_skills, future_opportunities, challenge, comparison
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          direction_name = EXCLUDED.direction_name,
          tagline = EXCLUDED.tagline,
          simple_explanation = EXCLUDED.simple_explanation,
          why_it_fits_you = EXCLUDED.why_it_fits_you,
          day_in_the_life = EXCLUDED.day_in_the_life,
          beginner_skills = EXCLUDED.beginner_skills,
          future_opportunities = EXCLUDED.future_opportunities,
          challenge = EXCLUDED.challenge,
          comparison = EXCLUDED.comparison`,
        [
          scopedId,
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
  await logProgress(userId, 'onboarding_completed', `Completed discovery for ${userName} and generated 3 paths`);
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
        const rawTaskId = t.id || `task-${Date.now()}`;
        const scopedTaskId = rawTaskId.startsWith(userId + '_') ? rawTaskId : `${userId}_${rawTaskId}`;
        await dbQuery(
          `INSERT INTO roadmap_tasks (id, user_id, roadmap_id, stage_number, task_text, is_completed)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             roadmap_id = EXCLUDED.roadmap_id,
             stage_number = EXCLUDED.stage_number,
             task_text = EXCLUDED.task_text`,
          [scopedTaskId, userId, stageId, stg.stageNumber, t.text, false]
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
  const scopedTaskId = taskId.startsWith(userId + '_') ? taskId : `${userId}_${taskId}`;
  await dbQuery(
    `UPDATE roadmap_tasks 
     SET is_completed = $1, completed_at = CASE WHEN $1 = TRUE THEN NOW() ELSE NULL END
     WHERE (id = $2 OR id = $3) AND user_id = $4`,
    [isCompleted, scopedTaskId, taskId, userId]
  );

  const taskRows = await dbQuery('SELECT task_text FROM roadmap_tasks WHERE (id = $1 OR id = $2) AND user_id = $3', [scopedTaskId, taskId, userId]);
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
  const scopedProjectId = projectId.startsWith(userId + '_') ? projectId : `${userId}_${projectId}`;
  // Upsert project record
  await dbQuery(
    `INSERT INTO projects (id, user_id, title, level, objective, skills_practiced, expected_output, difficulty, is_completed, completed_at)
     VALUES ($1, $2, $3, 'Custom', '', '[]'::jsonb, '', '', $4, CASE WHEN $4 = TRUE THEN NOW() ELSE NULL END)
     ON CONFLICT (id) DO UPDATE 
     SET is_completed = $4, completed_at = CASE WHEN $4 = TRUE THEN NOW() ELSE NULL END, user_id = $2`,
    [scopedProjectId, userId, projectId, isCompleted]
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
    id: r.id.startsWith(userId + '_') ? r.id.slice(userId.length + 1) : r.id,
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
    const rawTargetRecId = p.recommendation_id;
    const cleanTargetRecId = rawTargetRecId && rawTargetRecId.startsWith(userId + '_') 
      ? rawTargetRecId.slice(userId.length + 1) 
      : rawTargetRecId;

    selectedDirection = recommendations.find(r => r.id === cleanTargetRecId || r.id === rawTargetRecId) || {
      id: cleanTargetRecId || 'custom-path',
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

  const completedTaskIds = taskRows
    .filter((t: any) => t.is_completed)
    .map((t: any) => (t.id.startsWith(userId + '_') ? t.id.slice(userId.length + 1) : t.id));

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
      .map((t: any) => ({ 
        id: t.id.startsWith(userId + '_') ? t.id.slice(userId.length + 1) : t.id, 
        text: t.task_text 
      })),
  }));

  // 5. Projects
  const projectRows = await dbQuery(
    `SELECT * FROM projects WHERE user_id = $1 AND is_completed = TRUE`,
    [userId]
  );
  const completedProjectIds = projectRows.map((p: any) => 
    p.id.startsWith(userId + '_') ? p.id.slice(userId.length + 1) : p.id
  );

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

  // 9. User account details and onboarding persistence
  const userRows = await dbQuery(
    `SELECT id, name, full_name, email, age_range, education_level, field_of_study, current_level, target_goal, learning_style, onboarding_step, onboarding_completed, onboarding_draft
     FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const u = userRows[0];
  const onboardingCompleted = Boolean(u?.onboarding_completed || profile);
  let onboardingDraft = null;
  if (u?.onboarding_draft) {
    try {
      onboardingDraft = typeof u.onboarding_draft === 'string' ? JSON.parse(u.onboarding_draft) : u.onboarding_draft;
    } catch {}
  }

  return {
    user: {
      id: u?.id || userId,
      name: u?.full_name || u?.name || 'Explorer',
      fullName: u?.full_name || u?.name || '',
      email: u?.email || '',
      ageRange: u?.age_range || '',
      educationLevel: u?.education_level || '',
      fieldOfStudy: u?.field_of_study || '',
      currentLevel: u?.current_level || '',
      targetGoal: u?.target_goal || '',
      learningStyle: u?.learning_style || '',
    },
    onboardingCompleted,
    onboardingStep: u?.onboarding_step || 0,
    onboardingDraft,
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

  // Reset onboarding status so fresh discovery can begin, but preserve name & email
  await dbQuery(
    `UPDATE users 
     SET onboarding_completed = FALSE,
         onboarding_step = 0,
         onboarding_draft = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );

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
