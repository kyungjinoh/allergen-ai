import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBZtuVtVedy-Vnrsx3LU1r4lE2J1WumOi0",
  authDomain: "allergen-ai-f3990.firebaseapp.com",
  projectId: "allergen-ai-f3990",
  storageBucket: "allergen-ai-f3990.firebasestorage.app",
  messagingSenderId: "343840041645",
  appId: "1:343840041645:web:0955d6b8777af2b7aa3424",
  measurementId: "G-XM7RRBZP2F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// Test Firebase connection
console.log('Firebase initialized with project ID:', firebaseConfig.projectId);

// Check if we're in development mode and connect to emulator if needed
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('Connected to Firebase Firestore emulator');
  } catch (error) {
    console.log('Firebase emulator already connected or not available');
  }
}

export { auth, db }; 