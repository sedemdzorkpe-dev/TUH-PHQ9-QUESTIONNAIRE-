import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// These values come from your Firebase project settings (Project settings > General > Your apps > SDK setup).
// They are NOT secret — Firebase web config is designed to be public. Real access control is enforced by
// your Firestore security rules (see firestore.rules), not by hiding these values.
const firebaseConfig = {
  apiKey: "AIzaSyCENnEzez7ImOp_6xPlFXYeYjxQO6drPbs",
  authDomain: "tuh-depression-questionnaire.firebaseapp.com",
  projectId: "tuh-depression-questionnaire",
  storageBucket: "tuh-depression-questionnaire.firebasestorage.app",
  messagingSenderId: "1076411683070",
  appId: "1:1076411683070:web:05cb36723e72fe3aed15af",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
