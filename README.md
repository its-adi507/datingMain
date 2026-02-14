# Dating App

A modern, real-time dating application built with Node.js, Express, and Socket.io. Users can discover profiles, chat with matches, and track presence all in real-time.

## 🌟 Features

### Authentication & User Management
- **Mobile-based OTP Authentication**: Secure login/signup using one-time passwords
- **JWT Token System**: Secure session management with JWT tokens stored in cookies
- **User Profiles**: Create and update user profiles with name, bio, and tags
- **Profile Pictures**: Upload and manage profile images via Cloudinary

### Real-Time Chat
- **Instant Messaging**: Real-time chat with Socket.io WebSocket connections
- **Chat History**: Persistent message storage with Redis Streams for efficient pagination
- **Read Receipts**: Track message read status
- **Chat Metadata**: Manage conversation metadata and last message information

### User Discovery & Discovery Feed
- **Dashboard**: Browse and discover user profiles
- **Profile Recommendations**: Get matched profiles based on interest
- **Live Feed Updates**: Real-time updates when users go online/offline

### Presence & Status
- **Online/Offline Status**: Real-time presence tracking
- **Last Seen Timestamp**: Track when users were last active
- **Live User Status**: Instant updates across all connected clients

### Real-Time Updates
- **Socket.io Integration**: WebSocket connections for instant notifications
- **Redis Adapter**: Multi-server support with Redis pub/sub
- **Scalable Architecture**: Handle multiple concurrent connections

## 🏗️ Project Structure

```
datingMain/
├── backend/                    # Server-side logic
│   ├── auth.js                # Authentication routes & OTP handling
│   ├── profile.js             # User profile management
│   ├── chat.js                # Chat routes & message handling
│   ├── chat-metadata.js       # Chat metadata & read receipts
│   ├── dashboard.js           # User discovery & recommendations
│   ├── socket.js              # Socket.io setup & event handling
│   ├── presence.js            # User presence tracking
│   ├── firebase.js            # Firebase/Firestore initialization
│   ├── redis.js               # Redis client configuration
│   ├── jwt.js                 # JWT token generation & verification
│   ├── cloudinary.js          # Cloudinary integration for images
│   ├── assets.js              # Asset management routes
│   ├── functions.js           # Utility functions
│   └── storage.js             # Local storage utilities
├── public/                    # Frontend assets
│   ├── index.html             # Main dashboard page
│   ├── auth.html              # Authentication page
│   ├── script.js              # Main app logic
│   ├── auth.js                # Auth page logic
│   ├── loader.js              # Loading animations
│   ├── snackbar.js            # Toast notifications
│   ├── style.css              # Main stylesheet
│   ├── auth.css               # Auth page styling
│   ├── loader.css             # Loader styling
│   ├── snackbar.css           # Snackbar styling
│   └── particle_styles.css    # Particle background effects
├── assets/                    # Asset files
├── uploads/                   # User-uploaded files (temporary storage)
├── server.js                  # Express server entry point
├── package.json               # NPM dependencies
├── firebaseAdminSdk.json      # Firebase credentials (⚠️ never commit)
└── clear-redis.js             # Utility to clear Redis cache
```

## 🔧 Tech Stack

### Backend
- **Runtime**: Node.js (v18.x or higher)
- **Framework**: Express.js 5.2.1
- **Real-time**: Socket.io 4.8.3
- **Database**: Firebase (Firestore) 13.6.1
- **Cache/Pub-Sub**: Redis 5.10.0
- **Authentication**: JWT (jsonwebtoken 9.0.3)
- **File Upload**: Cloudinary, Multer, Express-fileupload
- **Middleware**: CORS, Cookie-parser

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Custom styling with animations
- **JavaScript**: Vanilla JS (no frameworks)
- **WebSockets**: Socket.io client

### Infrastructure
- **Message Queue**: Redis Streams (chat messages)
- **Real-time Sync**: Redis Pub/Sub (Socket.io adapter)
- **Cloud Storage**: Cloudinary (images)

## 📋 API Endpoints

### Authentication Routes (`/api/auth`)
- `POST /send-otp` - Send OTP to mobile number
- `POST /verify-otp` - Verify OTP and login/register
- `POST /logout` - Logout user

### Profile Routes (`/api/profile`)
- `POST /` - Update user profile (name, bio, tags)
- `GET /` - Get user's own profile
- `GET /:userId` - Get another user's profile

### Chat Routes (`/api/chat`)
- `GET /:friendId` - Fetch chat history with pagination
- `POST /:friendId/send` - Send a message
- `GET /conversations` - Get list of all conversations
- `POST /:friendId/read` - Mark conversation as read

### Dashboard Routes (`/`)
- `GET /` - Get recommended profiles for discovery
- `GET /conversation-list` - Get list of chat conversations
- `POST /match/:userId` - Like/match with a user
- `POST /skip/:userId` - Skip a user

### Asset Routes (`/api/assets`)
- `POST /upload` - Upload profile picture
- `DELETE /:assetId` - Delete an asset

