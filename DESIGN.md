# Design

## Source of truth

- Status: Draft
- Last refreshed: 2026-06-13
- Primary product surfaces: Auth, Dashboard, Documents, Document Detail, Approvals, Audit, Security, Evidence, Retention, Access Review
- Evidence reviewed: `docs/frontend/FE_DESIGN_SYSTEM.md`, `docs/frontend/FE_COLOR_PALETTE.md`, `apps/web/src/app/globals.css`, `apps/web/src/app/(app)/dashboard/page.tsx`, `apps/web/src/app/(app)/security/page.tsx`

## Brand

- Personality: secure, professional, calm, structured, trustworthy
- Trust signals: clear RBAC visibility, audit-chain posture, metadata-only evidence labels, explicit DLP/retention/access policy states
- Reference boundaries: Dropbox-style dashboard references may inform chart clarity, balanced first-screen layout, compact navigation, and action-forward command areas, but DocVault must keep its own enterprise compliance identity.
- Avoid: Dropbox/Box logo treatment, exact visual composition, consumer file-sharing styling, decorative analytics, fake security metrics, heavy gradients, glossy cards, noisy chart walls

## Product goals

- Goals: present DocVault as an enterprise secure document lifecycle system; make approval, classification, evidence, retention, and security posture easy to scan; keep high-risk actions clear and role-aware
- Non-goals: clone BoxShield branding or exact layouts; replace backend authorization with UI hints; turn every page into a chart dashboard
- Success signals: first viewport explains operational posture, users can identify next action quickly, demo screenshots load data without error states

## Personas and jobs

- Primary personas: viewer, editor, approver, compliance officer, admin
- User jobs: find controlled documents, submit and approve lifecycle changes, inspect audit/security events, export evidence, review access and retention posture
- Key contexts of use: internal governance demo, compliance review, operational work queue, secure document management

## Information architecture

- Primary navigation: left sidebar with role-aware app sections and a compact topbar for identity, theme, and notifications
- Core routes/screens: `/dashboard`, `/documents`, `/documents/new`, `/documents/[id]`, `/approvals`, `/audit`, `/security`, `/evidence`, `/retention`, `/access-review`
- Content hierarchy: page header, first-screen operational summary, detailed work surface, secondary evidence/actions

## Design principles

- Principle 1: every visual summary must answer an operational question
- Principle 2: tables remain the main working surface for investigation-heavy screens
- Principle 3: inspiration from polished SaaS dashboards is acceptable only when translated into DocVault-native compliance workflows
- Principle 4: security-sensitive claims must be backed by metadata, status, or explicit empty/error states
- Principle 5: aggregate charts are role-aware; sensitive, DLP, retention, legal-hold, and security-posture counts are shown only to roles authorized for those domains
- Tradeoffs: sparse charts are preferred over visual density; reusable local primitives are preferred before adding chart dependencies

## Visual language

- Color: light enterprise app background, dark slate sidebar, blue primary actions, restrained status and classification colors
- Typography: Inter/system sans, compact enterprise scale, strong hierarchy without oversized marketing type
- Spacing/layout rhythm: dense but readable app surfaces with clear grids and consistent section spacing
- Shape/radius/elevation: moderate radius, soft borders, light shadows only for interaction or overlays
- Motion: subtle page/card transitions; respect reduced motion
- Imagery/iconography: Lucide icons for app actions and states; no decorative stock imagery in core app surfaces
- Dashboard composition: borrow the reference pattern of a clear command header, one dominant visual score, small adjacent metrics, and compact chart modules; avoid recreating the reference's illustration-led marketing feel.
- Chart mix: combine gauges, metric tiles, donuts, vertical bars, and horizontal progress bars by data shape and permission boundary; avoid repeating the same chart style across every adjacent module.

## Components

- Existing components to reuse: `PageHeader`, `StatusBadge`, `ClassificationBadge`, `EmptyState`, `LoadingState`, `ErrorState`, app shell/sidebar/topbar, data table components
- New/changed components: lightweight analytics primitives for score gauges, segmented donuts, priority bars, mini trends, and metric tiles
- Variants and states: loading, empty, error, success, warning, critical, disabled, role-gated; role-gated charts should be omitted or replaced with safe lifecycle/workflow summaries rather than showing masked sensitive counts
- Token/component ownership: use CSS variables in `apps/web/src/app/globals.css`; keep domain derivation in feature models before rendering

## Accessibility

- Target standard: WCAG 2.1 AA intent for contrast, keyboard reachability, labels, and focus states
- Keyboard/focus behavior: all links and controls remain keyboard reachable with visible focus rings
- Contrast/readability: charts must include text labels and avoid color-only meaning
- Screen-reader semantics: visual summaries need text equivalents and meaningful headings
- Reduced motion and sensory considerations: avoid required motion; preserve `prefers-reduced-motion` behavior

## Responsive behavior

- Supported breakpoints/devices: mobile around 375px, tablet around 768px, desktop around 1440px
- Layout adaptations: command-center summaries stack on mobile; tables keep horizontal overflow where needed
- Touch/hover differences: hover affordances must not be required for core actions

## Interaction states

- Loading: skeletons or explicit loading states for data-backed pages
- Empty: explain what data is missing and what workflow creates it
- Error: show retry and keep navigation shell usable
- Success: use restrained toast/inline feedback for completed actions
- Disabled: explain role, state, or policy gates when the user may expect an action
- Offline/slow network, if applicable: show stale/failed query states without claiming fresh posture

## Content voice

- Tone: concise, operational, compliance-aware
- Terminology: use DocVault terms such as document lifecycle, classification, DLP, retention, audit chain, evidence packet, access review
- Microcopy rules: prefer action-oriented labels; avoid vague security claims without evidence

## Implementation constraints

- Framework/styling system: Next.js App Router, React, TypeScript, Tailwind CSS, CSS variables
- Design-token constraints: reuse `globals.css` tokens before introducing new colors
- Performance constraints: keep dashboard visual primitives lightweight; avoid adding a chart library in the first pass
- Compatibility constraints: preserve RBAC and backend authorization boundaries
- Test/screenshot expectations: focused model tests, typecheck, lint, build, and Playwright screenshots for key pages before final visual claims

## Open questions

- [ ] Should a dedicated chart library be adopted after the first lightweight primitive pass? Owner: frontend maintainer. Impact: maintainability vs dependency surface.
- [ ] Which seeded demo scenario should be the canonical screenshot path for Dashboard and Security? Owner: product/demo maintainer. Impact: screenshot stability.
