import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyB_e74Wu9ekkoJrlrfkq4vGtMAOunXeUk8",
  authDomain: "jinhawedding.firebaseapp.com",
  projectId: "jinhawedding",
  storageBucket: "jinhawedding.firebasestorage.app",
  messagingSenderId: "306842946744",
  appId: "1:306842946744:web:66954db2214a9bfc75f84d",
  measurementId: "G-30V8T747DJ",
  databaseURL: "https://jinhawedding-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const database = getDatabase(app);

export { app, analytics, db, database }; 