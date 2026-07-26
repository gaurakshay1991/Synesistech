# LIVE SYNESIS — Codex implementation brief

## Purpose

Prepare LIVE SYNESIS as a complete enterprise application using the strongest reusable product patterns associated with Sneh Enterprise, while keeping all source, database, deployment and CI work in the existing GitHub-based Synesistech platform. Do not migrate, rebuild, host or deploy the product in Replit.

The current production baseline is the authenticated Neon-backed platform on `main` at commit `56c29c5036d01d72a45075802dfa925e30fa88bb`.

## Non-negotiable constraints

- Preserve the existing private authentication, role controls, encrypted document storage, document analysis, document memory, comparison, grounded Q&A, reports, audit trail, user administration, Neon Postgres persistence, MCP endpoint and Manufact deployment.
- Do not replace working backend behavior with static mock data.
- Do not create a marketing website around an unfinished application. The authenticated product workspace is the primary surface.
- Do not introduce a Replit dependency, Replit database, Replit auth, Replit deployment configuration or Replit-specific environment handling.
- Do not expose secrets, API keys, database URLs, encryption keys or bootstrap credentials in client code, documentation, screenshots or commits.
- The quota-independent deterministic analysis engine must remain usable when external model quota is unavailable. Live-model enrichment should be represented as an optional enhanced mode, not as the only functioning path.

## Product pattern to apply

### 1. Application-first shell

Use one coherent enterprise shell across the entire authenticated product:

- Persistent left navigation on desktop.
- Collapsible drawer navigation on mobile.
- Compact contextual top bar with current page title, matter context and one primary action.
- Stable content width, spacing rhythm and component geometry.
- No conflicting secondary shells or duplicate navigation systems.

### 2. Task-oriented information architecture

Organize the product around work users need to complete rather than around technical features.

Primary navigation:

1. Command Centre
2. New Analysis
3. Documents
4. Compare
5. Administration — administrators only
6. Settings

The document review workspace should remain contextual and open from Documents, Command Centre and search results rather than becoming a disconnected top-level application.

### 3. Command Centre pattern

The home screen should function as an operational dashboard, not a decorative landing page.

Required regions:

- One restrained welcome/priority panel with a clear action.
- Four concise operational metrics.
- Priority matters requiring attention.
- Recently reviewed documents.
- A simple three-step workflow explaining how to start and complete a review.
- Clear empty state for a new organization with zero documents.

Avoid fake metrics, unnecessary charts, decorative bento grids and repeated cards that do not lead to an action.

### 4. Guided workflow pattern

The New Analysis screen should use a guided, confidence-building sequence:

1. Add evidence.
2. Confirm review context.
3. Run analysis.
4. Review processing state.
5. Open the saved decision workspace.

The upload area must support drag-and-drop and file selection. Text entry must remain available. Show supported formats, size limit and privacy treatment. Processing feedback must reflect actual state and must not imply live model use when the deterministic engine is active.

### 5. Decision workspace pattern

The review workspace should be the most complete surface in the product.

Required header:

- Risk score and level.
- Document title, matter, type, jurisdiction and reviewed date.
- Analysis mode badge: `Prototype analysis` or `Live enriched analysis`.
- Reanalyse action for authorised roles.
- Delete action for authorised roles.

Required tabs:

- Overview
- Issues
- Missing protections
- Scenarios
- Regulatory
- Ask Synesis
- Report

Each tab must have a clear empty state. Tabs must not disappear merely because a result array is empty.

### 6. Consistent enterprise component system

Create reusable component families instead of page-specific copies:

- Buttons: primary, secondary, ghost, danger, icon.
- Status badges and risk pills.
- Cards and section headers.
- Metric tiles.
- Search fields and segmented filters.
- Document table rows.
- Form fields and drop zones.
- Empty, loading, error and success states.
- Modal and drawer patterns.
- Toast/notice system.

All controls must have deliberate typography, focus states, disabled states and mobile behavior.

### 7. Visual system

Target a premium institutional product rather than a generic legal-tech template.

- True white or neutral background; do not introduce beige or cream.
- Dark navy/charcoal for primary structure.
- One controlled blue accent.
- Semantic red, amber and green only for status and risk.
- Restrained borders and shadows.
- Moderate radii; avoid excessive pill shapes.
- Clear hierarchy with compact interface typography.
- Generous but efficient spacing suitable for laptop screens.
- Icons must use one consistent family and stroke weight.

### 8. Complete state design

Every data-bearing screen must implement:

- Initial loading state.
- Empty state.
- Error state with actionable recovery.
- Success state.
- Disabled/in-progress state.
- Session-expired behavior.
- API quota unavailable behavior.
- Mobile overflow and long-text handling.

Never display raw server errors, stack traces or provider payloads to users.

## Frontend refactor target

The current `client/src/App.jsx` is too large. Refactor it without changing working behavior.

Suggested structure:

