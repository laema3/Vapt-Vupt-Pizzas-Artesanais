import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
try {
  const db = initializeFirestore(app, {}, config.firestoreDatabaseId);
  console.log('Success!', db.type);
} catch (e) {
  console.error('Failed:', e);
}
