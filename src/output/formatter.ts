import { ValidatedHandover } from "../types";

export function renderHtmlHandover(
  validated: ValidatedHandover,
  hotelName: string,
  shiftDate: string
): string {
  const urgentStmts = validated.validated.filter((s) => s.priority === "urgent");
  const pendingStmts = validated.validated.filter((s) => s.priority === "pending");
  const fyiStmts = validated.validated.filter((s) => s.priority === "fyi");
  const rejectedCount = validated.rejected.length;

  const urgentHtml = urgentStmts.length > 0
    ? urgentStmts.map(renderStatementCard).join("")
    : `<div class="empty-state">No urgent items for this shift.</div>`;

  const pendingHtml = pendingStmts.length > 0
    ? pendingStmts.map(renderStatementCard).join("")
    : `<div class="empty-state">No pending items to resolve.</div>`;

  const fyiHtml = fyiStmts.length > 0
    ? fyiStmts.map(renderStatementCard).join("")
    : `<div class="empty-state">No FYI items to review.</div>`;

  const flagsHtml = validated.flags.length > 0
    ? validated.flags.map(renderFlagCard).join("")
    : `<div class="empty-state green">All clear. No operational contradictions or suspicious inputs detected.</div>`;

  const stats = {
    urgent: urgentStmts.length,
    pending: pendingStmts.length,
    fyi: fyiStmts.length,
    flags: validated.flags.length,
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Night-Shift Handover — ${hotelName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient: linear-gradient(135deg, #0b0d19 0%, #151a30 100%);
      --glass-bg: rgba(255, 255, 255, 0.03);
      --glass-border: rgba(255, 255, 255, 0.06);
      --glass-border-focus: rgba(255, 255, 255, 0.12);
      
      --color-urgent: #ff5b5b;
      --color-urgent-glow: rgba(255, 91, 91, 0.15);
      --color-pending: #ffb84d;
      --color-pending-glow: rgba(255, 184, 77, 0.15);
      --color-fyi: #4d94ff;
      --color-fyi-glow: rgba(77, 148, 255, 0.15);
      --color-flag: #ff477e;
      
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --font-outfit: 'Outfit', sans-serif;
      --font-pjs: 'Plus Jakarta Sans', sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background: var(--bg-gradient);
      color: var(--text-main);
      font-family: var(--font-pjs);
      min-height: 100vh;
      padding: 2.5rem 1.5rem;
      display: flex;
      justify-content: center;
      overflow-x: hidden;
    }

    .container {
      width: 100%;
      max-width: 1200px;
      display: flex;
      flex-direction: column;
      gap: 2rem;
      animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(15px); }
      to { opacity: 1; transform: translateY(0); }
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1.5rem;
      border-bottom: 1px solid var(--glass-border);
      padding-bottom: 2rem;
    }

    .brand-section h1 {
      font-family: var(--font-outfit);
      font-size: 2.5rem;
      font-weight: 800;
      background: linear-gradient(90deg, #ffffff 0%, #b2c0f9 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
    }

    .brand-section p {
      font-size: 0.95rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }

    .meta-badge {
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      padding: 0.75rem 1.5rem;
      border-radius: 100px;
      font-family: var(--font-outfit);
      font-weight: 600;
      font-size: 0.95rem;
      color: #b2c0f9;
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    /* Stats Dashboard */
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
    }

    .stat-card {
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      padding: 1.5rem;
      border-radius: 20px;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      position: relative;
      overflow: hidden;
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
    }

    .stat-card.urgent::before { background: var(--color-urgent); }
    .stat-card.pending::before { background: var(--color-pending); }
    .stat-card.fyi::before { background: var(--color-fyi); }
    .stat-card.flags::before { background: var(--color-flag); }

    .stat-card:hover {
      transform: translateY(-4px);
      border-color: var(--glass-border-focus);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }

    .stat-label {
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
    }

    .stat-value {
      font-family: var(--font-outfit);
      font-size: 2.25rem;
      font-weight: 800;
      line-height: 1;
    }

    .stat-card.urgent .stat-value { color: var(--color-urgent); }
    .stat-card.pending .stat-value { color: var(--color-pending); }
    .stat-card.fyi .stat-value { color: var(--color-fyi); }
    .stat-card.flags .stat-value { color: var(--color-flag); }

    /* Layout Sections */
    .sections-wrapper {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 2rem;
    }

    @media (max-width: 992px) {
      .sections-wrapper {
        grid-template-columns: 1fr;
      }
    }

    .main-column {
      display: flex;
      flex-direction: column;
      gap: 2.5rem;
    }

    .side-column {
      display: flex;
      flex-direction: column;
      gap: 2.5rem;
    }

    section {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .section-title {
      font-family: var(--font-outfit);
      font-size: 1.4rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--glass-border);
    }

    .section-title .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }

    .urgent .section-title .dot { background: var(--color-urgent); box-shadow: 0 0 10px var(--color-urgent); }
    .pending .section-title .dot { background: var(--color-pending); box-shadow: 0 0 10px var(--color-pending); }
    .fyi .section-title .dot { background: var(--color-fyi); box-shadow: 0 0 10px var(--color-fyi); }
    .flags-section .section-title .dot { background: var(--color-flag); box-shadow: 0 0 10px var(--color-flag); }

    /* Statement / Flag Cards */
    .cards-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .card {
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      transition: all 0.25s ease;
      position: relative;
    }

    .card:hover {
      border-color: var(--glass-border-focus);
      background: rgba(255, 255, 255, 0.05);
      transform: translateX(4px);
    }

    .card.urgent-card {
      border-left: 3px solid var(--color-urgent);
      box-shadow: inset 0 0 12px var(--color-urgent-glow);
    }

    .card.pending-card {
      border-left: 3px solid var(--color-pending);
      box-shadow: inset 0 0 12px var(--color-pending-glow);
    }

    .card.fyi-card {
      border-left: 3px solid var(--color-fyi);
      box-shadow: inset 0 0 12px var(--color-fyi-glow);
    }

    .card.flag-card {
      border-left: 3px solid var(--color-flag);
      background: rgba(255, 71, 126, 0.02);
    }

    .card-text {
      font-size: 1rem;
      line-height: 1.6;
      color: #e5e7eb;
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 0.25rem;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(255, 255, 255, 0.04);
    }

    .badge-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .status-badge {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }

    .still_open-badge { background: rgba(255, 91, 91, 0.12); color: #ff8080; border: 1px solid rgba(255, 91, 91, 0.2); }
    .newly_resolved-badge { background: rgba(52, 211, 153, 0.12); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.2); }
    .new_tonight-badge { background: rgba(96, 165, 250, 0.12); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.2); }

    .flag-type-badge {
      background: rgba(255, 71, 126, 0.12);
      color: #ff6694;
      border: 1px solid rgba(255, 71, 126, 0.2);
    }

    .citation-badge {
      font-family: var(--font-outfit);
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--glass-border);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .citation-badge:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .empty-state {
      background: rgba(255, 255, 255, 0.01);
      border: 1px dashed var(--glass-border);
      border-radius: 12px;
      padding: 2.5rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.95rem;
    }

    .empty-state.green {
      border-color: rgba(52, 211, 153, 0.2);
      color: #a7f3d0;
      background: rgba(52, 211, 153, 0.01);
    }

    /* Warning banner */
    .validation-warning {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 1rem 1.5rem;
      border-radius: 12px;
      color: #fca5a5;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .validation-warning svg {
      flex-shrink: 0;
      color: #ef4444;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand-section">
        <h1>Night-Shift Handover</h1>
        <p>${hotelName} • Front Desk Operations</p>
      </div>
      <div class="meta-badge">
        Shift Start: ${shiftDate}
      </div>
    </header>

    <div class="dashboard-grid">
      <div class="stat-card urgent">
        <span class="stat-label">Urgent Actions</span>
        <span class="stat-value">${stats.urgent}</span>
      </div>
      <div class="stat-card pending">
        <span class="stat-label">Pending Follow-up</span>
        <span class="stat-value">${stats.pending}</span>
      </div>
      <div class="stat-card fyi">
        <span class="stat-label">FYI / Completed</span>
        <span class="stat-value">${stats.fyi}</span>
      </div>
      <div class="stat-card flags">
        <span class="stat-label">Attention Flags</span>
        <span class="stat-value">${stats.flags}</span>
      </div>
    </div>

    ${rejectedCount > 0 ? `
      <div class="validation-warning">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span><strong>Grounding Alert:</strong> ${rejectedCount} statement(s) generated by the LLM were rejected by the grounding validator due to phantom citations and filtered for security.</span>
      </div>
    ` : ""}

    <div class="sections-wrapper">
      <div class="main-column">
        <section class="urgent">
          <h2 class="section-title"><span class="dot"></span>Urgent Actions First</h2>
          <div class="cards-list">
            ${urgentHtml}
          </div>
        </section>

        <section class="pending">
          <h2 class="section-title"><span class="dot"></span>Pending & Under Investigation</h2>
          <div class="cards-list">
            ${pendingHtml}
          </div>
        </section>

        <section class="fyi">
          <h2 class="section-title"><span class="dot"></span>For Awareness (FYI)</h2>
          <div class="cards-list">
            ${fyiHtml}
          </div>
        </section>
      </div>

      <div class="side-column">
        <section class="flags-section">
          <h2 class="section-title"><span class="dot"></span>System Flags & Warnings</h2>
          <div class="cards-list">
            ${flagsHtml}
          </div>
        </section>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function renderStatementCard(stmt: any): string {
  const statusLabels: Record<string, string> = {
    still_open: "Still Open",
    newly_resolved: "Newly Resolved",
    new_tonight: "New Tonight",
  };
  const label = statusLabels[stmt.status] || stmt.status;
  
  const citationBadges = stmt.sourceEventIds
    .map((id: string) => `<span class="citation-badge">${id}</span>`)
    .join(" ");

  return `
    <div class="card ${stmt.priority}-card">
      <div class="card-text">${escapeHtml(stmt.text)}</div>
      <div class="card-footer">
        <span class="status-badge ${stmt.status}-badge">${label}</span>
        <div class="badge-group">
          ${citationBadges}
        </div>
      </div>
    </div>`;
}

function renderFlagCard(flag: any): string {
  const flagLabels: Record<string, string> = {
    contradiction: "Contradiction",
    incomplete: "Incomplete",
    ungrounded: "Ungrounded",
    suspicious_input: "Suspicious Input",
  };
  const label = flagLabels[flag.flagType] || flag.flagType;

  const citationBadges = flag.sourceEventIds
    .map((id: string) => `<span class="citation-badge">${id}</span>`)
    .join(" ");

  return `
    <div class="card flag-card">
      <div class="card-text"><strong>${label}:</strong> ${escapeHtml(flag.issue)}</div>
      <div class="card-footer">
        <span class="status-badge flag-type-badge">${label}</span>
        <div class="badge-group">
          ${citationBadges}
        </div>
      </div>
    </div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatHandover(
  validated: ValidatedHandover,
  formatType: "json" | "html",
  hotelName: string,
  shiftDate: string
): any {
  if (formatType === "html") {
    return renderHtmlHandover(validated, hotelName, shiftDate);
  }
  return validated;
}
