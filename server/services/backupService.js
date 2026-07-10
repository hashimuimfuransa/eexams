const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const cron = require('node-cron');
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.join(__dirname, '..', 'backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 14;
const BACKUP_HOUR = parseInt(process.env.BACKUP_HOUR, 10);
const S3_BUCKET = process.env.S3_BUCKET_NAME;
const S3_PREFIX = 'backups/database/';
const EXCLUDED_COLLECTIONS = (process.env.BACKUP_EXCLUDE_COLLECTIONS || '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

const FILENAME_RE = /^backup-.+\.ejson\.gz$/;

function timestampForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function filenameFor(date) {
  return `backup-${timestampForFilename(date)}.ejson.gz`;
}

function s3Client() {
  return new S3Client({ region: process.env.AWS_REGION });
}

/**
 * Dumps every collection in the connected database to a single gzip-compressed
 * EJSON file. Uses the mongoose connection already established by the app -
 * no mongodump/mongorestore binary required.
 */
async function dumpDatabaseToFile(filePath) {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('No active MongoDB connection to back up');
  }

  const collections = await db.listCollections().toArray();
  const dump = {};

  for (const { name } of collections) {
    if (EXCLUDED_COLLECTIONS.includes(name)) continue;
    dump[name] = await db.collection(name).find({}).toArray();
  }

  const serialized = EJSON.stringify(dump);
  const compressed = zlib.gzipSync(Buffer.from(serialized, 'utf8'));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, compressed);

  const collectionCounts = Object.fromEntries(
    Object.entries(dump).map(([name, docs]) => [name, docs.length])
  );
  return { collectionCounts, sizeBytes: compressed.length };
}

async function uploadToS3(filePath) {
  if (!S3_BUCKET) return null;
  const key = S3_PREFIX + path.basename(filePath);
  const body = fs.readFileSync(filePath);
  await s3Client().send(
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: body })
  );
  return key;
}

/**
 * Runs a full backup: dump -> gzip -> local write -> (optional) S3 upload -> retention cleanup.
 * If the S3 upload fails, the local file is kept and the job does not throw.
 */
async function runBackup({ uploadToS3: shouldUploadToS3 = true } = {}) {
  const startedAt = new Date();
  const fileName = filenameFor(startedAt);
  const filePath = path.join(BACKUP_DIR, fileName);

  console.log(`[backup] Starting database backup -> ${filePath}`);
  const { collectionCounts, sizeBytes } = await dumpDatabaseToFile(filePath);
  console.log(
    `[backup] Wrote ${fileName} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB), ` +
      `${Object.keys(collectionCounts).length} collections`
  );

  let s3Key = null;
  let s3Error = null;
  if (shouldUploadToS3 && S3_BUCKET) {
    try {
      s3Key = await uploadToS3(filePath);
      console.log(`[backup] Uploaded to s3://${S3_BUCKET}/${s3Key}`);
    } catch (err) {
      s3Error = err.message;
      console.error('[backup] S3 upload failed, keeping local file only:', err.message);
    }
  }

  await cleanupOldBackups().catch((err) =>
    console.error('[backup] Retention cleanup failed:', err.message)
  );

  return { fileName, filePath, sizeBytes, collectionCounts, s3Key, s3Error, startedAt };
}

function listLocalBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => FILENAME_RE.test(name))
    .map((name) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, name));
      return { name, location: 'local', sizeBytes: stat.size, modifiedAt: stat.mtime };
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
}

async function listS3Backups() {
  if (!S3_BUCKET) return [];
  const results = [];
  let ContinuationToken;
  do {
    const page = await s3Client().send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: S3_PREFIX,
        ContinuationToken,
      })
    );
    for (const obj of page.Contents || []) {
      const name = obj.Key.slice(S3_PREFIX.length);
      if (!FILENAME_RE.test(name)) continue;
      results.push({
        name,
        location: 's3',
        key: obj.Key,
        sizeBytes: obj.Size,
        modifiedAt: obj.LastModified,
      });
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return results.sort((a, b) => b.modifiedAt - a.modifiedAt);
}

async function listAllBackups() {
  const [local, s3] = await Promise.all([listLocalBackups(), listS3Backups()]);
  return [...local, ...s3].sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
}

async function cleanupOldBackups() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  for (const backup of listLocalBackups()) {
    if (new Date(backup.modifiedAt).getTime() < cutoff) {
      fs.unlinkSync(path.join(BACKUP_DIR, backup.name));
      console.log(`[backup] Deleted expired local backup: ${backup.name}`);
    }
  }

  if (S3_BUCKET) {
    for (const backup of await listS3Backups()) {
      if (new Date(backup.modifiedAt).getTime() < cutoff) {
        await s3Client().send(
          new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: backup.key })
        );
        console.log(`[backup] Deleted expired S3 backup: ${backup.name}`);
      }
    }
  }
}

/**
 * Downloads an S3 backup to a local path (used by the restore CLI, which needs
 * a real file on disk to stream-decompress).
 */
async function downloadFromS3(key, destPath) {
  const res = await s3Client().send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key })
  );
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(destPath);
    res.Body.pipe(stream);
    res.Body.on('error', reject);
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  return destPath;
}

/**
 * Safety net for hosts where the process isn't guaranteed to be alive at the
 * scheduled hour (e.g. Render web services spinning down): on boot, back up
 * immediately if the most recent backup is missing or more than 24h old.
 */
async function ensureRecentBackup() {
  const backups = await listAllBackups();
  const mostRecent = backups[0];
  const staleCutoff = Date.now() - 24 * 60 * 60 * 1000;

  if (!mostRecent || new Date(mostRecent.modifiedAt).getTime() < staleCutoff) {
    console.log('[backup] No recent backup found on boot, running catch-up backup now');
    await runBackup();
  } else {
    console.log(`[backup] Most recent backup (${mostRecent.name}) is recent enough, skipping catch-up`);
  }
}

function schedule() {
  if (process.env.BACKUP_ENABLED === 'false') {
    console.log('[backup] BACKUP_ENABLED=false, scheduled backups disabled');
    return;
  }

  const hour = Number.isInteger(BACKUP_HOUR) && BACKUP_HOUR >= 0 && BACKUP_HOUR <= 23 ? BACKUP_HOUR : 2;
  const expression = `0 ${hour} * * *`;

  cron.schedule(expression, async () => {
    try {
      await runBackup();
    } catch (err) {
      console.error('[backup] Scheduled backup failed:', err);
    }
  });

  console.log(`[backup] Scheduled daily database backup at ${hour}:00 server time (cron: "${expression}")`);
}

module.exports = {
  BACKUP_DIR,
  RETENTION_DAYS,
  runBackup,
  listAllBackups,
  listLocalBackups,
  listS3Backups,
  cleanupOldBackups,
  downloadFromS3,
  ensureRecentBackup,
  schedule,
};
