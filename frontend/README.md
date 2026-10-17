# FitTrack Community

A fitness-focused social web application where users can log workouts, track personal records, join challenges, view leaderboards, and connect with a community of athletes.

## Tech Stack

**Backend**
- Node.js + Express
- MongoDB + Mongoose
- JWT Authentication
- bcryptjs for password hashing
- Multer for file uploads

**Frontend**
- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Chart.js + react-chartjs-2
- Axios

## Project Structure

```
FitTrack Community/
├── backend/
│   ├── app.js                 # Express entry point
│   ├── config/
│   │   └── env.js            # Environment configuration
│   ├── middleware/
│   │   ├── auth.js           # JWT authentication
│   │   ├── rateLimit.js      # In-memory fixed-window limiter for auth routes
│   │   └── errorHandler.js   # Centralized error handling
│   ├── models/
│   │   ├── User.js           # User schema + embedded reference schema
│   │   ├── Workout.js        # Workout schema (run/gym/yoga) + likes/comments
│   │   ├── Challenge.js      # Challenge schema + member progress
│   │   ├── Group.js          # Community groups
│   │   └── WeightEntry.js    # Weight history for charts
│   ├── routes/
│   │   ├── auth.js           # POST /register, /login, /me, /password, /weight
│   │   ├── workouts.js       # CRUD + PR detection + streak + challenges
│   │   ├── feed.js           # Community feed + likes/comments
│   │   ├── challenges.js     # CRUD + join/leave + progress
│   │   ├── leaderboard.js    # Per-challenge + user leaderboards
│   │   ├── stats.js          # Public profile stats + weight chart data
│   │   ├── users.js          # Directory + public profiles
│   │   ├── settings.js       # Notification/language/units/UPI settings
│   │   └── groups.js         # Group listing
│   ├── utils/
│   │   ├── validators.js     # Input validation + ApiError
│   │   ├── serializers.js    # API response shaping
│   │   ├── streak.js         # Streak calculation + activity map
│   │   ├── pr.js             # Personal record detection
│   │   └── challengeProgress.js # Challenge progress + leaderboards
│   ├── seed/
│   │   ├── data.js           # 8 demo users, 2 groups, 4 challenges
│   │   └── seed.js           # Deterministic seed script
│   ├── tests/
│   │   └── api.test.js       # node:test suite (PR/streak units + API integration)
│   ├── uploads/              # Avatar images
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── app/
│   │   ├── layout.jsx        # Root layout + providers
│   │   ├── page.jsx          # Landing / dashboard
│   │   ├── globals.css       # Tailwind v4 theme tokens
│   │   ├── login/page.jsx
│   │   ├── register/page.jsx
│   │   ├── feed/page.jsx
│   │   ├── workout/log/page.jsx
│   │   ├── challenges/page.jsx
│   │   ├── leaderboard/page.jsx
│   │   ├── profile/[handle]/page.jsx
│   │   └── settings/page.jsx
│   ├── components/
│   │   ├── AppShell.jsx      # Header + mobile tab bar
│   │   ├── HomeView.jsx      # Dashboard (signed in) / Landing (guest)
│   │   ├── FeedParts.jsx     # FeedList + FeedSidebar
│   │   ├── pages.jsx         # FeedPage, LogWorkoutPage, ProfilePage, SettingsPage
│   │   ├── LoginView.jsx
│   │   ├── RequireAuth.jsx
│   │   ├── ui/               # Card, Button, Badge, Avatar, EmptyState, skeletons
│   │   ├── workout/
│   │   │   ├── WorkoutForm.jsx
│   │   │   └── WorkoutCard.jsx
│   │   ├── challenges/
│   │   │   ├── ChallengeGrid.jsx
│   │   │   ├── ChallengesView.jsx
│   │   │   └── CreateChallengeForm.jsx
│   │   ├── leaderboard/
│   │   │   ├── LeaderboardTable.jsx
│   │   │   └── LeaderboardView.jsx
│   │   ├── profile/
│   │   │   ├── WeightChart.jsx
│   │   │   ├── StreakCalendar.jsx
│   │   │   ├── PRList.jsx
│   │   │   ├── WeightLogger.jsx   # Owner-only weight entry form
│   │   │   └── ShareProfileButton.jsx
│   │   └── settings/
│   │       └── SettingsForm.jsx
│   ├── lib/
│   │   ├── api.js            # Centralized Axios client + endpoint map
│   │   ├── auth-context.jsx  # AuthProvider + useAuth hook
│   │   ├── format.js         # Date/number/formatting helpers
│   │   ├── workoutForm.js    # Field definitions + validation + calorie estimation
│   │   ├── toast-context.jsx # Toast notifications
│   │   └── providers.jsx     # Client-side providers
│   ├── package.json
│   └── .env.example
│
└── README.md                 # This file
```

## Installation

