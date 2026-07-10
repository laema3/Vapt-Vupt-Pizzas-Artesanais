import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function test() {
  try {
    await setDoc(doc(db, 'settings', 'general'), { test: '123' }, { merge: true });
    console.log('Write success!');
  } catch (e) {
    console.error('Write failed:', e.message);
  }
}
test().then(() => process.exit(0));
