import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCZk37s5d1CeYq8AkHIUWccp3xn6HBLmKM',
  authDomain: 'foskor-asset-iq.firebaseapp.com',
  projectId: 'foskor-asset-iq',
  storageBucket: 'foskor-asset-iq.firebasestorage.app',
  messagingSenderId: '227612445740',
  appId: '1:227612445740:web:b70f95d6439b76d8221589',
  measurementId: 'G-601J04XRET'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
