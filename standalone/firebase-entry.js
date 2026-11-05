// Point d'entrée du bundle Firebase (voir package.json : npm run build:vendor)
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, doc, collection, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
window.__FB = { initializeApp, getAuth, signInAnonymously, connectAuthEmulator, initializeFirestore, connectFirestoreEmulator, doc, collection, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, query, orderBy, limit };
