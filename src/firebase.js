// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, remove, update } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBk9rb5ibzEkV5DsihRYDhM-kF_rHy28sQ",
  authDomain: "judo-tournoi.firebaseapp.com",
  databaseURL: "https://judo-tournoi-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "judo-tournoi",
  storageBucket: "judo-tournoi.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, set, onValue, push, remove, update };