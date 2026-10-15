/* Optional cloud backup using Firebase Authentication (anonymous) + Cloud Firestore.
 * Firebase is only downloaded when the person switches the backup on, so the app
 * works fine offline / without any configuration.
 *
 * Photos are stored as small base64 JPEGs inside Firestore documents (each well under
 * Firestore's 1 MB limit), so this works on the free Spark plan — no Cloud Storage needed.
 *
 * Data layout:
 *   besties/{uid}                  { names, memDone, updatedAt }
 *   besties/{uid}/photos/{poseId}  { data, updatedAt }
 */
(function () {
  const cfg = window.BESTIES_FIREBASE_CONFIG || {};
  const real = v => !!v && !/^YOUR_/.test(v);
  const configured = real(cfg.apiKey) && real(cfg.projectId) && real(cfg.appId);

  const VERSION = '10.14.1';
  const CDN = `https://www.gstatic.com/firebasejs/${VERSION}/`;
  let fb = null, pending = null;

  async function init() {
    if (fb) return fb;
    if (pending) return pending;
    pending = (async () => {
      const [{ initializeApp }, { getAuth, signInAnonymously }, fs] = await Promise.all([
        import(CDN + 'firebase-app.js'),
        import(CDN + 'firebase-auth.js'),
        import(CDN + 'firebase-firestore.js')
      ]);
      const app = initializeApp(cfg);
      const auth = getAuth(app);
      await auth.authStateReady();
      const user = auth.currentUser || (await signInAnonymously(auth)).user;
      fb = { fs, db: fs.getFirestore(app), uid: user.uid };
      return fb;
    })();
    pending.catch(() => { pending = null; });
    return pending;
  }

  const api = {
    configured,
    enabled: false,

    async enable() {
      if (!configured) throw new Error('Add your Firebase keys in js/firebase-config.js first.');
      await init();
      api.enabled = true;
    },
    disable() { api.enabled = false; },

    async savePhoto(poseId, dataUrl) {
      const { fs, db, uid } = await init();
      await fs.setDoc(fs.doc(db, 'besties', uid, 'photos', poseId), {
        data: dataUrl, updatedAt: fs.serverTimestamp()
      });
    },

    async deletePhoto(poseId) {
      const { fs, db, uid } = await init();
      await fs.deleteDoc(fs.doc(db, 'besties', uid, 'photos', poseId));
    },

    async saveProgress({ names, memDone }) {
      const { fs, db, uid } = await init();
      await fs.setDoc(fs.doc(db, 'besties', uid), {
        names, memDone, updatedAt: fs.serverTimestamp()
      }, { merge: true });
    },

    async loadAll() {
      const { fs, db, uid } = await init();
      const root = await fs.getDoc(fs.doc(db, 'besties', uid));
      const snap = await fs.getDocs(fs.collection(db, 'besties', uid, 'photos'));
      const photos = {};
      snap.forEach(d => { photos[d.id] = d.data().data; });
      const r = root.exists() ? root.data() : {};
      return { photos, names: r.names || null, memDone: r.memDone || null };
    }
  };

  window.BestiesCloud = api;
})();
