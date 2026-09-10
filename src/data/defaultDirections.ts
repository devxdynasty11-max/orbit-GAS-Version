import { Recommendation, RoadmapStage, LearningResource, ProjectItem, UserProfile } from '../types';

export const DEFAULT_PROFILE: UserProfile = {
  headline: 'Curious Explorer with an Eye for Building Things',
  summary:
    'You enjoy understanding how things work and seeing a real outcome from your effort. You prefer friendly, visual feedback over dry theory, and you want freedom to experiment without being boxed into rigid routines.',
  naturalStrengths: [
    'Quick visual intuition for what looks and feels right',
    'Curiosity about how digital products are built',
    'Comfortable experimenting and learning from mistakes',
  ],
  workStyle: 'Deep focus with occasional feedback from creative collaborators',
  motivation: 'Building things people actually enjoy using, with creative freedom',
  thingsToAvoid: [
    'Repetitive manual paperwork',
    'High-pressure cold outreach',
    'Rigid micromanagement without room for creativity',
  ],
  curiosityAreas: ['Interactive apps', 'Visual design', 'Creative problem solving'],
  startingLevel: 'Beginner with great curiosity',
};

export const DEFAULT_RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'dir-frontend',
    directionName: 'Creative Frontend & Interactive Web',
    tagline: 'Bring ideas to life on screen using code and visual creativity',
    simpleExplanation:
      'Frontend creators build everything you see, tap, and interact with on websites and apps. It is the perfect blend of visual design and logical problem-solving where you see results instantly.',
    whyItFitsYou:
      'You mentioned enjoying building things and getting visual feedback. Frontend lets you write a few lines and immediately see buttons move and colors change.',
    dayInTheLife: [
      'Turning an idea or drawing into an interactive webpage',
      'Experimenting with animations, colors, and layout rhythm',
      'Solving puzzle-like bugs so everything works smoothly on phones and laptops',
      'Collaborating with designers to make screens easy and fun to use',
    ],
    beginnerSkills: [
      'HTML structure (the skeleton of the web)',
      'CSS styling & layouts (making things look beautiful)',
      'Modern JavaScript (making things interactive)',
      'Git basics (saving your progress like a video game checkpoint)',
    ],
    whatYouCanTryToday: 'Change the color, text, and button click reaction on a mini webpage in 5 minutes.',
    futureOpportunities: [
      'Frontend Web Developer at high-growth tech startups',
      'Creative Freelance Web Designer building custom sites for creators',
      'Design Engineer bridging the gap between product designers and engineers',
    ],
    challenge: {
      title: 'Build a Personal Mood Card',
      scenario:
        'A creator wants a clean, interactive greeting card for their profile that changes moods and responds when clicked.',
      taskDescription:
        'Adjust the headline, select your color tone, and test the interactive button to see real-time updates.',
      type: 'code',
      starterTemplate: `<div class="p-6 bg-gradient-to-br from-indigo-900 to-neutral-900 text-white rounded-2xl border border-indigo-500/30">
  <span class="px-2.5 py-1 text-xs rounded-full bg-indigo-500/20 text-indigo-300 font-medium">Live Card</span>
  <h3 class="text-xl font-semibold mt-3">Welcome to my space</h3>
  <p class="text-neutral-300 text-sm mt-1">Exploring new skills one step at a time.</p>
  <button class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm rounded-lg font-medium transition">Say Hello 👋</button>
</div>`,
      sampleGuidance: 'Try changing the title text or experimenting with the button click!',
    },
    comparison: {
      whatIsIt: 'Crafting the interactive, visible parts of websites and web apps.',
      whatWouldIDo: 'Write code that makes designs come alive in web browsers.',
      creativeFactor: 'High — you directly control layouts, animations, and aesthetic feel.',
      problemSolving: 'Medium-High — fixing logic quirks and responsive screens.',
      workingWithPeople: 'Balanced — mostly building in flow state with small team syncs.',
      beginnerDifficulty: 'Gentle start — you see your changes update instantly on screen.',
      whatCanITryToday: 'Inspect any website in Chrome DevTools or test our mini-challenge below.',
      whoMightEnjoy: 'Anyone who likes seeing instant visual proof of their effort.',
    },
  },
  {
    id: 'dir-product-ux',
    directionName: 'Product UX & Interface Design',
    tagline: 'Design digital experiences that feel effortless and friendly',
    simpleExplanation:
      'Product and UX designers figure out how an app should feel, where buttons should go, and why people might get confused so they can make it delightful.',
    whyItFitsYou:
      'You have an eye for what feels confusing vs intuitive. You like understanding how people think without getting stuck in deep mathematical code.',
    dayInTheLife: [
      'Talking with users to discover what annoys them about existing apps',
      'Sketching user journeys and wireframes on digital whiteboards',
      'Creating clean, high-fidelity mockups in tools like Figma',
      'Testing designs with friends to see if buttons are easy to find',
    ],
    beginnerSkills: [
      'Visual hierarchy and typography rhythm',
      'Wireframing and user journey mapping',
      'Figma basics (components, auto-layout)',
      'Empathy-driven user feedback sessions',
    ],
    whatYouCanTryToday: 'Find an app on your phone that frustrates you, and sketch a 3-step fix on paper.',
    futureOpportunities: [
      'Product Designer shaping user journeys for consumer apps',
      'UX Researcher discovering human behavioral insights',
      'Design Systems Specialist creating component libraries',
    ],
    challenge: {
      title: 'Fix a Frustrating App Screen',
      scenario:
        'A student app has an overwhelming checkout screen where users cannot find the "Confirm" button because 5 giant promotional banners are competing for attention.',
      taskDescription:
        'Identify which 2 elements should be removed and write a 1-sentence explanation of why the primary action should be prominent.',
      type: 'design',
      sampleGuidance:
        'Think about what the user came to accomplish in that exact 10 seconds. Anything else is noise.',
    },
    comparison: {
      whatIsIt: 'Designing how apps look, work, and guide users without frustration.',
      whatWouldIDo: 'Interview people, sketch screen layouts, and craft interactive prototypes.',
      creativeFactor: 'Very High — shapes, colors, spaces, and intuitive micro-moments.',
      problemSolving: 'Medium — human psychology and reducing friction.',
      workingWithPeople: 'High — gathering feedback, understanding user pains.',
      beginnerDifficulty: 'Very accessible — you can start with just a pen, paper, or free Figma.',
      whatCanITryToday: 'Sketch a redesign of your school portal on a piece of paper.',
      whoMightEnjoy: 'Empathetic thinkers who love clean aesthetics and helping others.',
    },
  },
  {
    id: 'dir-data-storytelling',
    directionName: 'Data Analysis & Visual Storytelling',
    tagline: 'Uncover hidden patterns in numbers and tell compelling stories',
    simpleExplanation:
      'Data detectives take messy tables of information and find the hidden truth: what music people love, why an esport team wins, or how a business can grow.',
    whyItFitsYou:
      'You are curious and enjoy looking at patterns to figure out what is really going on behind the scenes.',
    dayInTheLife: [
      'Asking questions like "Why did song streams drop on Tuesdays?"',
      'Cleaning and organizing data using Python or spreadsheets',
      'Creating visual graphs and charts that make findings crystal clear',
      'Sharing actionable insights with team leads to help them make smart choices',
    ],
    beginnerSkills: [
      'Spreadsheet magic (filtering, pivot tables, quick formulas)',
      'Visual charting principles (choosing the right chart for the story)',
      'Basic SQL queries (retrieving data from databases)',
      'Curiosity and critical questioning',
    ],
    whatYouCanTryToday: 'Look at your own Spotify Wrapped or phone screen time and spot 2 surprising habits.',
    futureOpportunities: [
      'Data Analyst in sports, gaming, entertainment, or finance',
      'Growth & Product Analyst guiding startup decisions',
      'Business Intelligence Specialist building executive dashboards',
    ],
    challenge: {
      title: 'Find the Mystery in the Mini Dataset',
      scenario:
        'Here are daily visits to a teen gaming community: Mon: 4,200 | Tue: 4,100 | Wed: 4,300 | Thu: 4,150 | Fri: 8,900 | Sat: 9,200 | Sun: 6,100.',
      taskDescription:
        'Spot the pattern and write a 1-sentence recommendation for when the community should host their weekly live tournament.',
      type: 'logic',
      sampleGuidance:
        'Look at when players are naturally flocking to the platform without any marketing nudge.',
    },
    comparison: {
      whatIsIt: 'Exploring numbers, facts, and datasets to uncover real-world insights.',
      whatWouldIDo: 'Query data, organize spreadsheets, create charts, and explain what happened.',
      creativeFactor: 'Medium — visual chart design and narrative storytelling.',
      problemSolving: 'High — investigative logic, spotting anomalies and trends.',
      workingWithPeople: 'Medium — sharing findings with decision-makers.',
      beginnerDifficulty: 'Gentle start with Google Sheets, leveling up into Python/SQL.',
      whatCanITryToday: 'Make a quick chart of your favorite video game stats.',
      whoMightEnjoy: 'Curious puzzle solvers who want proof before making decisions.',
    },
  },
];

