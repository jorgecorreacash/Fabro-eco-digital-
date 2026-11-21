import appletConfig from '../firebase-applet-config.json';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

/**
 * Configuración central de Firebase (Plan Spark Gratuito) para FABRO.
 * Soporta variables de entorno opcionales `VITE_FIREBASE_*` (ej. en Netlify)
 * con respaldo automático en `firebase-applet-config.json`.
 */
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || '',
  appId: env.VITE_FIREBASE_APP_ID || appletConfig.appId || '',
};

export const firestoreDatabaseId =
  env.VITE_FIREBASE_DATABASE_ID ||
  ('firestoreDatabaseId' in appletConfig && typeof appletConfig.firestoreDatabaseId === 'string'
    ? appletConfig.firestoreDatabaseId
    : undefined);

export default firebaseConfig;
