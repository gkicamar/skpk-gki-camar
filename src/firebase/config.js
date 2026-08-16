import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Konfigurasi ini memang bersifat publik pada aplikasi web.
// Pengamanannya ada di firestore.rules dan storage.rules, bukan di sini.
const firebaseConfig = {
  apiKey: 'AIzaSyAIpreq59mZcylXhe-2EwFfJAn9Uh-AJi0',
  authDomain: 'skpk-gki-camar.firebaseapp.com',
  projectId: 'skpk-gki-camar',
  storageBucket: 'skpk-gki-camar.firebasestorage.app',
  messagingSenderId: '317470703861',
  appId: '1:317470703861:web:2a40d147ba4a7aa5fac5bc',
  measurementId: 'G-2SJ2PQ50TD',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Analytics sengaja tidak dinyalakan. Aplikasi internal gereja tidak butuh
// pelacakan perilaku, dan mematikannya mengurangi beban kuota.
