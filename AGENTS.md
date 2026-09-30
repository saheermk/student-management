You are building the Student Management System described in SRS.md.

1. Read SRS.md before every task. Do not invent features beyond it.
2. Work on ONE phase at a time. Stop after finishing it and summarize.
3. Stack is fixed: Hono + TypeScript on Cloudflare Workers, D1 + Drizzle,
   R2, React + Vite + Tailwind, Zod, Vitest. Do not add other frameworks
   or databases. Ask before adding any new dependency.
4. Every API route must use auth + role middleware. Access scope
   (student = own data, teacher = own classes, fees = admin only) must
   be enforced on the server, in shared helpers, not repeated ad hoc.
5. Use Drizzle migrations for every schema change. Never edit the
   database by hand.
6. Validate all input with Zod schemas from src/shared.
7. Never hardcode secrets. Use Wrangler secrets and .dev.vars (gitignored).
8. Write tests for permissions first (who can/cannot access what),
   then for business logic.
9. Light/white theme by default with clean, crisp contrast. Mobile, tablet, desktop, and every device optimized and fully responsive. Use modern Floating Label form design (animated floating labels that transition to the top on focus/input) with smooth micro-interactions, clean focus rings, and zero static outdated placeholders. Keep components simple, accessible, and consistent.
10. Before saying a phase is done: run typecheck, tests, and the local
    dev server, and list what you verified.
11. If a requirement is unclear or listed as an assumption, ask me
    instead of guessing.
12. Keep commits small with clear messages.
13. Never use emojis or emoticons as icons in the UI. Use clean SVG icons instead.
14. Write comprehensive documentation alongside the code (in README/docs and inline JSDoc/comments where appropriate). Do not miss any details regarding architectural decisions, API endpoints, environment setup, database schema, or verification steps.
15. All password fields across all forms must include an interactive SVG show/hide password toggle button.
16. Strict Server-Side Endpoint Authorization: Every API endpoint, URL route, HTTP method, and query parameter (especially for destructive or administrative actions like DELETE, PATCH, POST, class deletion, fee modifications, user management) MUST explicitly validate on the server who is authorized to perform that activity using auth and role middleware (requireRole). Never rely on client-side UI visibility or URL hiding for access control.


