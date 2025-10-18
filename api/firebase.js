import admin from 'firebase-admin';

const serviceAccount = {
  type: "service_account",
  project_id: "medical-quiz-40228",
  private_key_id: "737d8d68e052f186eee5c22c229fa52eb3ed5c23",
  private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  client_email: "firebase-adminsdk-fbsvc@medical-quiz-40228.iam.gserviceaccount.com",
  client_id: "115489300067881546686",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40medical-quiz-40228.iam.gserviceaccount.com"
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

const db = admin.firestore();

export { admin, db };