export const DEFAULT_ROADMAPS: Record<string, RoadmapStage[]> = {
  'dir-frontend': [
    {
      id: 'stg-1',
      stageNumber: 1,
      stageKey: 'START HERE',
      title: 'Orientation & Zero-Pressure Playground',
      subtitle: 'Get familiar with how the web works without installing complex tools',
      whatToLearn: [
        'How websites travel from servers to your browser',
        'Right-click "Inspect" in Chrome to see live HTML & CSS',
        'Basic free tools: VS Code and browser DevTools',
      ],
      whyItMatters:
        'Removing the fear of code is the most important first win. Real code is just text that your browser renders.',
      whatToPractice: [
        'Open DevTools on your favorite site and change a headline text',
        'Install VS Code or use an online playground like CodeSandbox',
      ],
      whatToBuild: 'A simple single-page HTML profile with your name and 3 things you like',
      whatSuccessLooksLike: 'You can open an HTML file in your browser and see your text update when saved',
      whatToDoNext: 'Learn how CSS colors and fonts make that plain HTML look stylish',
      tasks: [
        { id: 't1-1', text: 'Right-click and "Inspect" any website headline in your browser', done: false },
        { id: 't1-2', text: 'Write your first 10 lines of HTML in a simple text file', done: false },
        { id: 't1-3', text: 'Open that file in your browser and celebrate seeing your words on screen', done: false },
      ],
    },
    {
      id: 'stg-2',
      stageNumber: 2,
      stageKey: 'BASICS',
      title: 'Visual Styling & Layout Mastery',
      subtitle: 'Learn the magic of modern CSS, Flexbox, and responsive sizing',
      whatToLearn: [
        'CSS selectors, colors, margins, and padding math',
        'Flexbox: the secret to centering anything effortlessly',
        'Responsive basics so screens adapt to phone and desktop',
      ],
      whyItMatters:
        'A good design feels trustworthy. Learning layout basics gives you the superpower to make anything look modern.',
      whatToPractice: [
        'Center a card perfectly in the middle of a screen',
        'Build a responsive 2-column card grid that stacks on mobile',
      ],
      whatToBuild: 'A responsive link-in-bio landing page for yourself or a friend',
      whatSuccessLooksLike: 'Your page looks clean and readable on both your laptop and your phone',
      whatToDoNext: 'Bring it to life with interactive JavaScript clicks and toggles',
      tasks: [
        { id: 't2-1', text: 'Master Flexbox with interactive games like Flexbox Froggy', done: false },
        { id: 't2-2', text: 'Style a custom button with hover states and smooth transition', done: false },
        { id: 't2-3', text: 'Make your card adapt seamlessly between mobile and desktop', done: false },
      ],
    },
    {
      id: 'stg-3',
      stageNumber: 3,
      stageKey: 'FIRST PROJECT',
      title: 'Your First Interactive Mini-App',
      subtitle: 'Add JavaScript to listen to clicks, store values, and change elements',
      whatToLearn: [
        'Variables, simple functions, and event listeners',
        'Updating text or styles dynamically when a user clicks',
        'Handling simple user inputs (text fields, buttons)',
      ],
      whyItMatters:
        'This is where static pages turn into real applications that do things for people.',
      whatToPractice: [
        'Make a button that increments a counter',
        'Build a light/dark mode theme toggle',
      ],
      whatToBuild: 'A Minimalist Habit or Daily Focus Tracker that saves items to local browser memory',
      whatSuccessLooksLike: 'You can refresh the page and your checked habits are still there',
      whatToDoNext: 'Explore modern component frameworks like React to build faster',
      tasks: [
        { id: 't3-1', text: 'Write a function that updates text on button click', done: false },
        { id: 't3-2', text: 'Store user choices in localStorage so refresh preserves state', done: false },
        { id: 't3-3', text: 'Deploy your mini-app for free on Vercel or GitHub Pages to show a friend', done: false },
      ],
    },
    {
      id: 'stg-4',
      stageNumber: 4,
      stageKey: 'PRACTICE',
      title: 'Modern React & Component Thinking',
      subtitle: 'Break complex UIs into reusable, clean puzzle pieces',
      whatToLearn: [
        'React components, props, and state (useState, useEffect)',
        'Tailwind CSS for lightning-fast styling without messy stylesheets',
        'Managing lists and filtering items dynamically',
      ],
      whyItMatters:
        'React powers Instagram, Netflix, and modern web apps. It lets you build apps like Lego blocks.',
      whatToPractice: [
        'Create a reusable Card component that accepts different data props',
        'Build a live search filter over a list of items',
      ],
      whatToBuild: 'An Interactive Movie or Game Finder with live keyword filtering and favoriting',
      whatSuccessLooksLike: 'You can filter 20 items instantly without lag or errors',
      whatToDoNext: 'Connect to real backend APIs to fetch live weather or music data',
      tasks: [
        { id: 't4-1', text: 'Build 3 reusable components with clean props', done: false },
        { id: 't4-2', text: 'Implement live search and category filter state', done: false },
        { id: 't4-3', text: 'Add smooth motion transitions with motion/react', done: false },
      ],
    },
    {
      id: 'stg-5',
      stageNumber: 5,
      stageKey: 'REAL PROJECTS',
      title: 'Building Full Applications with APIs',
      subtitle: 'Fetch real data from servers and handle loading and error states gracefully',
      whatToLearn: [
        'Fetching JSON data from public REST APIs or server endpoints',
        'Graceful loading spinners, error banners, and empty states',
        'Authentication basics and form validation',
      ],
      whyItMatters:
        'Real-world software is all about data flowing between servers and clean user interfaces.',
      whatToPractice: [
        'Handle network errors without crashing the UI',
        'Cache fetched data so navigation feels instantaneous',
      ],
      whatToBuild: 'A Real-time Weather & Outfit Recommender or Spotify Playlist Visualizer',
      whatSuccessLooksLike: 'Real users can type an input, see live API data, and never see a broken screen',
      whatToDoNext: 'Curate your best 2 projects into a sleek developer portfolio',
      tasks: [
        { id: 't5-1', text: 'Fetch live API data and render it in a clean card layout', done: false },
        { id: 't5-2', text: 'Add friendly empty and retry states for failed network calls', done: false },
        { id: 't5-3', text: 'Optimize bundle size and ensure mobile touch targets are 44px+', done: false },
      ],
    },
    {
      id: 'stg-6',
      stageNumber: 6,
      stageKey: 'PORTFOLIO',
      title: 'The Clean Showcase That Proves Your Skill',
      subtitle: 'Show the world what you can do with clear project walkthroughs and live demos',
      whatToLearn: [
        'Writing clear project case studies (The Problem → My Solution → What I Learned)',
        'Clean GitHub documentation with live preview links',
        'Polishing details: custom favicon, OpenGraph social cards, fast lighthouse scores',
      ],
      whyItMatters:
        'People do not hire you based on certifications; they hire you based on things you built that work.',
      whatToPractice: [
        'Record a 60-second Loom demo showing your app in action',
        'Write a 3-paragraph readme explaining why you built the project',
      ],
      whatToBuild: 'Your personal digital garden / developer portfolio showcasing 3 working apps',
      whatSuccessLooksLike: 'Anyone clicking your portfolio can try your apps immediately on their phone',
      whatToDoNext: 'Level up into full-stack architecture or specialized UI engineering',
      tasks: [
        { id: 't6-1', text: 'Select your 2 strongest projects and polish their responsive layouts', done: false },
        { id: 't6-2', text: 'Deploy your portfolio on a custom domain or clean URL', done: false },
        { id: 't6-3', text: 'Get honest feedback from 2 other learners or online communities', done: false },
      ],
    },
    {
      id: 'stg-7',
      stageNumber: 7,
      stageKey: 'NEXT LEVEL',
      title: 'Specialization, Craft & Continuous Growth',
      subtitle: 'Dive deeper into design systems, full-stack backends, or AI integrations',
      whatToLearn: [
        'Full-stack concepts: server routes, database persistence, and API security',
        'Micro-interactions, accessible ARIA patterns, and performance tuning',
        'Building AI-integrated tools using OpenAI or NVIDIA endpoints',
      ],
      whyItMatters:
        'Continuous curiosity keeps engineering fun and opens up freelance, startup, and team roles.',
      whatToPractice: [
        'Integrate an AI model API behind a secure server proxy',
        'Audit an existing open-source project and submit a small bug fix',
      ],
      whatToBuild: 'An AI-enhanced productivity assistant or interactive collaborative tool',
      whatSuccessLooksLike: 'You feel confident picking up new documentation and shipping features independently',
      whatToDoNext: 'Apply for internships, freelance gigs, or build your own independent product!',
      tasks: [
        { id: 't7-1', text: 'Build a full-stack feature with secure server-side secrets', done: false },
        { id: 't7-2', text: 'Contribute a documentation improvement or fix to a community repo', done: false },
        { id: 't7-3', text: 'Mentor a beginner who was where you were when you started ORBIT', done: false },
      ],
    },
  ],
};

