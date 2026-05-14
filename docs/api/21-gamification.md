# Gamification API

Base path: `/gamification`

Badges, points, leaderboards, streaks, daily missions, and quizzes.

---

## BADGES

### GET /gamification/badges
List all badge definitions.

**Auth required:** Yes (any role)

**Response 200:**
```json
[
  {
    "id": "uuid",
    "key": "first_steps",
    "name": "First Steps",
    "description": "Welcome — keep learning.",
    "iconKey": "star",
    "pointsValue": 5,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
]
```

---

### POST /gamification/badges
Create a badge definition. **Admin only.**

**Request body:**
```json
{
  "key": "math_wizard",
  "name": "Math Wizard",
  "description": "Scored 100% on a math exam.",
  "iconKey": "calculator",
  "pointsValue": 50
}
```

**Response 201:** Created badge object.

---

### POST /gamification/users/:userId/badges/:badgeId
Award a badge to a user. **Admin, teacher.**

**Response 201:** Created user-badge record.

**Errors:**
- `409` — User already has this badge

---

### GET /gamification/me/badges
Get the authenticated user's earned badges.

**Auth required:** Yes (any role)

**Response 200:**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "badgeId": "uuid",
    "awardedById": null,
    "awardedAt": "2026-04-01T00:00:00.000Z",
    "badge": {
      "id": "uuid",
      "key": "first_steps",
      "name": "First Steps",
      "iconKey": "star",
      "pointsValue": 5
    }
  }
]
```

---

### GET /gamification/me/badge-points
Get the authenticated user's total badge points.

**Auth required:** Yes (any role)

**Response 200:**
```json
{
  "userId": "uuid",
  "totalBadgePoints": 85,
  "badgeCount": 4
}
```

---

### GET /gamification/students/:studentId/badges
Get a student's badges. Accessible by the student, their linked parent, or staff.

**Auth required:** Yes (any role)

---

### GET /gamification/students/:studentId/badge-points
Get a student's total badge points.

---

## LEADERBOARDS

### GET /gamification/leaderboard/exam-average
Leaderboard ranked by average released exam score.

**Auth required:** Yes (any role)

**Query params:**
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| academicYearId | UUID | ✅ | |
| limit | number | ❌ | Default 20, max 100 |

**Response 200:**
```json
{
  "academicYearId": "uuid",
  "metric": "averageReleasedExamScore",
  "filters": { "grade": null, "section": null, "subjectId": null },
  "entries": [
    {
      "rank": 1,
      "studentId": "uuid",
      "averageScore": 94.5,
      "examsCounted": 8,
      "student": {
        "firstName": "Ali",
        "lastName": "Hassan",
        "email": "ali@school.edu",
        "grade": "Grade 9",
        "section": "A"
      }
    }
  ]
}
```

---

### GET /gamification/leaderboard/streaks
Leaderboard ranked by current login streak.

**Query params:** `limit` (default 20, max 100)

**Response 200:**
```json
{
  "metric": "loginStreak",
  "entries": [
    {
      "rank": 1,
      "userId": "uuid",
      "currentStreak": 15,
      "longestStreak": 22,
      "user": { "firstName": "Ali", "lastName": "Hassan", "email": "ali@school.edu", "role": "student" }
    }
  ]
}
```

---

## STREAKS & PROGRESS

### GET /gamification/me/streak
Get the authenticated user's login streak.

**Auth required:** Yes (any role)

**Response 200:**
```json
{
  "userId": "uuid",
  "currentStreak": 7,
  "longestStreak": 15,
  "lastLoginDate": "2026-05-07"
}
```

---

### GET /gamification/me/progress
Get combined gamification progress (streak + XP + level).

**Auth required:** Yes (any role)

**Response 200:**
```json
{
  "userId": "uuid",
  "currentStreak": 7,
  "longestStreak": 15,
  "totalXp": 285,
  "level": 2,
  "levelTitle": "Learner",
  "lastLoginDate": "2026-05-07"
}
```

**Level titles:**
| Level | Title |
|-------|-------|
| 1-4 | Starter |
| 5-9 | Learner |
| 10-14 | Scholar |
| 15-19 | Master |
| 20+ | Legend |

---

## DAILY MISSIONS (Student only)

### GET /gamification/me/missions
List today's daily missions.

**Auth required:** Yes (student)

**Response 200:**
```json
[
  {
    "id": "checkin:2026-05-07",
    "title": "Daily Check-in",
    "description": "Log in and keep your momentum today.",
    "xpReward": 20,
    "isCompleted": true,
    "progressCurrent": 1,
    "progressTarget": 1
  },
  {
    "id": "quick_quiz:2026-05-07",
    "title": "Complete 1 Quick Quiz",
    "description": "Finish one quick quiz in any subject.",
    "xpReward": 40,
    "isCompleted": false,
    "progressCurrent": 0,
    "progressTarget": 1
  }
]
```

---

### POST /gamification/me/missions/:missionId/complete
Mark a mission as completed.

**Auth required:** Yes (student)

**Response 201:**
```json
{
  "xpDelta": 40,
  "newTotalXp": 325,
  "leveledUp": false,
  "newLevel": 3,
  "newAchievementIds": [],
  "newBadgeIds": ["uuid"],
  "leaderboardBeforeRank": 5,
  "leaderboardAfterRank": 4
}
```

---

### GET /gamification/me/team-challenge
Get the current weekly team challenge.

**Auth required:** Yes (student)

**Response 200:**
```json
{
  "id": "team-week-202605",
  "title": "Weekly Class Sprint",
  "objective": "Complete daily missions together this week.",
  "progressCurrent": 240,
  "progressTarget": 1000,
  "contributorCount": 12,
  "endsAt": "2026-05-10T00:00:00.000Z",
  "isJoined": true,
  "myContributionXp": 60
}
```

---

## QUIZZES (Student only)

### GET /gamification/quizzes
List available gamification quizzes for the current student.

**Auth required:** Yes (student)

**Response 200:**
```json
[
  {
    "id": "quiz-uuid",
    "title": "Mathematics Quick Quiz",
    "subjectId": "uuid",
    "subjectName": "Mathematics",
    "chapterId": null,
    "questionCount": 5,
    "xpReward": 50,
    "difficulty": "medium"
  }
]
```

---

### GET /gamification/quizzes/:id
Get quiz detail with questions.

**Auth required:** Yes (student)

**Response 200:**
```json
{
  "id": "quiz-uuid",
  "title": "Mathematics Quick Quiz",
  "subjectId": "uuid",
  "subjectName": "Mathematics",
  "durationMinutes": 10,
  "questions": [
    {
      "id": "q-uuid",
      "text": "What is 2 + 2?",
      "options": ["3", "4", "5", "6"],
      "correctIndex": 1,
      "type": "multipleChoice",
      "pointValue": 1
    }
  ],
  "isCompleted": false,
  "lifecycleState": "published",
  "isTimeLimited": true
}
```

---

### POST /gamification/quizzes/:id/submit
Submit quiz answers.

**Auth required:** Yes (student)

**Request body:**
```json
{
  "answers": {
    "q-uuid1": 1,
    "q-uuid2": 2,
    "q-uuid3": 0
  }
}
```

**Response 201:**
```json
{
  "score": 80.0,
  "correct": 4,
  "total": 5,
  "xpEarned": 60,
  "newTotalXp": 345,
  "leveledUp": false,
  "newLevel": 3
}
```

---

## ACHIEVEMENTS

### GET /gamification/achievements
List all achievement definitions.

**Auth required:** Yes (any role)

### GET /gamification/my-achievements
List the authenticated student's unlocked achievements.

**Auth required:** Yes (student)

### POST /gamification/check-achievements
Check and unlock any new achievements for the authenticated student.

**Auth required:** Yes (student)

**Response 201:**
```json
{
  "newlyUnlocked": [
    { "id": "uuid", "name": "First Exam", "description": "Completed your first exam." }
  ]
}
```

---

## Auto-awarded Badges
These badges are awarded automatically by the system:

| Badge Key | Trigger |
|-----------|---------|
| `first_steps` | Student account created |
| `exam_hero` | Scored ≥ 90% on a released exam |
| `perfect_attendance_week` | Present/late every session in a week |
| `first_graded_exam` | First exam result released |
| `mission_*_YYYY-MM-DD` | Daily mission completed |
| `quiz_reward_*` | Quiz completed |