```text
client/src/
  app/
    App.jsx
    routes.js
  components/
    AppShell.jsx
    Sidebar.jsx
    Topbar.jsx
    Button.jsx
    CardHeader.jsx
    EmptyState.jsx
    LoadingState.jsx
    Notice.jsx
    RiskScore.jsx
    RiskPill.jsx
    StatusBadge.jsx
    DocumentTable.jsx
    Modal.jsx
  pages/
    LoginPage.jsx
    PasswordSetupPage.jsx
    DashboardPage.jsx
    NewAnalysisPage.jsx
    DocumentsPage.jsx
    ReviewWorkspacePage.jsx
    ComparePage.jsx
    AdministrationPage.jsx
    SettingsPage.jsx
  features/
    documents/
    analysis/
    decisions/
    users/
    audit/
  lib/
    api.js
    format.js
    download.js
  styles/
    tokens.css
    base.css
    layout.css
    components.css
    pages.css
    print.css
```

The exact folder names may follow existing repository conventions, but the ownership boundaries must be equivalent. Avoid one giant component file.

## API and data behavior

- Keep authenticated requests cookie-based with `credentials: include`.
- Centralize API error parsing and session-expiry handling.
- Preserve Neon-backed persistence as the source of truth.
- Do not duplicate server data into permanent browser-local stores.
- Session storage may retain only transient UI context such as the active document ID or selected tab.
- Preserve organization scoping for all document, user and audit queries.
- Preserve encrypted source text and do not retain original uploaded file bytes unless explicitly implemented later.

## Prototype analysis behavior

The current quota-independent deterministic engine is a valid prototype operating mode.

Required user-facing terminology:

- `Prototype analysis` when deterministic rules are used.
- `Live enriched analysis` when external model reasoning completes.
- `Live enrichment unavailable` when provider quota or credentials prevent model use.

Do not show the earlier message that says the entire analysis is incomplete merely because the external provider is unavailable. Instead:

- Save the deterministic result.
- Clearly identify its mode.
- Preserve assumptions and limitations.
- Permit reanalysis after live enrichment is activated.

## Accessibility and responsive requirements

- Full keyboard navigation.
- Visible focus styles.
- Semantic buttons and labels.
- Dialog focus handling.
- Sufficient contrast.
- No horizontal page overflow at 360 px width.
- Tables must convert to readable stacked rows or controlled horizontal regions on small screens.
- Primary actions must remain reachable without precision tapping.
- Respect `prefers-reduced-motion`.

## Completion gates

Codex should not consider the work complete until all of the following pass:

1. Login with the production-style authenticated flow.
2. Mandatory password change flow.
3. Dashboard load from Neon.
4. New text analysis in prototype mode.
5. New PDF or DOCX upload and text extraction.
6. Saved document visible after refresh.
7. Review workspace tabs render correctly.
8. Document-grounded Q&A returns either live or baseline mode clearly.
9. Decision/comment is saved to the audit trail.
10. Document comparison works with two saved documents.
11. Administration lists users and audit events.
12. Report downloads and print/PDF layout work.
13. Session expiration returns to login cleanly.
14. Mobile navigation and primary workflows work at 360–430 px.
15. `npm run check` passes.
16. Production Docker build passes.
17. `/health`, `/api/health` and `/mcp` remain available.
18. No Replit-specific dependency or configuration is introduced.

## Visual verification workflow

For each major page:

1. Run the application locally or in a preview deployment.
2. Capture desktop at approximately 1440 × 1000.
3. Capture mobile at approximately 390 × 844.
4. Inspect the first viewport, navigation, page hierarchy, loading state, empty state and one populated state.
5. Verify typography, spacing, component consistency, overflow and action clarity.
6. Fix all obvious prototype artifacts before handoff.

## Implementation order

### Phase 1 — Shell and design system

- Extract tokens and reusable components.
- Rebuild shell, sidebar, top bar, notices and responsive navigation.
- Preserve all current routes and behavior.

### Phase 2 — Operational dashboard and documents

- Refine Command Centre.
- Standardize metrics, priority list, recent documents, search and filters.
- Complete empty/loading/error states.

### Phase 3 — New analysis workflow

- Improve upload/context/progress flow.
- Make prototype/live modes explicit and accurate.
- Preserve all file formats and server validation.

### Phase 4 — Review workspace

- Standardize header and tabs.
- Improve issue, protection, scenario, regulatory, assistant and report states.
- Preserve decision and audit workflows.

### Phase 5 — Administration and settings

- Standardize tables, forms, status actions and password flows.
- Confirm role-based visibility.

### Phase 6 — QA and deployment

- Run regression checks.
- Perform browser QA on desktop and mobile.
- Verify Neon persistence, health and MCP.
- Deploy through the existing GitHub → Manufact workflow only.

## Definition of done

The result should feel like one mature institutional product: consistent navigation, complete workflows, reliable states, persistent data, accurate mode labeling and polished responsive behavior. It must remain deployable from GitHub and usable without Replit or funded external AI quota.