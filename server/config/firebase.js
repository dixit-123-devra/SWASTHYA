const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config();

// MOCK: We only initialize if the service account exists in env,
// otherwise we export a mock database object so the app doesn't crash.
let db;

try {
  if (process.env.FIREBASE_PROJECT_ID) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Replace literal \n with actual newline for the private key
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    db = getFirestore();
    console.log('Firebase initialized securely.');
  } else {
    throw new Error('No Firebase Credentials');
  }
} catch (error) {
  console.log('⚠️ Running Firebase in MOCK mode (Error:', error.message, ')');
  
  // MOCK Firestore for local development
  db = {
    collection: (col) => ({
      doc: (id) => ({
        set: async (data) => {
          console.log(`[MOCK FIREBASE] Saved to ${col}/${id}:`, data);
          return { success: true };
        },
        get: async () => {
          console.log(`[MOCK FIREBASE] Fetched from ${col}/${id}`);
          return { 
            exists: true, 
            data: () => ({ patientName: 'Mock Patient', uniqueId: id, embeddings: '[...mock_vector...]' }) 
          };
        }
      })
    })
  };
}

module.exports = { db };
