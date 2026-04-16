# MySyntroMed

A secure, real-time healthcare communication platform connecting clients with medical specialists.

## Features

- **Real-time Messaging** - End-to-end encrypted messaging between clients and specialists
- **User Roles** - Admin, Specialist, and Client roles with appropriate permissions
- **Specialist Assignment** - Admins can assign specialists to clients
- **Request Management** - Clients can submit requests that get assigned to specialists
- **Scheduled Calls** - Book appointments with specialists via Jitsi Meet
- **Live Video Calls** - Real-time video communication between users
- **Notifications** - In-app notifications for messages, assignments, and updates
- **Secure Authentication** - OTP-based verification with Firebase
- **Typing Indicators** - See when the other person is typing
- **User Presence** - Track online/offline status

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- Firebase (Auth, Firestore, Realtime Database, Storage)
- Web Crypto API (E2E encryption)

### Backend
- Node.js with Express
- TypeScript
- Firebase Admin SDK
- Nodemailer (email service)
- Helmet (security headers)
- Express Rate Limit

### Database
- Firebase Firestore (NoSQL database)
- Firebase Realtime Database (presence, typing)
- Firebase Authentication

## Project Structure

```
mysyntromed/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/       # UI components
│   │   │   ├── dashboard/    # Dashboard pages
│   │   │   ├── layout/       # Layout components
│   │   │   └── ui/          # Reusable UI components
│   │   ├── lib/              # Utilities & services
│   │   │   ├── firebase.ts   # Firebase configuration
│   │   │   ├── firestore.ts  # Firestore operations
│   │   │   ├── encryption.ts # E2E encryption
│   │   │   └── security.ts   # Security utilities
│   │   └── pages/            # Page components
│   └── public/               # Static assets
│
├── backend/                  # Express API server
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Express middleware
│   │   └── index.ts         # Server entry point
│   ├── Dockerfile           # Container config
│   └── fly.toml             # Fly.io config
│
├── firestore.rules          # Firestore security rules
├── firebase.json            # Firebase configuration
└── render.yaml              # Render deployment config
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase account
- Git

### Installation

1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/mysyntromed.git
cd mysyntromed
```

2. Install frontend dependencies
```bash
cd frontend
npm install
```

3. Install backend dependencies
```bash
cd ../backend
npm install
```

4. Set up environment variables

**Frontend** (`frontend/.env`):
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_BASE_URL=http://localhost:3001
```

**Backend** (`backend/.env`):
```env
PORT=3001
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:3000
FIREBASE_PROJECT_ID=your_project_id
SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

5. Run development servers
```bash
# Terminal 1 - Frontend
cd frontend
npm run dev

# Terminal 2 - Backend
cd backend
npm run dev
```

6. Open http://localhost:3000

## Deployment

### Frontend (Firebase Hosting)

```bash
cd frontend
npm run build
firebase deploy --only hosting
```

### Backend (Render)

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set root directory to `backend`
4. Configure environment variables
5. Deploy

See [RENDER-FREE.md](RENDER-FREE.md) for detailed deployment instructions.

### Firestore Rules

```bash
firebase deploy --only firestore:rules
```

## Security Features

- **End-to-End Encryption** - Messages encrypted with AES-GCM
- **OTP Verification** - Time-limited, rate-limited authentication
- **Firebase App Check** - Protects against abuse
- **Security Headers** - Helmet.js for HTTP security
- **Rate Limiting** - Prevents brute force attacks
- **Input Sanitization** - XSS prevention
- **Firestore Rules** - Role-based access control

## User Roles

| Role | Permissions |
|------|-------------|
| Admin | Full access to all features, user management |
| Specialist | View assigned clients, manage requests, calls |
| Client | Submit requests, message specialists, schedule calls |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/auth/request-otp` | POST | Request OTP code |
| `/api/auth/verify-otp` | POST | Verify OTP code |
| `/api/contact` | POST | Submit contact form |
| `/api/messages/*` | Various | Message operations |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_*` | Frontend Firebase config |
| `VITE_API_BASE_URL` | Backend API URL |
| `SERVICE_ACCOUNT_KEY` | Firebase admin credentials |
| `SMTP_*` | Email configuration |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

Private - All rights reserved

## Support

For issues or questions, please contact the development team.