## ⚙️ Setup & Installation

### Prerequisites
- Node.js v18 or higher
- npm or yarn
- Redis instance (cloud or local)
- Firebase project with Firestore
- Cloudinary account for image hosting

### Environment Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd datingMain
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Create `firebaseAdminSdk.json` with your Firebase admin credentials
   - This file should contain your service account key from Firebase Console
   - ⚠️ **Important**: Never commit this file to git

4. **Configure Redis**
   - Update Redis connection details in `backend/socket.js` and `backend/redis.js`
   - Replace with your Redis instance credentials (host, port, password)

5. **Configure Cloudinary**
   - Set Cloudinary API credentials in `backend/cloudinary.js`
   - Get these from your Cloudinary dashboard

### Running the Application

**Development Mode** (with auto-reload)
```bash
npm run dev
```

**Production Mode**
```bash
npm start
```

The server will start on `http://localhost:3000` (or custom PORT)

## 🔄 Key Workflows

### User Authentication Flow
1. User enters mobile number on auth page
2. Server sends OTP via Firebase Auth
3. User verifies OTP
4. Server generates JWT token and stores in secure cookie
5. User redirected to dashboard
6. JWT token verified on each request via `checkToken` middleware

### Real-Time Chat Flow
1. User connects via Socket.io
2. Messages stored in Redis Streams for pagination
3. Messages also persisted in Firestore
4. Read receipts updated via chat-metadata
5. New messages broadcast to recipient via Socket.io event
6. Presence status updates notify chat participants

### Profile Discovery Flow
1. Dashboard fetches recommended profiles from Firestore
2. Profiles cached in Redis for performance
3. User swipes/likes profiles (creates match records)
4. Real-time notifications sent via Socket.io
5. Match connections enable chat functionality

## 🔐 Security Features

- **JWT Authentication**: Token-based security
- **Cookie Storage**: Secure HTTP-only cookie storage
- **CORS Protection**: Configured CORS policies
- **Input Validation**: Server-side validation on all routes
- **Redis Caching**: Cache profiles to prevent repeated DB queries
- **Presence Privacy**: Online status tracking for privacy

## 📊 Database Schema

### Users Collection
```
{
  userId: string,
  mobile: string,
  name: string,
  bio: string,
  tags: array,
  profilePicture: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Messages (Redis Stream)
```
chat:stream:{chatId}
- sender: userId
- message: text
- timestamp: epoch
- read: boolean
```

### Presence (Redis Keys)
```
presence:{userId} = "online" | "offline"
presence:lastSeen:{userId} = timestamp
```

## 🚀 Performance Optimizations

1. **Redis Streams**: Efficient pagination of chat messages
2. **Profile Caching**: Redis cache for frequently accessed profiles
3. **Batch Operations**: `redis.mget()` for multiple profile fetches
4. **Socket.io Redis Adapter**: Horizontal scaling across multiple servers
5. **Lazy Loading**: Messages loaded on demand with pagination
6. **Memory Storage**: Multer configured for efficient file uploads

## 🛠️ Utility Scripts

### Clear Redis Cache
```bash
node clear-redis.js
```
Clears all Redis cache entries to reset application state during development.

## 📝 Important Files Reference

| File | Purpose |
|------|---------|
| `server.js` | Express server setup, route initialization, HTTP/Socket.io server |
| `backend/auth.js` | OTP generation, verification, JWT token creation |
| `backend/socket.js` | Socket.io configuration, Redis adapter setup, event handlers |
| `backend/firebase.js` | Firebase/Firestore initialization with admin SDK |
| `backend/redis.js` | Redis client setup and configuration |
| `backend/functions.js` | Utility functions used across the app |
| `public/script.js` | Main frontend logic, Socket.io client integration |
| `public/auth.js` | Authentication page logic |

## 🔄 Development Notes

### Message Pagination
- Latest messages loaded first (cursor = '+')
- Older messages loaded on scroll (direction = 'older')
- Newer messages loaded for real-time updates (direction = 'newer')

### Socket.io Events
- `connect`: User connects to Socket.io
- `message`: New message received
- `user-online`: User comes online
- `user-offline`: User goes offline
- Multiple events for real-time synchronization

### Redis Keys Pattern
- `User/{userId}/profileData` - Cached profile data
- `presence:{userId}` - User presence status
- `presence:lastSeen:{userId}` - Last seen timestamp
- `chat:stream:{chatId}` - Chat message stream

## ⚠️ Known Considerations

- **Hot-loading**: In production, consider disabling hot-reload features
- **Rate Limiting**: Add rate limiting for OTP requests to prevent abuse
- **Message Cleanup**: Implement Redis Stream trimming for production
- **Image Optimization**: Compress images before Cloudinary upload
- **Error Handling**: Add global error handler for Socket.io connections

## 📄 License

ISC

## 👤 Author

Dating App Development Team

---

**Last Updated**: February 2026

For issues, feature requests, or contributions, please contact the development team.
