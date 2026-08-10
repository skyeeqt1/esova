# E-SOVA (Electronic Student Online Voting Application) - Complete System Overview

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [System Architecture](#system-architecture)
4. [Application Structure](#application-structure)
5. [Configuration & Backend Services](#configuration--backend-services)
6. [Database Schema](#database-schema)
7. [Screens & Navigation](#screens--navigation)
8. [Key Features](#key-features)
9. [Admin Components](#admin-components)
10. [API Keys & Credentials](#api-keys--credentials)
11. [Installation & Running](#installation--running)

---

## Project Overview

**E-SOVA** is a mobile voting application built with React Native/Expo designed for student elections. It provides a secure and efficient way to conduct electronic voting with real-time results, candidate management, and administrative controls.

- **Project Name**: ESOVA
- **Version**: 1.0.0
- **Platform**: Mobile (iOS/Android) with Expo
- **Primary Use**: Student government elections
- **Supported Positions**: President, VP (Vice President), Secretary, Treasurer

---

## Technology Stack

### Frontend
- **Framework**: React Native 0.81.5
- **Platform**: Expo SDK 54
- **Language**: TypeScript
- **UI Library**: React Native
- **Navigation**: React Navigation 7.x (Native Stack)
- **Styling**: Tailwind CSS 3.4 + NativeWind 4.2

### Backend Services
- **Database**: Supabase Postgres (NoSQL-style JSONB documents)
- **Storage**: Supabase Storage (candidate images)
- **Auth**: Supabase Auth (admin sessions); voter credentials validated against salted hashes in the `users` table

### Key Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| expo | ^54.0.0 | Development framework |
| react-native | 0.81.5 | Mobile framework |
| firebase | n/a | Removed (Supabase only) |
| firebase-admin | n/a | Removed (server-side only, must never ship in client bundles) |
| @supabase/supabase-js | ^2.93.3 | Supabase client |
| react-native-svg | 15.12.1 | SVG rendering |
| react-native-chart-kit | ^6.12.0 | Charts for voting results |
| react-native-reanimated | ~4.1.1 | Animations |
| react-native-safe-area-context | ~5.6.0 | Safe area handling |
| react-native-screens | ~4.16.0 | Native screens |
| expo-image-picker | ~17.0.10 | Image selection |
| expo-document-picker | ~14.0.8 | Document selection |
| expo-file-system | ~19.0.21 | File operations |
| expo-print | ~15.0.8 | Printing support |
| expo-sharing | ~14.0.8 | Sharing functionality |
| expo-crypto | ~15.0.x | Password hashing |
| expo-clipboard | ~8.x | Clipboard access |
| papaparse | ^5.5.3 | CSV parsing |
| base64-arraybuffer | ^1.0.2 | Base64 encoding |

### Development Tools
- **Linting**: ESLint 9.25.1 + Prettier 3.2.5
- **TypeScript**: 5.9.2
- **Build Tool**: Metro Bundler
- **Testing**: Not configured

---

## System Architecture

### Multi-Service Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    E-SOVA Mobile App                    │
├─────────────────────────────────────────────────────────┤
│  Screens:                                               │
│  ├── LoginScreen (Authentication)                       │
│  ├── AdminDashboard (Election Management)              │
│  ├── VoterScreen (Voting Interface)                    │
│  └── ChangePasswordScreen (First Login)                │
├─────────────────────────────────────────────────────────┤
│  Components (Admin):                                     │
│  ├── OverviewSection (Statistics & Controls)           │
│  ├── CandidateSection (Manage Candidates)              │
│  ├── VoterSection (Manage Voters)                      │
│  └── AdminLogsSection (Audit Logs)                      │
├─────────────────────────────────────────────────────────┤
│  Navigation: React Navigation Native Stack              │
├─────────────────────────────────────────────────────────┤
│                    Backend Services                      │
├──────────────────┬──────────────────┬───────────────────┤
│    Supabase      │    Supabase      │      Local        │
│  ┌────────────┐ │ ┌────────────┐  │ ┌───────────────┐  │
│  │ Postgres   │ │ │ Storage    │  │ │ CSV Import    │  │
│  │ Realtime   │ │ │ (Images)   │  │ │ (PapaParse)   │  │
│  │ Auth       │ │ └────────────┘  │ └───────────────┘  │
│  └────────────┘ │                  │                    │
└──────────────────┴──────────────────┴───────────────────┘
```

---

## Application Structure

```
SOVA-current/
├── App.tsx                          # Main app entry point
├── app.json                         # Expo configuration
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
├── tailwind.config.js               # Tailwind config
├── metro.config.js                  # Metro bundler config
├── babel.config.js                  # Babel config
├── eslint.config.js                 # ESLint config
├── prettier.config.js               # Prettier config
├── global.css                       # Global styles
├── nativewind-env.d.ts              # NativeWind types
│
├── assets/                          # Static assets
│   ├── icon.png                     # App icon
│   ├── adaptive-icon.png            # Adaptive icon
│   ├── favicon.png                  # Web favicon
│   └── splash.png                   # Splash screen
│
├── src/
│   ├── config/
│   │   └── supabase.ts               # Supabase configuration
│   │
│   ├── utils/
│   │   └── password.ts               # Password hashing (expo-crypto)
│   │
│   ├── screens/
│   │   ├── LoginScreen.tsx           # User authentication
│   │   ├── AdminDashboard.tsx        # Admin control panel
│   │   ├── VoterScreen.tsx           # Voting interface
│   │   └── ChangePasswordScreen.tsx  # First-time password change
│   │
│   ├── components/
│   │   └── admin/
│   │       ├── AdminLogsSection.tsx  # Admin audit logs
│   │       ├── CandidateSection.tsx  # Candidate management
│   │       ├── OverviewSection.tsx   # Dashboard overview
│   │       └── VoterSection.tsx      # Voter management
│   │
│   ├── hooks/
│   │   └── useAdminData.ts           # Admin data hook
│   │
│   ├── assets/
│   │   └── logo.png                  # App logo
│   │
│   └── types/
└── components/                       # Shared components
    ├── Container.tsx
    ├── EditScreenInfo.tsx
    └── ScreenContent.tsx
```

---

## Configuration & Backend Services

> **⚠️ SECURITY NOTICE**
> Live API keys and credentials were previously committed to this repository. They
> have been scrubbed from this document. If you forked or cloned this project before
> this cleanup, treat all previously exposed keys as compromised and rotate them:
> - Supabase: rotate the anon key in the Supabase dashboard
> - Firebase: rotate/disable the old Firebase project credentials
>
> The project now uses **Supabase only** (client can be configured via `.env`).
> See `.env.example` for the required variables. Never commit `.env` or service keys.

### Supabase Configuration
- The live Supabase client config is loaded from the environment in `src/config/supabase.ts`.
- Copy `.env.example` to `.env` and fill in your own `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`.
- Storage bucket used by the app: `candidate-images` (defined in `src/config/supabase.ts`).

---

## Database Schema

### Firestore Collections

#### 1. `users` Collection
Stores voter and admin user accounts.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Record ID (matches admin Supabase Auth UID when applicable) |
| `name` | string | Full name of the voter |
| `email` | string | User email address |
| `student_id` | string | Unique student identification number |
| `role` | string | User role: `"voter"` or `"admin"` |
| `has_voted` | boolean | Whether the user has submitted their ballot |
| `ballot` | object/null | Completed ballot (JSON object with position votes) |
| `voted_at` | timestamp/null | When the user cast their vote |
| `password` | string | Salted hash (`salt$hash`) — never plain text |
| `must_change_password` | boolean | Forces password change on first login |

#### 2. `candidates` Collection
Stores all candidates running for office.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated document ID |
| `name` | string | Candidate's full name |
| `position` | string | Position contested: `"President"`, `"VP"`, `"Secretary"`, `"Treasurer"` |
| `votes` | integer | Current vote count |
| `image` | string (optional) | URL to candidate's photo (stored in Supabase) |
| `course` | string | Candidate's course/degree |
| `year` | string | Candidate's year level (e.g., "1st Year", "2nd Year") |
| `block` | string | Candidate's block/section |
| `age` | string | Candidate's age |
| `gender` | string | Candidate's gender |
| `background` | string | Candidate's platform/statement |

#### 3. `admin_logs` Collection
Audit trail for administrative actions.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Record ID |
| `action` | string | Action type: `"DELETE_VOTER"`, `"RESET_ELECTION"`, etc. |
| `target_name` | string | Name of the affected entity |
| `target_id` | string | ID of the affected entity |
| `reason` | string | Admin-provided reason for the action |
| `admin_email` | string | Email of the admin who performed the action |
| `timestamp` | timestamp | When the action occurred |

#### 4. `settings` Collection
Election configuration and control settings.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Document ID (use `"election_control"`) |
| `status` | string | Election status: `"started"` or `"stopped"` |
| `endTime` | timestamp | When the election ends |

### Database Relationships
```
users ────────> candidates (via ballot)
   │
   └──> admin_logs (admins perform actions)
   
settings ────> voting (controls election status)
```

---

## Screens & Navigation

### Navigation Structure
The app uses React Navigation Native Stack with the following flow:

```
LoginScreen
    │
    ├── [Admin Role] ──> AdminDashboard
    │                        │
    │                        ├── OverviewSection (default)
    │                        ├── CandidateSection
    │                        ├── VoterSection
    │                        └── AdminLogsSection
    │
    └── [Voter Role] ──> VoterScreen ──> VoterProfile
```

### Screen Details

#### 1. LoginScreen (`src/screens/LoginScreen.tsx`)
- Authentication: admins via Supabase Auth, voters via hashed credential lookup in `users`
- Email/Student ID + password login
- Failed attempt tracking with lockout protection
- Role-based routing (admin vs voter)
- Features:
  - Input validation
  - Loading states
  - Lockout mechanism after failed attempts
  - Navigation to appropriate screen based on role

#### 2. AdminDashboard (`src/screens/AdminDashboard.tsx`)
- Main admin control panel
- Navigation tabs: Overview, Candidates, Voters, Logs
- Features:
  - Election statistics
  - Real-time vote monitoring
  - Candidate management
  - Voter management
  - Audit log viewing
  - Logout functionality
- Theme: Dark mode with green (#00b894) accents
- Logo: ESCR (logo.png in src/assets)

#### 3. VoterScreen (`src/screens/VoterScreen.tsx`)
- Main voting interface for voters
- Features:
  - View candidates by position
  - Cast votes for each position
  - Submit ballot
  - View voting status
  - Check if already voted

#### 4. ChangePasswordScreen (`src/screens/ChangePasswordScreen.tsx`)
- First-login password change flow
- Passwords are stored as salted hashes (never plain text)

#### 4. VoterProfile (`src/screens/VoterProfile.tsx`)
- (Previously planned profile screen — not present in the current codebase)

---

## Key Features

### Authentication
- Admin login via Supabase Auth
- Voter login via salted-hash password lookup in the `users` table
- Role-based access control (admin/voter)
- Account lockout after failed attempts (client-side)
- Passwords hashed with sha256 + salt (expo-crypto) — never plain text

### Voting System
- One vote per user (has_voted flag)
- Multi-position voting (President, VP, Secretary, Treasurer + custom positions)
- Ballot tracking with timestamps
- Vote confirmation
- Atomic vote casting via `cast_vote` RPC (with fallback path)

### Admin Capabilities
1. **Overview Section**
   - Total voters count
   - Total candidates count
   - Vote statistics by position
   - Visual charts

2. **Candidate Management**
   - Add/Edit/Delete candidates
   - Upload candidate photos
   - Set candidate platforms
   - Track vote counts

3. **Voter Management**
   - View all voters
   - Delete voters
   - Reset votes
   - Import voters via CSV

4. **Audit Logging**
   - Track all admin actions
   - Record action types, targets, reasons
   - Timestamp all operations

### Data Import
- CSV import for bulk voter registration
- Script-based user import capability

---

## Admin Components

### OverviewSection (`src/components/admin/OverviewSection.tsx`)
- Displays election statistics
- Charts for vote distribution
- Summary cards for quick stats
- Real-time data updates

### CandidateSection (`src/components/admin/CandidateSection.tsx`)
- CRUD operations for candidates
- Image upload functionality
- Position-based filtering
- Vote count display
- Candidate details (name, course, year, block, etc.)

### VoterSection (`src/components/admin/VoterSection.tsx`)
- List all registered voters
- Search/filter voters
- Delete voter functionality
- View voter details and voting status

### AdminLogsSection (`src/components/admin/AdminLogsSection.tsx`)
- Display audit trail
- Action history with timestamps
- Filter by action type
- Admin accountability tracking

---

## API Keys & Credentials

> **⚠️ SECURITY NOTICE**
> All live credentials have been removed from this document. Configure the app via
> local environment variables only (see `.env.example`).

### Supabase (Client-Side)
- Stored in `.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`
- Never commit real keys to the repository.

### Firebase
- Firebase is **no longer used** by this project. Any legacy Firebase service keys
  (e.g. `serviceAccountKey.json`) must not be committed — add `*.json` service key
  files to `.gitignore` and rotate them if they were ever exposed.

---

## Installation & Running

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI
- Android Studio (for Android)
- Xcode (for iOS - macOS only)

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on Web
npm run web

# Generate native projects
npx expo prebuild
```

### Scripts Available
| Script | Command | Description |
|--------|---------|-------------|
| `start` | `expo start` | Start Expo development server |
| `android` | `expo start --android` | Run on Android |
| `ios` | `expo start --ios` | Run on iOS |
| `web` | `expo start --web` | Run on web |
| `prebuild` | `expo prebuild` | Generate native projects |
| `lint` | `eslint ...` | Run linter |
| `format` | `eslint ... --fix` | Fix linting issues |

---

## Development Configuration

### TypeScript Configuration (`tsconfig.json`)
- Extends Expo TypeScript base config
- Strict mode enabled
- Path aliases: `@/*` → `src/*`

### Tailwind Configuration (`tailwind.config.js`)
- Content paths: `App.tsx`, `./src/**/*.{js,jsx,ts,tsx}`
- Preset: NativeWind
- Custom colors: `primary: "#00b894"`

### Babel Configuration
- React Native preset
- NativeWind plugin

### Metro Configuration
- Default Expo Metro config

---

## Summary

E-SOVA is a comprehensive electronic voting system built with modern technologies. It leverages Supabase for database, realtime updates and image storage, with salted password hashing for voter credentials, and React Native/Expo for the mobile interface. The system provides secure voting with role-based access, real-time monitoring, and complete audit trails for administrative actions.

---

*Document generated automatically from system analysis*
