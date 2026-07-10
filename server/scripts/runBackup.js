require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const backupService = require('../services/backupService');

async function main() {
  const noS3 = process.argv.includes('--no-s3');

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to database: ${mongoose.connection.db.databaseName}`);

  try {
    const result = await backupService.runBackup({ uploadToS3: !noS3 });
    console.log('\nBackup complete:', result.fileName);
    console.log(`  Local path: ${result.filePath}`);
    if (result.s3Key) console.log(`  S3 key: ${result.s3Key}`);
    if (result.s3Error) console.log(`  S3 upload failed: ${result.s3Error}`);
    for (const [name, count] of Object.entries(result.collectionCounts)) {
      console.log(`  ${name}: ${count} documents`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
