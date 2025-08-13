// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCyeJvzOTyaOx1xtoZ7CSdmtEx1Il9Yg9o",
  authDomain: "studentmanagementapp-2ae56.firebaseapp.com",
  projectId: "studentmanagementapp-2ae56",
  storageBucket: "studentmanagementapp-2ae56.firebasestorage.app",
  messagingSenderId: "381388828818",
  appId: "1:381388828818:web:4c89ca210845422886364b",
  measurementId: "G-MWY72L076X",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