export const DEFAULT_RESOURCES: LearningResource[] = [
  {
    id: 'res-1',
    name: 'freeCodeCamp (Responsive Web & JS)',
    type: 'free',
    category: 'Interactive Coding',
    description: 'Completely free interactive coding challenges with instant tests and zero setup required.',
    urlOrNote: 'Free official curriculum covering HTML, CSS, JavaScript, and React',
  },
  {
    id: 'res-2',
    name: 'MDN Web Docs (Mozilla Developer Network)',
    type: 'free',
    category: 'Official Documentation',
    description: 'The golden standard reference for web standards, HTML tags, CSS properties, and guides.',
    urlOrNote: 'Free official documentation maintained by browser engineers',
  },
  {
    id: 'res-3',
    name: 'The Odin Project',
    type: 'free',
    category: 'Full Curriculum',
    description: 'A community-driven, open-source path that teaches you to build real projects using real developer tools.',
    urlOrNote: 'Completely free curriculum focusing on real project creation',
  },
  {
    id: 'res-4',
    name: 'Figma Community & Free Starter Kits',
    type: 'free',
    category: 'Design & Prototyping',
    description: 'Free UI kits, wireframe templates, and design system components from top product designers.',
    urlOrNote: 'Free Figma starter tier with community template library',
  },
  {
    id: 'res-5',
    name: 'Frontend Masters / Coursera Guided Paths',
    type: 'paid',
    category: 'Structured Video Courses',
    description: 'In-depth video tutorials by senior staff engineers from Stripe, Netflix, and Figma (financial aid available).',
    urlOrNote: 'Paid monthly subscription or Coursera financial aid application',
  },
  {
    id: 'res-6',
    name: 'Refactoring UI (Book & Component Guide)',
    type: 'paid',
    category: 'UI Design for Developers',
    description: 'Practical design rules written specifically for developers who want their apps to look clean.',
    urlOrNote: 'Paid digital book & visual component breakdowns',
  },
];

