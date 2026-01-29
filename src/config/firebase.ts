import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBsAqdHWPeEgTa1KhfbVH55LU4Mj-FNtfg",
  authDomain: "sova-a5fc9.firebaseapp.com",
  projectId: "sova-a5fc9",
  storageBucket: "sova-a5fc9.firebasestorage.app",
  messagingSenderId: "295512479205",
  appId: "1:295512479205:web:a1ba0faec967698df58b0c"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);