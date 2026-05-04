# Stage 9 — Final Verification on Vercel

> **Loaded by**: orchestrator (Opus runs WebFetch / Playwright verification directly).
>
> **Source of truth**: this is the canonical text for Stage 9. The summary in `SKILL.md` is a stub that points here.

### Stage 9: Final Verification on Vercel

After deploying, verify all live sites:
- Default mode: A, B, AND C
- `--skip-c` mode: A AND B only (skip C verification entirely)

1. Use `WebFetch` on each deployed URL to confirm the sites load correctly (check for 200 status, real content in the HTML)
2. Check that key content is present on each (business name, phone number, nav links, **all social links from the manifest**)
3. Verify B visually matches A — fetch both homepages, confirm the same logo references, the same nav structure, the same image references, the same components. Differences should be limited to text content. Any structural divergence is a bug.
4. **If `$SKIP_C != 1`**: verify Option C specifically includes imagery — if the homepage has no `<img>` tags or `background-image:` references, Option C's Rule 1 was violated and must be fixed before the build is accepted. **If `$SKIP_C = 1`**: skip C verification entirely.
5. Do NOT use `preview_*` / `Chrome` MCP tools (visible browser windows). Use WebFetch for HTML verification, OR a one-off Playwright script in `/tmp/` if you want to screenshot a deployed URL — Playwright is fine because it's headless.
