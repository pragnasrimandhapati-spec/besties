/* ------------------------------------------------------------------
 * Firebase settings (OPTIONAL)
 *
 * The app works without this: photos live in sessionStorage only.
 * To enable the "Back up to Firebase" switch:
 *   1. Go to https://console.firebase.google.com and create a project.
 *   2. Build > Authentication > Sign-in method > enable "Anonymous".
 *   3. Build > Firestore Database > Create database.
 *   4. Project settings > Your apps > add a Web app (</>), then copy the
 *      config values it shows into the object below.
 *   5. Publish the rules in firestore.rules (see README.md).
 * ------------------------------------------------------------------ */
window.BESTIES_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  appId: "YOUR_APP_ID"
};
