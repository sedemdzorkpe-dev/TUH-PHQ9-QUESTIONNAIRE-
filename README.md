# Tema Urban Hospital — QI & IPC Research Portal

A multi-role web app for collecting Socio-Demographic/Clinical data and PHQ-9
depression screening data, built for Tema Urban Hospital's QI & IPC
operational research.

- **Admin** — creates/disables/deletes login accounts, sees all analytics and records.
- **Director** — read-only access to all analytics and all records.
- **Research Assistant (RA)** — fills the questionnaire, sees only their own progress and records.

Data is stored in **Firebase Firestore** and syncs live across everyone using
the app. The site itself is a static build, hosted for free on **GitHub Pages**.

---

## 1. Create your Firebase project (5 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**. Give it any name (e.g. `tuh-qi-portal`) and finish the wizard (you can turn off Google Analytics, it's not needed).
2. In the left sidebar, go to **Build → Firestore Database → Create database**. Choose a location close to Ghana (e.g. `eur3` or `europe-west`), and start in **production mode**.
3. Go to **Build → Authentication → Get started**. Under the **Sign-in method** tab, enable **Anonymous**. (This isn't used for personal accounts — see the note in `firestore.rules` for why it's there.)
4. Go to **Project settings** (gear icon, top left) → scroll to **Your apps** → click the **</>** (Web) icon → register an app (any nickname) → you do **not** need Firebase Hosting.
5. Firebase will show you a `firebaseConfig` object. Copy the values into `src/firebase.js` in this project, replacing the `REPLACE_WITH_...` placeholders.
6. Back in Firestore, go to the **Rules** tab and paste in the contents of `firestore.rules` from this project, then click **Publish**.

That's it for Firebase — no billing account or credit card is required for this app's usage level (Firestore's free tier is generous for a hospital research team).

## 2. Push this project to GitHub

1. Create a new **public or private** repository on GitHub (e.g. `tuh-qi-portal`).
2. In this project folder, run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

## 3. Turn on GitHub Pages

1. In your GitHub repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions** (not "Deploy from a branch").
3. Push to `main` (or re-run the workflow from the **Actions** tab) — the included workflow (`.github/workflows/deploy.yml`) will build the site and publish it automatically.
4. After the workflow finishes (1–2 minutes), your site will be live at:
   `https://YOUR_USERNAME.github.io/YOUR_REPO/`

Every future push to `main` redeploys automatically.

## 4. First login

Open your live URL and sign in with:

- **Username:** `admin`
- **Password:** `admin123`

**Change this immediately** from *Manage Users → Reset password*, then create real accounts for your Director and each Research Assistant.

---

## Local development (optional)

```bash
npm install
npm run dev
```

This starts a local dev server (usually `http://localhost:5173`) connected to the same live Firebase project, so test data will mix with real data — consider creating a second Firebase project for testing if that matters to you.

## Security notes — please read

This is built to get your team collecting real data quickly, not as a
hardened hospital IT system. Before wider rollout, be aware:

- **Passwords are hashed (SHA-256) before being stored**, not plaintext — a meaningful improvement over a quick prototype, but still not equivalent to a proper authentication system (no salting, no rate-limiting on login attempts).
- **Firestore security rules currently allow any signed-in (even anonymous) visitor to read and write all data**, including the PHQ-9 responses and the (hashed) user credentials. This is a pragmatic tradeoff for a static, serverless site — see the comment in `firestore.rules` for the reasoning and the recommended upgrade path.
- Given this collects **suicide-risk (PHQ-9 item 9) and other sensitive mental-health data**, for anything beyond a small internal pilot, consider migrating to real Firebase Authentication (one login per person, enforced server-side) and tightening the Firestore rules to check the signed-in user's role, ideally behind a small Cloud Function or a proper backend.
- Keep an internal record of who has Admin access — Admins can see and export all participant data.

## What's inside

```
src/
  App.jsx        the whole application (UI, forms, dashboards, Firestore calls)
  firebase.js    your Firebase project config (edit this)
  main.jsx       React entry point
  index.css      Tailwind import
firestore.rules  Firestore security rules to paste into the Firebase console
.github/workflows/deploy.yml   builds & deploys to GitHub Pages on every push to main
```
