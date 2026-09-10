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
}

export interface RoadmapTask {
  id: string;
  text: string;
  done: boolean;
}

export interface RoadmapStage {
  id: string;
  stageNumber: number;
  stageKey: 'START HERE' | 'BASICS' | 'FIRST PROJECT' | 'PRACTICE' | 'REAL PROJECTS' | 'PORTFOLIO' | 'NEXT LEVEL';
  title: string;
  subtitle: string;
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

export interface UserProgressState {
  onboardingCompleted: boolean;
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
}
