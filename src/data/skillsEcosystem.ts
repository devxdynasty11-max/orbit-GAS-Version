import { Recommendation, RoadmapStage, LearningResource, ProjectItem } from '../types';

export interface SkillDomain {
  id: string;
  name: string;
  icon: string;
  description: string;
  directions: string[];
}

export const SKILL_DOMAINS: SkillDomain[] = [
  {
    id: 'design',
    name: 'Design & Creative Arts',
    icon: '🎨',
    description: 'UI/UX, visual brand systems, spatial design, and creative direction',
    directions: ['Product UX & Interface Design', 'Brand Identity & Visual Design', 'Interior & Architectural Space Design'],
  },
  {
    id: 'business',
    name: 'Business, Management & Strategy',
    icon: '💼',
    description: 'Product leadership, venture building, operations, and modern growth strategy',
    directions: ['Product Management & Strategy', 'Indie Venture & Digital Entrepreneurship', 'Growth & Brand Marketing Strategy'],
  },
  {
    id: 'finance',
    name: 'Finance, Economics & Wealth',
    icon: '📈',
    description: 'Financial analysis, equity research, valuation, and capital management',
    directions: ['Financial Analysis & Investment Strategy', 'Corporate Finance & Valuation', 'FinTech & Quantitative Analysis'],
  },
  {
    id: 'media',
    name: 'Media, Writing & Storytelling',
    icon: '✍️',
    description: 'Investigative journalism, creative narrative, audio/video production, and publishing',
    directions: ['Investigative Journalism & Editorial Writing', 'Content Strategy & Digital Media Production', 'Narrative Storytelling & Publishing'],
  },
  {
    id: 'psychology',
    name: 'Psychology, People & Human Behavior',
    icon: '🧠',
    description: 'Behavioral research, counseling, organizational dynamics, and human potential',
    directions: ['Behavioral Psychology & User Insights', 'People Operations & Organizational Culture', 'Counseling & Mental Health Mentorship'],
  },
  {
    id: 'law',
    name: 'Law, Policy & Social Governance',
    icon: '⚖️',
    description: 'Corporate law, public policy analysis, environmental governance, and ethics',
    directions: ['Legal Analysis & Corporate Governance', 'Public Policy & Social Impact Strategy', 'Intellectual Property & Technology Law'],
  },
  {
    id: 'health',
    name: 'Healthcare, Medicine & Life Sciences',
    icon: '🩺',
    description: 'Clinical practice, biomedical discovery, patient care, and healthcare systems',
    directions: ['Clinical Medicine & Healthcare Practice', 'Biomedical Research & Life Sciences', 'Public Health & Health Innovation'],
  },
  {
    id: 'science',
    name: 'Physical Sciences & Engineering',
    icon: '🔬',
    description: 'Robotics, mechanical systems, renewable energy, and material sciences',
    directions: ['Sustainable Energy & Climate Systems', 'Robotics & Mechanical Systems Design', 'Applied Physics & Material Innovation'],
  },
  {
    id: 'tech',
    name: 'Technology & Computing',
    icon: '💻',
    description: 'Frontend systems, server architecture, AI intelligence, and cloud engineering',
    directions: ['Creative Frontend & Interactive Web', 'Backend & Systems Engineering', 'AI & Machine Learning Engineering'],
  },
];
