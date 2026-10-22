// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, remove, update } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBk9rb5ibzEkV5DsihRYDhM-kF_rHy28sQ",
  authDomain: "judo-tournoi.firebaseapp.com",
  databaseURL: "https://judo-tournoi-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "judo-tournoi",
  storageBucket: "judo-tournoi.firebasestorage.app",
  messagingSenderId: "1054179313291",
  appId: "1:1054179313291:web:6aa007935e4061a529f68e"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, set, onValue, push, remove, update };