
import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

let app = null;
let db: any = null;
let connectionError = "";

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = initializeApp(firebaseConfig);
    
    // Inicialização com Persistência Offline Habilitada
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      }, (firebaseConfig as any).firestoreDatabaseId);
    } catch (e) {
      console.warn("⚠️ [Firebase] Fallback para persistência simples:", e);
      try {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache({})
        }, (firebaseConfig as any).firestoreDatabaseId);
      } catch (e2) {
        console.error("❌ [Firebase] Falha total na persistência:", e2);
        db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
      }
    }
    
    console.log("🔥 [Firebase] Conectado com Persistência Offline.");
  } catch (error: any) {
    console.error("❌ [Firebase] Erro:", error);
    try {
        if (!db) db = getFirestore(app!, (firebaseConfig as any).firestoreDatabaseId);
    } catch (e) {
        console.error("❌ [Firebase] Falha total:", e);
    }
    connectionError = error.message;
  }
}

export { app, db, connectionError, firebaseConfig };
