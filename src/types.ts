export interface OnboardingAnswers {
  educationStage: string;
  freeTimeActivities: string[];
  dislikedTasks: string[];
  problemSolvingStyle: string;
  workEnvironment: string;
  priorities: string[];
  currentSkillLevel: string;
  freeformNotes?: string;
}

export interface UserProfile {
  headline: string;
  summary: string;
  naturalStrengths: string[];
  workStyle: string;
  motivation: string;
  thingsToAvoid: string[];
  curiosityAreas: string[];
  startingLevel: string;
}

export interface Challenge {
  title: string;
  scenario: string;
  taskDescription: string;
  type: 'code' | 'design' | 'creative' | 'logic';
  starterTemplate?: string;
  sampleGuidance: string;
}

export interface RecommendationComparison {
  whatIsIt: string;
  whatWouldIDo: string;
  creativeFactor: string;
  problemSolving: string;
  workingWithPeople: string;
  beginnerDifficulty: string;
  whatCanITryToday: string;
  whoMightEnjoy: string;
}

export interface FormalRequirements {
  education: string[];
  eligibility: string[];
  entranceExams: string[];
  qualificationsAndLicensing: string[];
  practicalExperience: string[];
  careerProgression: string[];
}

export interface Recommendation {
  id: string;
  directionName: string;
  tagline: string;
  simpleExplanation: string;
  whyItFitsYou: string;
  dayInTheLife: string[];
  beginnerSkills: string[];
  whatYouCanTryToday: string;
  futureOpportunities: string[];
  challenge: Challenge;
  comparison: RecommendationComparison;
  isRegulatedProfession?: boolean;
  formalRequirements?: FormalRequirements;
  careerGoal?: string;
}

export interface RoadmapTask {
  id: string;
  text: string;
  done: boolean;
  skipped?: boolean;
  category?: string;
}

export interface RoadmapStage {
  id: string;
  stageNumber: number;
  stageKey: string;
  title: string;
  subtitle: string;
  estimatedTime?: string;
  whyLearningThis?: string;
  howItHelpsCareer?: string;
  whatComesAfter?: string;
  whatToLearn: string[];
  whyItMatters: string;
  whatToPractice: string[];
  whatToBuild: string;
  whatSuccessLooksLike: string;
  whatToDoNext: string;
  tasks: RoadmapTask[];
}

export interface LearningResource {
  id: string;
  name: string;
  type: 'free' | 'paid';
  category: string;
  description: string;
  urlOrNote: string;
}

export interface ProjectItem {
  id: string;
  title: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  objective: string;
  skillsPracticed: string[];
  expectedOutput: string;
  difficulty: string;
  suggestedNextStep: string;
  completed: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface JourneyArchive {
  id: string;
  sessionNumber: number;
  directionName: string;
  tagline?: string;
  headline?: string;
  profile?: UserProfile | null;
  recommendations?: Recommendation[];
  selectedDirection?: Recommendation | null;
  roadmap?: RoadmapStage[];
  completedTaskIds?: string[];
  completedProjectIds?: string[];
  completedTasksCount?: number;
  totalTasksCount?: number;
  completedProjectsCount?: number;
  reflections?: Record<string, any>;
  archivedAt: string;
  formattedDate?: string;
}

export interface UserProgressState {
  onboardingCompleted: boolean;
  sessionNumber?: number;
  profile: UserProfile | null;
  recommendations: Recommendation[];
  selectedDirectionId: string | null;
  selectedDirection: Recommendation | null;
  completedChallengeIds: string[];
  challengeReflections: Record<string, {
    userSubmission: string;
    enjoyed: string;
    easy: string;
    frustrating: string;
    aiFeedback: string;
  }>;
  roadmap: RoadmapStage[];
  resources: LearningResource[];
  projects: ProjectItem[];
  completedTaskIds: string[];
  completedProjectIds: string[];
  recentActivities: { id: string; text: string; timestamp: string }[];
  journeyHistory?: JourneyArchive[];
}
