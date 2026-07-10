require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const backupService = require('../services/backupService');

function parseArgs(argv) {
  const args = { mode: 'replace' };
  for (const arg of argv) {
    if (arg === '--latest') args.latest = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes') args.yes = true;
    else if (arg.startsWith('--file=')) args.file = arg.slice('--file='.length);
    else if (arg.startsWith('--s3-key=')) args.s3Key = arg.slice('--s3-key='.length);
    else if (arg.startsWith('--collections=')) {
      args.collections = arg
        .slice('--collections='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--mode=')) args.mode = arg.slice('--mode='.length);
  }
  return args;
}

function usage() {
  console.log(`Usage: node scripts/restoreBackup.js <source> [options]

Source (exactly one required):
  --latest              Restore the most recent backup (checks local disk, then S3)
  --file=<path>         Restore a specific local backup file
  --s3-key=<key>         Restore a specific S3 backup (downloaded automatically)

Options:
  --dry-run             Print what would happen without writing anything
  --yes                 Required to actually write changes (safety guard)
  --collections=A,B     Only restore these collections (matched case-insensitively)
  --mode=replace|merge   replace (default): delete + reinsert each collection
                         merge: upsert by _id, leave untouched documents alone
`);
}

async function resolveSourceFile(args) {
  if (args.file) return path.resolve(args.file);

  if (args.s3Key) {
    const dest = path.join(backupService.BACKUP_DIR, 'restore-tmp', path.basename(args.s3Key));
    console.log(`Downloading s3://${process.env.S3_BUCKET_NAME}/${args.s3Key} ...`);
    await backupService.downloadFromS3(args.s3Key, dest);
    return dest;
  }

  if (args.latest) {
    const backups = await backupService.listAllBackups();
    const mostRecent = backups[0];
    if (!mostRecent) throw new Error('No backups found (local or S3)');

    if (mostRecent.location === 'local') {
      return path.join(backupService.BACKUP_DIR, mostRecent.name);
    }

    const dest = path.join(backupService.BACKUP_DIR, 'restore-tmp', mostRecent.name);
    console.log(`Downloading most recent backup from S3: ${mostRecent.key} ...`);
    await backupService.downloadFromS3(mostRecent.key, dest);
    return dest;
  }

  throw new Error('No source specified: pass --latest, --file=, or --s3-key=');
}

function loadDump(filePath) {
  const compressed = fs.readFileSync(filePath);
  const serialized = zlib.gunzipSync(compressed).toString('utf8');
  return EJSON.parse(serialized);
}

function filterCollections(dump, wantedNames) {
  if (!wantedNames || wantedNames.length === 0) return dump;
  const wantedLower = wantedNames.map((n) => n.toLowerCase());
  const filtered = {};
  for (const [name, docs] of Object.entries(dump)) {
    if (wantedLower.includes(name.toLowerCase())) filtered[name] = docs;
  }
  const found = Object.keys(filtered);
  const missing = wantedNames.filter((n) => !found.some((f) => f.toLowerCase() === n.toLowerCase()));
  if (missing.length > 0) {
    console.warn(`Warning: collection(s) not found in backup, skipping: ${missing.join(', ')}`);
  }
  return filtered;
}

async function restoreCollection(db, name, docs, mode) {
  const collection = db.collection(name);

  if (mode === 'merge') {
    if (docs.length === 0) return { inserted: 0, deleted: 0 };
    const ops = docs.map((doc) => ({
      replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
    }));
    const result = await collection.bulkWrite(ops, { ordered: false });
    return { upserted: (result.upsertedCount || 0) + (result.modifiedCount || 0) };
  }

  const deleteResult = await collection.deleteMany({});
  let insertedCount = 0;
  if (docs.length > 0) {
    const insertResult = await collection.insertMany(docs, { ordered: false });
    insertedCount = insertResult.insertedCount;
  }
  return { deleted: deleteResult.deletedCount, inserted: insertedCount };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.latest && !args.file && !args.s3Key) {
    usage();
    process.exit(1);
  }

  if (!['replace', 'merge'].includes(args.mode)) {
    console.error(`Invalid --mode=${args.mode}, must be "replace" or "merge"`);
    process.exit(1);
  }

  const sourceFile = await resolveSourceFile(args);
  console.log(`Reading backup: ${sourceFile}`);
  const dump = filterCollections(loadDump(sourceFile), args.collections);
  const collectionNames = Object.keys(dump);

  if (collectionNames.length === 0) {
    console.log('Nothing to restore (no matching collections in backup).');
    return;
  }

  console.log(`\nRestore plan (mode: ${args.mode}):`);
  for (const name of collectionNames) {
    console.log(`  ${name}: ${dump[name].length} document(s)`);
  }
  if (args.mode === 'replace') {
    console.log('\nreplace mode will DELETE all existing documents in each collection above before reinserting.');
  }

  if (args.dryRun) {
    console.log('\nDry run: no changes written.');
    return;
  }

  if (!args.yes) {
    console.error('\nRefusing to write without --yes. Re-run with --dry-run first if unsure.');
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`\nConnected to database: ${mongoose.connection.db.databaseName}`);

  try {
    for (const name of collectionNames) {
      const stats = await restoreCollection(mongoose.connection.db, name, dump[name], args.mode);
      console.log(`  ${name}: ${JSON.stringify(stats)}`);
    }
    console.log('\nRestore complete.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Restore failed:', err);
  process.exit(1);
});
