const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { initializeSocket } = require('./backend/socket');
const { router: authRouter } = require('./backend/auth');
const dashboardRouter = require('./backend/dashboard');
const profileRouter = require('./backend/profile');
const { checkToken } = require('./backend/jwt');
const assetsRouter = require('./backend/assets');
const app = express();
const httpServer = http.createServer(app);
const io = initializeSocket(httpServer);
const port = process.env.PORT || 3000;

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allowed domains
    const allowedDomains = [
      'http://localhost:3000',
    ];

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedDomains.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

// app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/', checkToken, dashboardRouter);

app.get('/auth', checkToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

app.use('/api/profile', checkToken, profileRouter);
app.use('/api/assets', assetsRouter);

// Serve other static files
app.use(express.static('public'));

// Auth API Routes
app.use('/api/auth', authRouter);

const { log } = require('./backend/logger');

// Export app for Vercel
module.exports = { app, httpServer, log };

// Only listen if run directly (not imported)
if (require.main === module) {
  httpServer.listen(port, () => {
    log(`✅ Dating app listening at http://localhost:${port} - PID:${process.pid}`);
    log('✅ Socket.IO server ready with Redis adapter');
  });
}