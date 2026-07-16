# 05-01 SUMMARY — Board read-surface + reminder RPC (data door)

**Plan:** 05-01 · **Phase:** 5 · **Requirements:** STAT-02 (board data) + XTRA-02 (reminder)
**Status:** COMPLETE · applied + verified live · **Completed:** 2026-07-16

## What shipped
Migration `staff_app_0010_board_reminder`, applied LIVE to `luillpzfqzbpoqkgvjuw`:
1. `staff_app.offers.reminded_at timestamptz` (nullable) — the exactly-once anchor for XTRA-02.
2. `CREATE OR REPLACE VIEW public.staff_app_offers` — keeps the 0009 columns verbatim and APPENDS `staff_nombre` / `staff_apellido` (join staff_profiles) so the board (STAT-02) shows who each role was offered to. security_invoker; authenticated SELECT, anon revoked.
3. `public.staff_app_offers_due_reminder(p_within_days int DEFAULT 2)` SECURITY DEFINER, pinned search_path — returns offers in the fixed org that are `status IN (sent,viewed)`, `reminded_at IS NULL`, expiring within the window, AND stamps `reminded_at=now()` in the SAME statement (exactly-once). **A1 honored: NO token rotation, NO token_hash write, NO secret generation, NO token returned** — the original magic link stays valid. `service_role` EXECUTE only; anon + authenticated revoked (it mutates + returns PII).

## Evidence (verified live via Supabase MCP)
- Migration applied.
- Board view: for a real offer, `staff_nombre='Prueba'`, `staff_apellido='Envio LABURO'` returned; existing columns/order preserved.
- Reminder exactly-once: first `staff_app_offers_due_reminder(2)` returned the due offer (stamped `reminded_at`); a second call returned 0 (no re-selection).
- Grants: `service_role` EXECUTE = true; anon/authenticated EXECUTE = false; anon SELECT on the view = false; authenticated SELECT = true.
- `get_advisors(security)`: zero new finding class. `staff_app_offers_due_reminder` triggers NO finding; the view has no `security_definer_view` (it is security_invoker).
- Cleanup: transient test offer/gig removed.

## Commits
- `e527d3f` — feat(05-01): staff_app_0010 board view + reminded_at + due-reminder RPC
- `2c61bbe` — test(05-01): re-runnable harness

## Sibling: 05-02 (staff_app_0011) ALSO applied + verified live
`candidate_notes` + `staff_ratings` tables (RLS org-scoped) + security_invoker views + SECURITY DEFINER upsert RPCs (`staff_app_set_candidate_note`, `staff_app_rate_staff`). Harness (DO block) passed: idempotent upserts, score CHECK (1..5, score=6 → `score_out_of_range`), anon isolation (no EXECUTE/SELECT on any object), authenticated read surface present. Advisors: the 2 upsert RPCs under the sanctioned `authenticated_security_definer_function_executable` class; views clean; RLS enabled with policies on both tables. Commits `08ab5b6`/`376c87e`/`6acbd4d`.

## For downstream (Wave 2: 05-03 board, 05-04 notes/rating UI, 05-05 cron)
- Board (05-03): read `public.staff_app_offers` (now has staff_nombre/apellido, gig_title, status, expires_at) grouped by gig; derive covered/pending/open + "vencida" (`now() > expires_at`).
- Notes/rating (05-04): read `public.staff_app_candidate_notes` / `public.staff_app_staff_ratings`; write via `rpc('staff_app_set_candidate_note', {p_staff_profile_id, p_is_favorite, p_note})` and `rpc('staff_app_rate_staff', {p_staff_profile_id, p_gig_id, p_score, p_note})` (authenticated client).
- Cron (05-05): call `rpc('staff_app_offers_due_reminder', {p_within_days})` with the SERVICE-ROLE client (only role granted), send via the honest mailer (no-op until SMTP), exactly-once guaranteed by the RPC.
