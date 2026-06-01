/**
 * One-time backfill script: adds `searchName` and normalizes `email` to lowercase
 * for all existing user documents in Firestore.
 *
 * Run: node scripts/backfill-users.mjs
 *
 * Requires: .env.local with VITE_ Firebase config vars
 *           npm install dotenv firebase  (already in package.json)
 */

import { readFileSync } from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";

// Load .env.local manually (dotenv reads .env by default)
const envFile = readFileSync(".env.local", "utf-8");
const env = Object.fromEntries(
  envFile.split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const [k, ...v] = l.split("=");
      return [k.trim(), v.join("=").trim()];
    })
);

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function backfill() {
  console.log("🔄 Starting backfill of users collection...");
  const snap = await getDocs(collection(db, "users"));
  let updated = 0;
  let skipped = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const displayName = data.displayName || (data.email ? data.email.split("@")[0] : "unknown");
    const searchName = displayName.toLowerCase();
    const emailLower = data.email ? data.email.toLowerCase() : "";

    // Skip if already up-to-date
    if (data.searchName === searchName && data.email === emailLower) {
      skipped++;
      continue;
    }

    await updateDoc(doc(db, "users", docSnap.id), {
      searchName,
      email: emailLower,
    });
    console.log(`  ✅ Updated: ${displayName} (${emailLower}) → searchName: "${searchName}"`);
    updated++;
  }

  console.log(`\n✨ Done! Updated: ${updated} | Already up-to-date: ${skipped}`);
  process.exit(0);
}

backfill().catch((err) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});
