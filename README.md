# 🌸 Our Friendship Journey (Bootstrap + Firebase edition)

A web app for two college best friends: Ghibli-inspired artwork, a heart of flower petals, memories to make, and photo poses you can recreate and upload.

## Open it
Unzip and double-click `index.html`. You need an internet connection, because Bootstrap 5 and the fonts load from CDNs.

## Where your data lives — session storage
Names, ticked memories and uploaded pose photos are kept in the browser's **sessionStorage**:
- they survive page refreshes in the same tab,
- they are **erased when the tab or browser is closed**,
- photos are shrunk to about 720 px so ~20 of them fit in the ~5 MB session quota.

Use **Download** in the photo viewer (or **Download all photos** in the album) to keep copies.

## Optional: Firebase backup
The app runs fine without Firebase. To turn on the "Also back up to Firebase" switch:

1. Create a project at <https://console.firebase.google.com>.
2. **Build → Authentication → Sign-in method** → enable **Anonymous**.
3. **Build → Firestore Database** → create a database.
4. **Project settings → Your apps → Web (`</>`)** → copy the config values into `js/firebase-config.js`.
5. **Firestore → Rules** → paste the contents of `firestore.rules` and publish.
6. If you open `index.html` straight from disk and sign-in fails, serve it over http (for example `npx serve .` or Firebase Hosting below) and add that domain under **Authentication → Settings → Authorized domains** (`localhost` is allowed by default).

With the switch on, every upload, removal, tick and name change is copied to Firestore under an anonymous user. After closing the tab, open the app again, switch the backup on and press **Restore from backup**. Backups are tied to the same browser's anonymous sign-in. Photos are stored as small base64 JPEGs inside Firestore documents, so no paid Cloud Storage plan is needed.

### Host it with Firebase Hosting (optional)
```
npm install -g firebase-tools
firebase login
firebase init        # choose Hosting + Firestore, keep the existing firebase.json
firebase deploy
```

## What's inside
| Path | Purpose |
|---|---|
| `index.html` | Bootstrap 5 layout |
| `css/style.css` | Ghibli-style theme on top of Bootstrap |
| `assets/friends.svg` | Hand-drawn Ghibli-inspired illustration of the two friends |
| `js/petals.js` | Petals gather into a heart, beat, burst and repeat |
| `js/poses.js` | The 14 memories and 20 photo poses (edit freely) |
| `js/app.js` | Memories, pose cards, uploads, album, session storage |
| `js/firebase-config.js` | Your Firebase keys (optional) |
| `js/firebase-sync.js` | Optional Firebase Auth + Firestore backup |
| `poses/photo-poses.md` | The photo-poses checklist file |
| `firestore.rules`, `firebase.json` | Security rules and hosting config |
