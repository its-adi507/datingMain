const admin = require('firebase-admin');

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    serviceAccount = require('../firebaseAdminSdk.json');
}

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`, 
    databaseURL: 'https://datingapp-be8cd-default-rtdb.firebaseio.com/', // Exact URL provided by user
    storageBucket: `${serviceAccount.project_id}.appspot.com`
});

// Firestore Database
const db = admin.firestore();

// Realtime Database
const realtimeDb = admin.database();

// Storage
const bucket = admin.storage().bucket();

// Auth
const auth = admin.auth();

// Export all services
module.exports = {
    admin,
    db,           // Firestore
    realtimeDb,   // Realtime Database
    bucket,       // Storage
    auth          // Authentication
};
