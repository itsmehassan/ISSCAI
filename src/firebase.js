import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDb83aSzAEhlC1i4OAPZCVogOuibNJZTDo",
  authDomain: "isscai-42e5b.firebaseapp.com",
  projectId: "isscai-42e5b",
  storageBucket: "isscai-42e5b.firebasestorage.app",
  messagingSenderId: "846796753338",
  appId: "1:846796753338:web:96946594acbeb51e5bb583",
  measurementId: "G-Z8TBJY75VF",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);