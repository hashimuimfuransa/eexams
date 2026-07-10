require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const backupService = require('../services/backupService');

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  const backups = await backupService.listAllBackups();

  if (backups.length === 0) {
    console.log('No backups found.');
    return;
  }

  console.log(`Found ${backups.length} backup(s):\n`);
  for (const backup of backups) {
    console.log(
      `${backup.name}  [${backup.location}]  ${formatSize(backup.sizeBytes)}  ${new Date(backup.modifiedAt).toISOString()}`
    );
  }
}

main().catch((err) => {
  console.error('Failed to list backups:', err);
  process.exit(1);
});
