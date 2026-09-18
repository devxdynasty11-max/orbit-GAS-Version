import type { Request, Response, NextFunction } from "express";

/**
 * Checks whether temporary maintenance mode is enabled via server environment variable.
 * Enabled when ORBIT_MAINTENANCE_MODE is 'true', '1', 'yes', or 'on'.
 */
export function isMaintenanceMode(): boolean {
  const raw = process.env.ORBIT_MAINTENANCE_MODE ?? "true";
  const val = raw.trim().toLowerCase();
  return val !== "false" && val !== "0" && val !== "off" && val !== "no";
}

/**
 * Static asset paths that remain accessible during maintenance
 * so the browser tab icon, favicon, and web manifest render properly.
 */
const ALLOWED_STATIC_PATHS = new Set([
  "/favicon.ico",
  "/favicon.svg",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/favicon-48x48.png",
  "/apple-touch-icon.png",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/site.webmanifest",
  "/robots.txt"
]);

/**
 * Self-contained, mobile-responsive, minimal, premium maintenance page HTML.
 * Strictly uses off-white palette (#FAF8F5), dark typography (#111827 / #4B5563),
 * subtle ORBIT celestial branding, and contains no login, dashboard, or onboarding elements.
 */
export function getMaintenanceHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
  <title>ORBIT — Upgrading Experience</title>
  <meta name="robots" content="noindex, nofollow" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <meta name="theme-color" content="#FAF8F5" />
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      height: 100%;
    }
    body {
      background-color: #FAF8F5;
      color: #111827;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 20px;
      text-align: center;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .maintenance-card {
      max-width: 480px;
      width: 100%;
      background: #FFFFFF;
      border: 1px solid #E8E4DD;
      border-radius: 16px;
      padding: 48px 36px;
      box-shadow: 0 4px 20px -2px rgba(27, 25, 23, 0.04);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .brand-mark {
      width: 54px;
      height: 54px;
      margin-bottom: 20px;
      filter: drop-shadow(0 4px 10px rgba(124, 58, 237, 0.15));
    }
    .brand-name {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #4B5563;
      margin-bottom: 24px;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background-color: #F5F0FF;
      border: 1px solid #E9DDFE;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      color: #6D28D9;
      margin-bottom: 24px;
      letter-spacing: 0.01em;
    }
    .status-dot {
      width: 7px;
      height: 7px;
      background-color: #8B5CF6;
      border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.25);
      animation: pulse 2s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.45; transform: scale(0.85); }
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      line-height: 1.3;
      letter-spacing: -0.02em;
      color: #111827;
      margin-bottom: 14px;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #4B5563;
      margin-bottom: 32px;
      max-width: 380px;
    }
    .divider {
      width: 40px;
      height: 1px;
      background-color: #E8E4DD;
      margin-bottom: 20px;
    }
    .meta-note {
      font-size: 12px;
      color: #9CA3AF;
      letter-spacing: 0.01em;
    }
    @media (max-width: 480px) {
      body {
        padding: 20px 16px;
      }
      .maintenance-card {
        padding: 36px 22px;
        border-radius: 14px;
      }
      h1 {
        font-size: 22px;
      }
      p {
        font-size: 14.5px;
        margin-bottom: 26px;
      }
    }
  </style>
</head>
<body>
  <main class="maintenance-card" id="orbit-maintenance-card" role="alert" aria-live="polite">
    <div class="brand-mark" id="orbit-brand-mark" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" width="54" height="54">
        <defs>
          <linearGradient id="orbitPlanetMaint" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#4338CA" />
            <stop offset="48%" stop-color="#7C3AED" />
            <stop offset="100%" stop-color="#A855F7" />
          </linearGradient>
          <linearGradient id="orbitRingMaint" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFFFFF" />
            <stop offset="100%" stop-color="#DDD6FE" />
          </linearGradient>
          <filter id="coreGlowMaint" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <!-- Back arc of Orbit Ring -->
        <path d="M 7.98 43.20 A 26.5 9.5 -25 0 1 56.02 20.80" stroke="#C4B5FD" stroke-width="3.75" stroke-linecap="round" opacity="0.85" />
        <!-- Central Planet Sphere -->
        <circle cx="32" cy="32" r="18.5" fill="url(#orbitPlanetMaint)" />
        <!-- Central Celestial Star Core -->
        <circle cx="32" cy="32" r="5.5" fill="#FFFFFF" filter="url(#coreGlowMaint)" />
        <!-- Front arc of Orbit Ring -->
        <path d="M 56.02 20.80 A 26.5 9.5 -25 0 1 7.98 43.20" stroke="url(#orbitRingMaint)" stroke-width="4.25" stroke-linecap="round" />
        <!-- Orbiting Satellite Beacon -->
        <circle cx="51.5" cy="24.2" r="3.6" fill="#FFFFFF" filter="url(#coreGlowMaint)" />
      </svg>
    </div>
    <div class="brand-name" id="orbit-brand-title">ORBIT</div>
    <div class="status-pill" id="orbit-status-pill">
      <span class="status-dot"></span>
      <span>System Upgrade</span>
    </div>
    <h1 id="maintenance-title">ORBIT is getting an upgrade.</h1>
    <p id="maintenance-description">Please check back shortly. We're making your experience better.</p>
    <div class="divider"></div>
    <div class="meta-note" id="orbit-maintenance-note">Status 503 &bull; Service will resume automatically</div>
  </main>
</body>
</html>`;
}

/**
 * Express middleware that intercepts all incoming requests when ORBIT_MAINTENANCE_MODE=true:
 * - Allows favicon and manifest assets so the browser tab icon renders cleanly.
 * - Allows a lightweight /health check endpoint so Render/Docker health monitors do not fail.
 * - Returns HTTP 503 JSON for all /api/* routes to strictly protect user data and backend operations.
 * - Returns HTTP 503 HTML with the premium, minimal maintenance page for all page requests.
 */
export function maintenanceMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!isMaintenanceMode()) {
    return next();
  }

  // 1. Allow essential static favicon/manifest assets
  if (ALLOWED_STATIC_PATHS.has(req.path)) {
    return next();
  }

  // 2. Health check probe for container orchestrators (Render, Docker, Kubernetes)
  if (req.path === "/health" || (req.path === "/api/health" && (req.query.probe === "1" || req.headers["user-agent"]?.includes("Render")))) {
    return res.status(200).json({
      status: "ok",
      maintenance: true,
      message: "ORBIT maintenance mode active"
    });
  }

  // Set standard 503 Service Unavailable caching & retry headers
  res.set("Retry-After", "300");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  // 3. Protect all API endpoints with HTTP 503 JSON
  if (req.path.startsWith("/api/")) {
    return res.status(503).json({
      status: 503,
      error: "Service Unavailable",
      maintenance: true,
      message: "ORBIT is getting an upgrade. Please check back shortly. We're making your experience better."
    });
  }

  // 4. Return HTTP 503 HTML with the premium maintenance page for all user/page requests
  return res.status(503).type("html").send(getMaintenanceHtml());
}
