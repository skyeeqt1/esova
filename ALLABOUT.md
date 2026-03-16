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
- **Authentication**: Firebase Authentication
- **Database**: Firebase Firestore (NoSQL)
- **Storage**: Firebase Storage + Supabase Storage
- **Backend Admin**: Firebase Admin SDK 13.6

### Key Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| expo | ^54.0.0 | Development framework |
| react-native | 0.81.5 | Mobile framework |
| firebase | ^12.8.0 | Firebase services |
| firebase-admin | ^13.6.0 | Server-side Firebase |
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
| papaparse | ^5.5.3 | CSV parsing |
| csv-parser | ^3.2.0 | CSV parsing |
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
│  └── VoterProfile (User Profile)                        │
├─────────────────────────────────────────────────────────┤
│  Components (Admin):                                     │
│  ├── OverviewSection (Statistics & Charts)             │
│  ├── CandidateSection (Manage Candidates)              │
│  ├── VoterSection (Manage Voters)                      │
│  └── AdminLogsSection (Audit Logs)                      │
├─────────────────────────────────────────────────────────┤
│  Navigation: React Navigation Native Stack              │
├─────────────────────────────────────────────────────────┤
│                    Backend Services                      │
├──────────────────┬──────────────────┬───────────────────┤
│    Firebase      │   Supabase       │    Local          │
│  ┌────────────┐ │ ┌────────────┐  │ ┌───────────────┐  │
│  │ Auth       │ │ │ Storage    │  │ │ CSV Import    │  │
│  │ Firestore  │ │ │ (Images)  │  │ │ Scripts       │  │
│  │ Storage    │ │ └────────────┘  │ └───────────────┘  │
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
│   │   ├── firebase.ts              # Firebase configuration
│   │   └── supabase.js              # Supabase configuration
│   │
│   ├── screens/
│   │   ├── LoginScreen.tsx          # User authentication
│   │   ├── AdminDashboard.tsx       # Admin control panel
│   │   ├── VoterScreen.tsx          # Voting interface
│   │   └── VoterProfile.tsx          # Voter profile
│   │
│   ├── components/
│   │   └── admin/
│   │       ├── AdminLogsSection.tsx # Admin audit logs
│   │       ├── CandidateSection.tsx # Candidate management
│   │       ├── OverviewSection.tsx  # Dashboard overview
│   │       └── VoterSection.tsx     # Voter management
│   │
│   ├── hooks/
│   │   └── useAdminData.ts          # Admin data hook
│   │
│   ├── img/
│   │   ├── escrlogo.png             # ESCR logo
│   │   └── tg.jpg                   # Background image
│   │
│   └── scripts/
│       ├── importUsers.js           # User import script
│       ├── serviceAccountKey.json   # Firebase admin key
│       └── students.csv             # Sample students data
│
└── components/                      # Shared components
    ├── Container.tsx
    ├── EditScreenInfo.tsx
    └── ScreenContent.tsx
```

---

## Configuration & Backend Services

### Firebase Configuration
- **Project ID**: `sova-a5fc9`
- **Auth Domain**: `sova-a5fc9.firebaseapp.com`
- **Storage Bucket**: `sova-a5fc9.firebasestorage.app`
- **API Key**: `AIzaSyBsAqdHWPeEgTa1KhfbVH55LU4Mj-FNtfg`
- **Messaging Sender ID**: `295512479205`
- **App ID**: `1:295512479205:web:a1ba0faec967698df58b0c`

### Supabase Configuration
- **Project URL**: `https://vcluoryjyqsbupracgqh.supabase.co`
- **Storage Bucket**: `candidate-profiles` (for candidate images)
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbHVvcnlqeXFzYnVwcmFjZ3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MzY1MzcsImV4cCI6MjA4NTMxMjUzN30.8gNW7cyxgUygQkmWPijb5bBP3kFowvsbkMcjcaoxLpE`

---

## Database Schema

### Firestore Collections

#### 1. `users` Collection
Stores voter and admin user accounts.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated document ID (matches Firebase Auth UID) |
| `name` | string | Full name of the voter |
| `email` | string | User email address (used for Firebase Auth) |
| `studentId` | string | Unique student identification number |
| `role` | string | User role: `"voter"` or `"admin"` |
| `hasVoted` | boolean | Whether the user has submitted their ballot |
| `ballot` | object/null | Completed ballot (JSON object with position votes) |
| `votedAt` | timestamp/null | When the user cast their vote |

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
| `id` | string | Auto-generated document ID |
| `action` | string | Action type: `"DELETE_VOTER"`, `"RESET_ELECTION"`, etc. |
| `targetName` | string | Name of the affected entity |
| `targetId` | string | ID of the affected entity |
| `reason` | string | Admin-provided reason for the action |
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
- User authentication with Firebase Auth
- Email/password login
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
- Logo: ESCR (with escrlogo.png)

#### 3. VoterScreen (`src/screens/VoterScreen.tsx`)
- Main voting interface for voters
- Features:
  - View candidates by position
  - Cast votes for each position
  - Submit ballot
  - View voting status
  - Check if already voted

#### 4. VoterProfile (`src/screens/VoterProfile.tsx`)
- User profile display
- Features:
  - View personal information
  - View voting history
  - Ballot confirmation

---

## Key Features

### Authentication
- Firebase Auth-based login
- Role-based access control (admin/voter)
- Account lockout after failed attempts
- Secure session management

### Voting System
- One vote per user (hasVoted flag)
- Multi-position voting (President, VP, Secretary, Treasurer)
- Ballot tracking with timestamps
- Vote confirmation

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

### Firebase (Client-Side)
```
API Key: AIzaSyBsAqdHWPeEgTa1KhfbVH55LU4Mj-FNtfg
Auth Domain: sova-a5fc9.firebaseapp.com
Project ID: sova-a5fc9
Storage Bucket: sova-a5fc9.firebasestorage.app
Messaging Sender ID: 295512479205
App ID: 1:295512479205:web:a1ba0faec967698df58b0c
```

### Supabase
```
Project URL: https://vcluoryjyqsbupracgqh.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Firebase Admin (Server-Side)
- Service account key file: `src/scripts/serviceAccountKey.json`
- Used for: Batch operations, user management, privileged operations

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

E-SOVA is a comprehensive electronic voting system built with modern technologies. It leverages Firebase for authentication and database, Supabase for image storage, and React Native/Expo for the mobile interface. The system provides secure voting with role-based access, real-time monitoring, and complete audit trails for administrative actions.

---

*Document generated automatically from system analysis*
*Project Location: c:/Users/alago/Documents/appvoting/SOVA-current*