### Prerequisites
- Node.js 18+
- A running MongoDB instance (local install or MongoDB Atlas)

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env if needed (MONGODB_URI, JWT_SECRET, etc.)
npm run seed    # Creates 8 demo users + workouts + challenges + groups
node app.js     # Starts on http://localhost:5000
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev     # Starts on http://localhost:3000
```

## MongoDB Setup

The application expects a MongoDB database named `fittrack`.

**Local MongoDB:**
```bash
# Install MongoDB Community Edition
# Start the service (Windows)
net start MongoDB

# Or run directly
mongod --dbpath <path-to-data-folder>
```

**MongoDB Atlas (Cloud):**
1. Create a free cluster at https://cloud.mongodb.com
2. Get the connection string
3. Set `MONGODB_URI` in `backend/.env`

The backend connects to whatever `MONGODB_URI` points at and **requires that database to be reachable** — there is no built-in in-memory fallback. Seed data and API tests therefore both need a running MongoDB. (`mongodb-memory-server` is listed as a dev dependency but is not used by the app or the test suite.)

## Environment Variables

### Backend (`backend/.env`)
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | API server port |
| `MONGODB_URI` | `mongodb://localhost:27017/fittrack` | MongoDB connection string |
| `JWT_SECRET` | `secret` | JWT signing secret (must change in production) |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `CORS_ORIGIN` | `http://localhost:3000` | Comma-separated list of allowed frontend origins (empty = allow any) |
| `UPLOADS_DIR` | `uploads` | Avatar upload directory |
| `MAX_UPLOAD_BYTES` | `5242880` | Max upload size (5 MB) |
| `DEMO_PASSWORD` | `FitTrack@123` | Password for all seeded accounts |
| `NODE_ENV` | `development` | Environment mode |

### Frontend (`frontend/.env.local`)
| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000` | Backend API base URL |

## Seed Data

Run `npm run seed` from the `backend/` directory to populate the database with:

**8 Demo Users** (all share password `FitTrack@123`):
| Name | Handle | Email |
|------|--------|-------|
| Aarav Sharma | aaravfit | aarav@example.com |
| Priya Verma | priyafit | priya@example.com |
| Rohan Mehta | rohanruns | rohan@example.com |
| Ananya Singh | ananyayoga | ananya@example.com |
| Kabir Gupta | kabirgym | kabir@example.com |
| Neha Kapoor | nehafit | neha@example.com |
| Vikram Joshi | vikramactive | vikram@example.com |
| Ishita Rao | ishitafit | ishita@example.com |

**Workout History:** ~12 weeks of generated workouts per user, run through the real PR detector so streaks, PRs, and challenge progress match runtime behavior.

**Weight History:** 9 weight entries per user spread over ~6 months.

**Social Activity:** Likes on ~159 workouts, comments on ~14 workouts.

**4 Challenges:**
- Monsoon 300K Run Club (active, 300 km goal)
- Plank Power 3600 (active, 3,600 seconds goal)
- Yoga Sunrise 1500 (active, 1,500 minutes goal)
- 30-Day Running Challenge (ended, 100 km goal — demonstrates completed state)

**2 Groups:**
- Morning Runners (running)
- Weekend Warriors (fitness)

## API Endpoints

### Health
- `GET /api/health` — Liveness + database connection status

### Authentication
- `POST /api/auth/register` — Register new account
- `POST /api/auth/login` — Login, returns JWT
- `GET /api/auth/me` — Validate token, return user
- `PUT /api/auth/password` — Change password
- `POST /api/auth/weight` — Log weight entry
- `GET /api/auth/weight` — Get weight history
- `POST /api/auth/avatar` — Upload avatar (multipart)

### Workouts
- `POST /api/workouts/create` — Log workout + PR check + streak update
- `GET /api/workouts/my` — Current user's workout history
- `GET /api/workouts/prs/mine` — Current user's PR workouts
- `GET /api/workouts/:id` — Single workout
- `PUT /api/workouts/:id` — Edit workout (re-evaluates PR)
- `DELETE /api/workouts/:id` — Delete workout
- `POST /api/workouts/:id/like` — Toggle like
- `POST /api/workouts/:id/comment` — Add comment

### Feed
- `GET /api/feed/list` — Community feed (paginated, filterable)
- `GET /api/feed/people` — Top athletes for sidebar
- `GET /api/feed/comments/:workoutId` — Comments for a workout
- `GET /api/feed/summary` — Dashboard stats for signed-in user

### Challenges
- `GET /api/challenges/list` — List challenges (filter by status)
- `GET /api/challenges/types` — Supported challenge types
- `POST /api/challenges/create` — Create challenge (auto-joins creator)
- `POST /api/challenges/join` — Join a challenge
- `POST /api/challenges/leave` — Leave a challenge
- `GET /api/challenges/:id` — Single challenge with members
- `GET /api/challenges/mine/list` — Current user's challenges
- `GET /api/challenges/:id/log` — Member's contributing workouts

### Leaderboard
- `GET /api/leaderboard/:challengeId` — Full leaderboard for a challenge
- `GET /api/leaderboard` — Current user's challenge leaderboards

### Stats / Profile
- `GET /api/stats/:handle` — Public profile stats (weight chart, streaks, PRs, activity)
- `GET /api/stats/me/summary` — Dashboard summary for signed-in user

### Users
- `GET /api/users/directory` — Public member directory
- `GET /api/users/me` — Full private profile
- `PUT /api/users/me` — Update profile (name, bio, location, avatar)
- `GET /api/users/:handle` — Lightweight public profile
- `GET /api/users/:handle/workouts` — Public workout history

### Settings
- `GET /api/settings` — Current settings
- `PUT /api/settings` — Update settings (notifications, language, units, UPI ID)

### Groups
- `GET /api/groups/list` — List groups

## Frontend Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page (guests) / Dashboard (signed in) |
| `/login` | Sign in with demo account quick-fill |
| `/register` | Create account |
| `/feed` | Community feed + workout logging form |
| `/workout/log` | Dedicated workout logging page |
| `/challenges` | Challenge grid + create/join |
| `/leaderboard` | Leaderboards for joined challenges |
| `/profile/[handle]` | Public profile with weight chart, streak calendar, PRs |
| `/settings` | Notifications, language, units, UPI ID, password |

## Features Implemented

- **Authentication:** JWT-based, persistent sessions, protected routes, per-IP rate limiting on register/login/password
- **Workout Logging:** Type-specific forms (Run/Gym/Yoga) with live calorie estimation
- **Workout Editing & Deletion:** Edit a logged workout (re-runs PR detection) or delete it (with confirmation); PR flags are replayed against full history so badges/lists stay consistent
- **PR Detection:** Deterministic — longest run, best pace, gym volume/reps/weight, longest yoga session
- **Streaks:** Calculated from workout dates (consecutive days with ≥1 workout)
- **Weight Chart:** Chart.js line chart from real weight history, with an owner-only "log weight" control on the profile
- **Streak Calendar:** 84-day activity heatmap from real data
- **Feed:** Workout cards with likes, comments, PR badges
- **Challenges:** Create/join, progress bars, member leaderboards
- **Leaderboards:** Progress-ranked, responsive table/card layout
- **Profiles:** Public profiles with stats, charts, PR list, share link
- **Settings:** Notifications (4 toggles), language (5), units (2), UPI ID, password
- **Share Profile:** Copy link / native share with clipboard fallback
- **Responsive:** Works at 320px–1920px+, mobile tab bar, collapsible sidebar
- **Accessibility:** Semantic HTML, ARIA labels, focus states, color contrast
- **Loading/Empty/Error States:** Skeletons, empty states, toast notifications

## Demo Credentials

All seeded accounts use the same password:

```
Email: aarav@example.com (or any of the 8 emails above)
Password: FitTrack@123
```

Quick-fill buttons on `/login` for Aarav, Priya, and Rohan.

## Development

```bash
# Backend with auto-reload
cd backend && npm run dev

