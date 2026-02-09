# Rollout: Shift Briefing + Rounds

## 1) Apply DB migrations (Supabase SQL Editor)
Run in this exact order:

1. `/Users/air/Desktop/tec_demo/supabase/2026-02-09-shift-rounds-module.sql`
2. `/Users/air/Desktop/tec_demo/supabase/2026-02-09-shift-rounds-seed.sql`

## 2) Quick smoke test
1. Open `/shift/briefing` as shift chief profile.
2. Set `unit=ktc`, date=today, shift type=day/night.
3. Click `Создать/получить`.
4. Validate assignments list exists; set workplace/presence; save draft.
5. Click `Смена принята, персонал проинструктирован`.
6. Open `/shift/today` as regular employee from same shift.
7. Verify workplace + instructed status are visible.
8. Open `/rounds/today`, click `Начать обход`.
9. In `/rounds/:id`, set check statuses, add comments, upload one file.
10. Click `Отправить`; verify run appears in `/rounds/history`.

## 3) Notes
- `round-files` storage bucket is private.
- RLS limits runs/checks/files to owner profile.
- Dictionaries/plans are read-only for authenticated users via policies.
