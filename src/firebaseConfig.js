import appletConfig from '../firebase-applet-config.json';

/**
 * Configuración central de Firebase (Plan Spark Gratuito) para FABRO.
 *
 * Para usar tu propio proyecto de Firebase, podés reemplazar cualquiera de las
 * 6 claves abajo con las que aparecen en:
 * Firebase Console > Configuración del proyecto > Tus apps > App web (SDK)
 * o editar `firebase-applet-config.json` en la raíz.
 */
export const firebaseConfig = {
  apiKey: appletConfig.apiKey || 'TU_API_KEY_AQUI',
  authDomain: appletConfig.authDomain || 'TU_PROYECTO.firebaseapp.com',
  projectId: appletConfig.projectId || 'TU_PROYECTO_ID',
  storageBucket: appletConfig.storageBucket || 'TU_PROYECTO.firebasestorage.app',
  messagingSenderId: appletConfig.messagingSenderId || 'TU_MESSAGING_SENDER_ID',
  appId: appletConfig.appId || 'TU_APP_ID',
};

export const firestoreDatabaseId =
  'firestoreDatabaseId' in appletConfig && typeof appletConfig.firestoreDatabaseId === 'string'
    ? appletConfig.firestoreDatabaseId
    : undefined;

export default firebaseConfig;
