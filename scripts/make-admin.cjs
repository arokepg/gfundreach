// Usage: node scripts/make-admin.cjs <USER_UID> --role=admin --serviceAccount=./serviceAccountKey.json
// This script uses firebase-admin and requires a service account JSON.

const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.error('Usage: node scripts/make-admin.cjs <USER_UID> [--role=admin] [--serviceAccount=./serviceAccount.json]');
  process.exit(2);
}

const uid = process.argv[2];
const roleArg = process.argv.find(a => a.startsWith('--role=')) || '--role=admin';
const role = roleArg.split('=')[1] || 'admin';
const saArg = process.argv.find(a => a.startsWith('--serviceAccount=')) || '--serviceAccount=./serviceAccountKey.json';
const saPath = saArg.split('=')[1];

if (!fs.existsSync(saPath)) {
  console.error('Service account file not found:', saPath);
  process.exit(2);
}

const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(require(path.resolve(saPath)))
});

const db = admin.firestore();

async function setRole(uid, role) {
  const ref = db.collection('users').doc(uid);
  await ref.set({ role }, { merge: true });
  console.log(`Set role=${role} for user ${uid}`);
}

setRole(uid, role)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
