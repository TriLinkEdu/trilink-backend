# Database Seeding Guide

## Overview

This directory contains seed scripts to populate the database with test data for the gamification system.

## What Gets Seeded

### Backend Database (Docker PostgreSQL):
- ✅ 1 Academic year (2024-2025)
- ✅ 5 Subjects (Math, Science, English, History, Art)
- ✅ 1 Teacher user
- ✅ 10 Class offerings (2 per subject)
- ✅ 10 Test students
- ✅ 40 Enrollments (each student in 4 classes)

### AI Engine Database (Neon PostgreSQL):
- ✅ Already has 1,060 questions
- ✅ Already has 212 topics
- 🔗 Topics will be linked to backend subjects

## How to Run

### 1. Ensure Backend is Running
```bash
cd /home/sadam/Development/trilink/web/trilink-backend
docker compose up -d
```

### 2. Run the Seed Script
```bash
npm run seed
# or
npx ts-node src/database/seeds/run-seeds.ts
```

### 3. Verify Seeding
```bash
# Check subjects
docker exec trilink-backend-db-1 psql -U trilink -d trilink -c "SELECT COUNT(*) FROM subjects;"

# Check students
docker exec trilink-backend-db-1 psql -U trilink -d trilink -c "SELECT COUNT(*) FROM users WHERE role='student';"

# Check enrollments
docker exec trilink-backend-db-1 psql -U trilink -d trilink -c "SELECT COUNT(*) FROM enrollments;"
```

## Test Credentials

### Teacher:
- Email: `teacher@trilink.edu`
- Password: `Teacher@123`

### Students:
- Email: `student1@trilink.edu` to `student10@trilink.edu`
- Password: `Student1@123` to `Student10@123`
- Grade: 9
- Section: A (students 1-5), B (students 6-10)

## Testing the Quiz System

1. **Login as student:**
   ```bash
   curl -X POST http://localhost:4000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"student1@trilink.edu","password":"Student1@123"}'
   ```

2. **Get available quizzes:**
   ```bash
   curl -X GET http://localhost:4000/api/gamification/quizzes \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
   
   Should return 4 quizzes (Math, Science, English, History)

3. **Get quiz questions:**
   ```bash
   curl -X GET http://localhost:4000/api/gamification/quizzes/quiz-subject-math-uuid \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
   
   Should return questions from AI engine

## Data Structure

### Subjects Created:
```
subject-math-uuid    → Mathematics (MATH)
subject-science-uuid → Science (SCI)
subject-english-uuid → English (ENG)
subject-history-uuid → History (HIST)
subject-art-uuid     → Art (ART)
```

### Class Offerings:
```
class-math-9a    → Math - Grade 9A
class-math-9b    → Math - Grade 9B
class-science-9a → Science - Grade 9A
class-science-9b → Science - Grade 9B
... (10 total)
```

### Enrollments:
- Students 1-5 (Section A) enrolled in: Math 9A, Science 9A, English 9A, History 9A
- Students 6-10 (Section B) enrolled in: Math 9B, Science 9B, English 9B, History 9B

## Troubleshooting

### "Relation does not exist" error:
Make sure migrations have run:
```bash
npm run migration:run
```

### "Duplicate key" error:
Seeds are idempotent (use ON CONFLICT DO NOTHING). Safe to run multiple times.

### No quizzes showing:
1. Check enrollments exist
2. Check subjects exist
3. Check AI engine is running
4. Check AI_SERVICE_URL in .env

### Questions not loading:
1. Verify AI engine is running: `curl http://192.168.100.102:8000/health`
2. Check AI engine has questions: See AI engine database
3. Check backend can reach AI engine: Check logs

## Cleanup

To remove seeded data:
```bash
# Delete enrollments
docker exec trilink-backend-db-1 psql -U trilink -d trilink -c "DELETE FROM enrollments WHERE student_id LIKE 'student-seed-%';"

# Delete students
docker exec trilink-backend-db-1 psql -U trilink -d trilink -c "DELETE FROM users WHERE email LIKE 'student%@trilink.edu';"

# Delete teacher
docker exec trilink-backend-db-1 psql -U trilink -d trilink -c "DELETE FROM users WHERE email = 'teacher@trilink.edu';"

# Delete class offerings
docker exec trilink-backend-db-1 psql -U trilink -d trilink -c "DELETE FROM class_offerings WHERE id LIKE 'class-%';"

# Delete subjects
docker exec trilink-backend-db-1 psql -U trilink -d trilink -c "DELETE FROM subjects WHERE id LIKE 'subject-%';"

# Delete academic year
docker exec trilink-backend-db-1 psql -U trilink -d trilink -c "DELETE FROM academic_years WHERE id = '2024-2025-academic-year';"
```

## Next Steps

After seeding:
1. ✅ Quiz system should work
2. ✅ Students can see quizzes
3. ✅ Questions load from AI engine
4. ⏭️ Continue with Phase 1 Task 4 (Fix N+1 queries)
