require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

async function backupDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set in .env');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups', timestamp);
  fs.mkdirSync(backupDir, { recursive: true });

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  console.log(`Connected to database: ${db.databaseName}`);
  const collections = await db.listCollections().toArray();
  console.log(`Found ${collections.length} collections`);

  for (const { name } of collections) {
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(
      path.join(backupDir, `${name}.json`),
      JSON.stringify(docs, null, 2)
    );
    console.log(`  Backed up ${name}: ${docs.length} documents`);
  }

  await client.close();
  console.log(`\nBackup complete: ${backupDir}`);
}

backupDatabase().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
