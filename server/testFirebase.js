require('dotenv').config();
const { db } = require('./config/firebase');

async function check() {
  const snapshot = await db.collection('mapped_patients').get();
  console.log('Total mapped patients:', snapshot.size);
  snapshot.forEach(doc => console.log(doc.id, doc.data()));
  process.exit(0);
}
check();
