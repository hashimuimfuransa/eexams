/**
 * Backfill: lock share-roster entries for students who already completed the exam.
 *
 * validateExamAccess treats membership in an active SharedExam as a grant. That
 * grant is spent on submission, but only the /share/:token/submit path ever
 * marked the roster entry — students who joined by link and submitted through
 * the authenticated /exam/:id/complete path left `hasCompleted`/`isLocked`
 * false, so the middleware kept seeing a live grant and let them retake the
 * exam forever, long after their subscription lapsed.
 *
 * completeExam now marks the entry on submission. This script fixes the rows
 * that predate that change: any roster entry whose student already has a
 * completed Result for that exam is marked completed + locked. A teacher can
 * still hand out another attempt with the normal unlock action, which clears
 * both flags.
 *
 * Usage:
 *   node migrations/lock-completed-share-entries.js          # report only
 *   node migrations/lock-completed-share-entries.js --apply  # write changes
 */
require('dotenv').config();
const mongoose = require('mongoose');
const SharedExam = require('../models/SharedExam');
const Result = require('../models/Result');

const APPLY = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(APPLY ? 'Mode: APPLY (writing changes)' : 'Mode: DRY RUN (use --apply to write)');

  const shares = await SharedExam.find({ 'students.0': { $exists: true } })
    .select('exam students');

  let scanned = 0;
  let locked = 0;
  let sharesTouched = 0;

  for (const share of shares) {
    if (!share.exam) continue;

    let dirty = false;

    for (const entry of share.students) {
      scanned++;
      if (entry.hasCompleted || entry.isLocked) continue;

      const studentId = entry.student || entry.studentId;
      if (!studentId) continue;

      const completed = await Result.findOne({
        student: studentId,
        exam: share.exam,
        isCompleted: true
      }).select('_id').lean();

      if (!completed) continue;

      entry.hasCompleted = true;
      entry.isLocked = true;
      entry.isActiveSession = false;
      if (!entry.result) entry.result = completed._id;

      locked++;
      dirty = true;
      console.log(`  lock  share=${share._id} exam=${share.exam} student=${studentId} (${entry.email || 'no email'})`);
    }

    if (dirty) {
      sharesTouched++;
      if (APPLY) await share.save();
    }
  }

  console.log(`\nEntries scanned: ${scanned}`);
  console.log(`Entries locked:  ${locked} across ${sharesTouched} shared exams`);
  if (!APPLY) console.log('Nothing written — re-run with --apply.');

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
