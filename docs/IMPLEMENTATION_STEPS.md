# Backend implementation steps (git commits)

Use these **commit messages** to keep history readable. Each step is one atomic change set.

## Commit 1 — `docs: add stepped implementation plan`

- This file: `docs/IMPLEMENTATION_STEPS.md` (overview only, or fold into commit 2).

## Commit 2 — `feat(exams): maxPoints, auto-grade, breakdown, CSV exports, result access`

- **Entities:** `Exam.maxPoints` (default 100); `ExamAttempt` — `autoScore`, `breakdownJson`, `needsManualGrading`.
- **Submit:** proportional auto-score for `mcq` / `true_false` vs `answerKey`; `needsManualGrading` when non-auto questions exist.
- **Grade:** teacher score clamped to `0..exam.maxPoints`.
- **Result:** `GET /attempts/:id/result` takes viewer; student / linked parent / teacher / admin.
- **CSV:** `GET /exams/:id/results/export?format=csv`, `GET /attempts/:id/export?format=csv`.
- **PATCH** `PATCH /exams/:id` body `{ maxPoints }`.
- **Module:** register `ParentStudent` for access checks.

## Commit 3 — `feat(attendance): notify linked parents when marks are saved`

- After `PUT .../attendance-sessions/:id/marks`, create in-app **notifications** for each parent linked to students in that payload.

## Commit 4 — `feat(chat): parent read access when parentVisible and child is member`

- Parents list/read threads where `parentVisible` and a **linked child** is a member (posting still requires membership).

## Commit 5 — `feat(ai): stub integration endpoints with Swagger`

- `AiModule`: `GET /ai/health`, `GET /ai/students/:id/recommendations`, `GET /ai/students/:id/learning-path`, `POST /ai/feedback-assistant` — mock JSON until external service exists.
- `main.ts` Swagger tag **AI (stub)**.

---

**Production:** if `synchronize` is false, add a migration for new columns on `exams` and `exam_attempts`.

**Quick sequence (squashed locally if you prefer):**

```bash
git add docs/IMPLEMENTATION_STEPS.md && git commit -m "docs: stepped implementation plan"
git add src/modules/exams src/modules/parent-students/entities/parent-student.entity.ts && git commit -m "feat(exams): maxPoints, auto-grade, breakdown, CSV exports, result access"
# (parent-student entity only if touched — usually only exams paths)
git add src/modules/attendance && git commit -m "feat(attendance): notify linked parents when marks are saved"
git add src/modules/chat && git commit -m "feat(chat): parent read access when parentVisible and child is member"
git add src/modules/ai src/app.module.ts src/main.ts && git commit -m "feat(ai): stub integration endpoints with Swagger"
```

Adjust `git add` paths to match your working tree (`git status`).

## Commit 6 — `feat(exams): grader queue, for-grader detail, exam notifications`

- **`GET /exams/:id/attempts`** — staff: list attempts (grading queue).
- **`GET /attempts/:id/for-grader`** — staff: answers + breakdown + student info (unreleased OK).
- **On submit:** in-app notification to **exam creator** (`createdById`) for new submission.
- **On first release:** notifications to **student** and each **linked parent** (`exam_result`).
