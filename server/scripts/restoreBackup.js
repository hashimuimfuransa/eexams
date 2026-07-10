require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const mongoose = require('mongoose');
const backupService = require('../services/backupService');

const BATCH_SIZE = 500;

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

function matches(name, wantedLower) {
  return !wantedLower || wantedLower.includes(name.toLowerCase());
}

/** Cheap streaming pass: just counts documents per wanted collection, never holds them. */
async function planRestore(filePath, wantedNames) {
  const wantedLower = wantedNames ? wantedNames.map((n) => n.toLowerCase()) : null;
  const counts = {};
  let current = null;
  let currentWanted = false;

  await backupService.forEachDumpEntry(filePath, async (type, payload) => {
    if (type === 'collection-start') {
      current = payload;
      currentWanted = matches(current, wantedLower);
      if (currentWanted) counts[current] = 0;
    } else if (currentWanted) {
      counts[current]++;
    }
  });

  if (wantedNames) {
    const found = Object.keys(counts);
    const missing = wantedNames.filter((n) => !found.some((f) => f.toLowerCase() === n.toLowerCase()));
    if (missing.length > 0) {
      console.warn(`Warning: collection(s) not found in backup, skipping: ${missing.join(', ')}`);
    }
  }

  return counts;
}

function createCollectionWriter(db, name, mode) {
  let batch = [];
  let inserted = 0;
  let upserted = 0;

  async function flush() {
    if (batch.length === 0) return;
    if (mode === 'merge') {
      const ops = batch.map((doc) => ({
        replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
      }));
      const result = await db.collection(name).bulkWrite(ops, { ordered: false });
      upserted += (result.upsertedCount || 0) + (result.modifiedCount || 0);
    } else {
      const result = await db.collection(name).insertMany(batch, { ordered: false });
      inserted += result.insertedCount;
    }
    batch = [];
  }

  return {
    async deleteExisting() {
      const result = await db.collection(name).deleteMany({});
      return result.deletedCount;
    },
    async push(doc) {
      batch.push(doc);
      if (batch.length >= BATCH_SIZE) await flush();
    },
    async finish() {
      await flush();
      return mode === 'merge' ? { upserted } : { inserted };
    },
  };
}

/** Batched streaming pass: writes to MongoDB in chunks of BATCH_SIZE, never holds a full collection. */
async function performRestore(db, filePath, wantedNames, mode) {
  const wantedLower = wantedNames ? wantedNames.map((n) => n.toLowerCase()) : null;
  const summary = {};
  let current = null;
  let currentWanted = false;
  let writer = null;

  async function closeCurrent() {
    if (!writer) return;
    const stats = await writer.finish();
    summary[current] = { ...(summary[current] || {}), ...stats };
    writer = null;
  }

  await backupService.forEachDumpEntry(filePath, async (type, payload) => {
    if (type === 'collection-start') {
      await closeCurrent();
      current = payload;
      currentWanted = matches(current, wantedLower);
      if (currentWanted) {
        writer = createCollectionWriter(db, current, mode);
        if (mode === 'replace') {
          summary[current] = { deleted: await writer.deleteExisting() };
        }
      }
    } else if (currentWanted) {
      await writer.push(payload.doc);
    }
  });
  await closeCurrent();

  return summary;
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
  const counts = await planRestore(sourceFile, args.collections);
  const collectionNames = Object.keys(counts);

  if (collectionNames.length === 0) {
    console.log('Nothing to restore (no matching collections in backup).');
    return;
  }

  console.log(`\nRestore plan (mode: ${args.mode}):`);
  for (const name of collectionNames) {
    console.log(`  ${name}: ${counts[name]} document(s)`);
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
    const summary = await performRestore(mongoose.connection.db, sourceFile, args.collections, args.mode);
    for (const [name, stats] of Object.entries(summary)) {
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