export const DEFAULT_PROJECTS: ProjectItem[] = [
  {
    id: 'proj-1',
    title: 'Personal Minimalist Focus Hub',
    level: 'Beginner',
    objective: 'Build a clean single-screen daily dashboard with a focus timer and task checklist.',
    skillsPracticed: ['Semantic HTML', 'Tailwind CSS layouts', 'localStorage state persistence'],
    expectedOutput: 'A working webpage that lets users type tasks, check them off, and start a 25-minute timer.',
    difficulty: 'Easy (1-2 days)',
    suggestedNextStep: 'Add sound effects or dark mode theme toggle',
    completed: false,
  },
  {
    id: 'proj-2',
    title: 'Interactive Flashcard & Quiz Deck',
    level: 'Intermediate',
    objective: 'Create an engaging flashcard tool with flip animations, scoring, and category filters.',
    skillsPracticed: ['React state management', 'CSS 3D transforms / motion', 'Array filtering and shuffling'],
    expectedOutput: 'An interactive study deck that calculates score and lets users create custom cards.',
    difficulty: 'Moderate (3-5 days)',
    suggestedNextStep: 'Connect to an external API to load trivia questions automatically',
    completed: false,
  },
  {
    id: 'proj-3',
    title: 'AI Prompt & Idea Canvas',
    level: 'Advanced',
    objective: 'Build a full-featured tool that helps creators brainstorm, organize, and export project concepts.',
    skillsPracticed: ['Full-stack Express API proxy', 'AI model integration', 'Drag-and-drop or card grid organization'],
    expectedOutput: 'A production-grade app with loading states, markdown rendering, and local export.',
    difficulty: 'Challenging (1-2 weeks)',
    suggestedNextStep: 'Deploy to Vercel/Cloud Run and write a case study for your portfolio',
    completed: false,
  },
];
