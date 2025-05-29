
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  updateProfile as firebaseUpdateProfile, // Renamed to avoid conflict
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider,
  type AuthError, // Import AuthError for type checking
  type UserCredential, // Import UserCredential
  type User, // Import User
  signOut as firebaseSignOut, // Renamed signOut
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "firebase/auth";
import { 
  getFirestore, 
  Timestamp, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp, 
  doc, // Original Firestore doc function
  deleteDoc, 
  updateDoc as firestoreUpdateDoc, 
  arrayUnion, 
  arrayRemove, 
  getDoc as firestoreGetDoc, 
  setDoc as firestoreSetDoc,
  onSnapshot 
} from "firebase/firestore"; // Added onSnapshot
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"; 
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDyilmMQ6TutsY8DOTuq6Hd-CG4OItt4l8",
  authDomain: "pc-builder-lms-6bc14.firebaseapp.com",
  projectId: "pc-builder-lms-6bc14",
  storageBucket: "pc-builder-lms-6bc14.appspot.com",
  messagingSenderId: "864524989560",
  appId: "1:864524989560:web:d12e8237ee4873f145e98d",
  // measurementId: "G-QT11XXDSYG" // Removed as per user request
};

// Initialize Firebase
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); 

// Initialize Analytics conditionally
let analytics;
if (typeof window !== 'undefined') {
  isSupported().then(supported => {
    if (supported) {
      analytics = getAnalytics(app);
      // console.log("Firebase Analytics initialized");
    } else {
      // console.log("Firebase Analytics not supported on this browser.");
    }
  }).catch(err => {
    // console.error("Failed to initialize Firebase Analytics", err);
  });
}

export { 
  app, 
  auth, 
  db, 
  storage, 
  analytics, 
  firebaseUpdateProfile, // Export renamed updateProfile
  updatePassword,
  storageRef, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject, // Exported deleteObject from storage
  reauthenticateWithCredential,
  EmailAuthProvider,
  type AuthError,
  type UserCredential,
  type User,
  firebaseSignOut, // Export renamed signOut
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  Timestamp,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  doc as firestoreDoc, // Export Firestore doc function as firestoreDoc
  deleteDoc,
  firestoreUpdateDoc, // Exported Firestore updateDoc
  arrayUnion,
  arrayRemove,
  firestoreGetDoc, // Exported Firestore getDoc
  firestoreSetDoc, // Exported Firestore setDoc
  onSnapshot // Added onSnapshot to exports
};
