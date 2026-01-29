const admin = require('firebase-admin');
const fs = require('fs');
const csv = require('csv-parser');

// Path to your service account key
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function importCSV() {
  const results = [];

  // Read the CSV file into memory
  fs.createReadStream('students.csv')
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      console.log(`CSV loaded. Preparing to import ${results.length} students...`);

      for (const row of results) {
        const email = row.email?.trim().toLowerCase();
        const fullname = row.fullname?.trim();
        const studentId = row.studentId?.trim();

        if (!email || !fullname) {
          console.error(`⚠️ Skipping invalid row: Missing email or name.`);
          continue;
        }

        try {
          // 1. Create the user in Firebase Auth
          const userRecord = await auth.createUser({
            email: email,
            password: row.password ? row.password.trim() : studentId,
            displayName: fullname,
          });

          // 2. Create profile in Firestore
          // We use the Auth UID as the Document ID to link them perfectly
          await db.collection('users').doc(userRecord.uid).set({
            name: fullname,         // Matches userData.name in your React Native code
            fullname: fullname,     // Redundant but safe for debugging
            email: email,
            studentId: studentId,
            age: row.age || "N/A",
            gender: row.gender || "N/A",
            year: row.year || "N/A",   // Used for candidate filtering in UI
            block: row.block || "N/A", // Used for candidate filtering in UI
            role: "voter",
            hasVoted: false,        // Essential for VoterScreen logic
            ballot: null,           // Essential for VoterScreen logic
            votedAt: null           // Essential for VoterScreen logic
          });

          console.log(`✅ Imported: ${fullname}`);
        } catch (error) {
          console.error(`❌ Failed: ${email} -> ${error.message}`);
        }
      }
      console.log('--- Import Process Completed ---');
      process.exit();
    });
}

importCSV();