# ORBIT — AI Career & Skill Discovery Platform

> "Everyone is running. But where are you going?"

Built by **ADITYAX**

ORBIT is an intelligent personal career and skill discovery guide designed for students, beginners, and young explorers who are unsure about their future, confused about which skill to learn, or overwhelmed by traditional advice.

---

## 🌟 Key Features

1. **Intelligent Conversational Onboarding**
   - No boring corporate psychometric tests.
   - Gentle, adaptive questions exploring education, natural hobbies, dislikes, curiosity, and work preferences.
   - Dedicated *"I don't know"* quick escape helper with zero-pressure alternatives.

2. **Structured Profile Generation ("What Seems to Fit You")**
   - Natural strengths, work style, core drivers, and things to avoid in plain human words.

3. **Exactly 3 Tailored Possibilities**
   - Curated to prevent decision paralysis (never 20 overwhelming paths).
   - Simple explanations, a day in the life, beginner skills, and future opportunities.

4. **Try Before You Commit (Practical Micro-Labs)**
   - Don't just read about a career — experience a 5-minute slice of the work first.
   - Interactive live code preview, UX screen friction audit, or data mystery tests.
   - Post-challenge reflection with personalized AI feedback.

5. **Side-by-Side Comparison Matrix**
   - Compares what you'd actually do, creative factor, problem solving, working with people, beginner difficulty, and who might enjoy it.

6. **Personalized 7-Stage Roadmap**
   - `START HERE` → `BASICS` → `FIRST PROJECT` → `PRACTICE` → `REAL PROJECTS` → `PORTFOLIO` → `NEXT LEVEL`.
   - Actionable checklists, success definitions, and what to build.

7. **Project-Based Learning Progression**
   - Beginner, Intermediate, and Advanced milestones with real outputs and skill tracking.

8. **Curated Resources (Strictly Separated into Free & Paid)**
   - Only well-known, verified learning sources (MDN Web Docs, freeCodeCamp, The Odin Project, Figma Community). Zero fabricated links or courses.

9. **Dedicated AI Mentor**
   - Integrated with NVIDIA's API (`openai/gpt-oss-20b`) on a secure server-side route.
   - Understands your current profile, chosen path, and active roadmap task.
   - Helps break down tasks when you feel overwhelmed or unmotivated.

---

## 🚀 Getting Started Locally

### 1. Prerequisites
- Node.js 18+ installed on your machine.
- npm 9+

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Add your NVIDIA credentials in `.env`:
```env
NVIDIA_API_KEY=your_nvidia_api_key_here
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=openai/gpt-oss-20b
```

### 4. Run in Development Mode
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🏗️ Production Build & Deployment

ORBIT is built as a self-contained, deployment-ready full-stack application (Express + Vite + TypeScript) compatible with Vercel, Cloud Run, Render, Railway, or standard Node.js servers.

### 1. Build the Application
```bash
npm run build
```
This builds both:
- The optimized static frontend in `/dist`
- The bundled, self-contained server in `/dist/server.cjs` via `esbuild`

### 2. Start the Production Server
```bash
npm start
```
The server will boot and serve the production build on port `3000`.

---

## 🌐 Deploying to Vercel or Hosting Platforms

1. Push or import this repository to GitHub/GitLab.
2. Connect the repository in your hosting platform (Vercel, Render, Railway, or Google Cloud Run).
3. Set the Environment Variables in the project settings:
   - `NVIDIA_API_KEY`
   - `NVIDIA_BASE_URL` (default: `https://integrate.api.nvidia.com/v1`)
   - `NVIDIA_MODEL` (default: `openai/gpt-oss-20b`)
4. Trigger the build. No manual code modifications are needed.

---

## 🔒 Security & Privacy

- All NVIDIA AI API calls are routed through the secure server-side endpoint (`/server.ts`).
- API keys are **never** bundled or exposed to the client browser.
- Application state is persisted locally via browser storage with optional JSON export/import backups.

---

## 📄 License & Attribution

Built with passion and patience by **ADITYAX** for future creators, students, and explorers.