# Frontend dev server
cd frontend && npm run dev

# Re-seed database
cd backend && npm run seed

# Production build (frontend)
cd frontend && npm run build

# Lint (frontend)
cd frontend && npm run lint
```

## Testing

The backend ships a `node:test` suite (`backend/tests/api.test.js`) that covers:

- **Units:** PR metric detection (run/gym/yoga) and streak calculation (including gaps and future-dated workouts).
- **Integration (in-process HTTP against a real MongoDB):** health, registration/login validation and duplicate checks, password change, workout create with PR detection, PR-flag recompute on edit and delete, ownership enforcement, feed list, comments, challenge create/join/progress, leaderboards (including ended challenges), public profile stats, and settings persistence.

```bash
cd backend

# Requires a reachable MongoDB. Set MONGO_TEST_URI to override the default.
# The suite drops and recreates ONLY the target test database.
npm test
# default target: mongodb://localhost:27017/fittrack_test
# override example:
#   set MONGO_TEST_URI=mongodb://localhost:27017/fittrack_test   (Windows)
#   MONGO_TEST_URI=mongodb://localhost:27017/fittrack_test npm test   (bash)
```

> Note: `npm test` uses a dedicated database (`fittrack_test`) and drops it before running, so it never touches the main `fittrack` database or your seeded data.

## Design System

Tailwind v4 `@theme` tokens in `frontend/app/globals.css`:
- Canvas: `#f4f4ef`
- Ink: `#111310`
- Accent (lime): `#d7f24b`
- Type accents: Run `#2f6bff`, Gym `#ff5a3c`, Yoga `#7c5cff`
- Black CTA buttons, no gradients, consistent 14px card radius

## Security

- Passwords hashed with bcryptjs (10 rounds)
- JWT tokens with 7-day expiry
- CORS restricted to configured origin
- Input validation on all endpoints
- Rate limiting on authentication endpoints (fixed-window, per IP)
- No password hashes exposed in API responses
- Authorization checks on all mutating operations
- Helmet-style headers (x-powered-by disabled)

## License

MIT