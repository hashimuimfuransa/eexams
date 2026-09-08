require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const PDFDocument = require('pdfkit');
const { renderPlannerResource } = require('./utils/plannerResourcePdf');
const { buildDocxBuffer } = require('./utils/docxExport');
const { KINDS } = require('./utils/plannerResourceBuilder');

const samples = {
  slides: {
    kind: 'slides', title: 'Les habits — vocabulaire', subject: 'French', className: 'P3',
    unitTitle: 'LES HABITS', schoolName: 'GS Kacyiru', teacherName: 'M. Uwase',
    slides: [
      { heading: 'Les habits', bullets: ['Vocabulaire de base', 'Objectif du jour'], notes: 'Saluer et présenter le thème.' },
      { heading: 'La chemise', bullets: ['Un vêtement du haut', 'Avec des boutons', 'Coût: 5 000 RWF'], notes: 'Montrer une vraie chemise.' },
      { heading: 'Résumé', bullets: ['Réviser les mots', 'Devoir: 5 phrases'], notes: 'Donner le devoir.' }
    ]
  },
  exercises: {
    kind: 'exercises', title: 'Les habits — exercices', subject: 'French', className: 'P3',
    instructions: 'Answer ALL questions. Write in the spaces provided.',
    items: [
      { number: '1', question: "Comment dit-on 'shirt' en français ?", options: ['La chemise', 'Le pantalon', 'La jupe', 'Le chapeau'], answer: 'La chemise', marks: '2' },
      { number: '2', question: 'Écris trois vêtements que tu portes à l’école.', options: [], answer: 'La chemise, le pantalon, les chaussures', marks: '3' }
    ]
  },
  scheme: {
    kind: 'scheme', title: 'French P3 — Term 3', subject: 'French', className: 'P3', term: 'Term 3', academicYear: '2026',
    weeks: [
      { week: '1', lessonNo: '1', unitTitle: 'LES HABITS', lessonTitle: 'Vocabulaire', objectives: 'Learners will be able to name clothing items.', activities: 'Group discussion, flashcards', materials: 'Real clothes, charts', assessment: 'Oral questioning' },
      { week: '2', lessonNo: '2', unitTitle: 'LES HABITS', lessonTitle: 'Les couleurs', objectives: 'Learners will be able to describe clothes by colour.', activities: 'Role play, drawing', materials: 'Markers, exercise books', assessment: 'Written exercise' }
    ]
  }
};

const lessonPlan = {
  lessonTitle: 'Les habits', subject: 'French', className: 'P3', schoolName: 'GS Kacyiru',
  teacherName: 'M. Uwase', term: 'Term 3', date: '2026-09-08', duration: '40 min',
  unitTitle: 'LES HABITS', keyUnitCompetence: 'Décrire les vêtements.',
  instructionalObjectives: 'By using real clothes, P3 learners will be able to name 5 items clearly.',
  learningMaterials: 'Real clothing items, charts', references: 'REB (2025). Livre de l’élève P3.',
  lessonOverview: 'Discovery through real objects.',
  steps: [
    { name: 'Introduction', duration: '7 min', teacherActivities: ['Greets learners.', 'Shows items.'], learnerActivities: ['Respond.', 'Observe.'], competences: ['Communication: expression.'] },
    { name: 'Lesson Development', duration: '25 min', teacherActivities: ['Guides group work.'], learnerActivities: ['Work in groups.'], competences: ['Cooperation: teamwork.'] },
    { name: 'Conclusion', duration: '8 min', teacherActivities: ['Summarises.', 'Gives homework.'], learnerActivities: ['Copy homework.'], competences: ['Lifelong learning.'] }
  ],
  selfEvaluation: 'Lesson went well.'
};

const out = path.join(os.tmpdir(), 'planner-export-check');
fs.mkdirSync(out, { recursive: true });

const pdfToFile = (resource, file) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', layout: resource.kind === 'scheme' ? 'landscape' : 'portrait', margin: 40, bufferPages: true });
  const stream = fs.createWriteStream(file);
  doc.pipe(stream);
  renderPlannerResource(doc, resource);
  doc.end();
  stream.on('finish', resolve);
  stream.on('error', reject);
});

(async () => {
  let bad = 0;
  const ok = (l, c) => { if (!c) bad++; console.log(`${c ? 'ok  ' : 'FAIL'} ${l}`); };

  for (const [kind, sample] of Object.entries(samples)) {
    const pdfFile = path.join(out, `${kind}.pdf`);
    await pdfToFile(sample, pdfFile);
    const pdfSize = fs.statSync(pdfFile).size;
    const pdfHead = fs.readFileSync(pdfFile).subarray(0, 5).toString();
    ok(`${kind.padEnd(9)} PDF  ${String(pdfSize).padStart(6)} bytes, header ${pdfHead}`, pdfHead === '%PDF-' && pdfSize > 1200);

    const buf = await buildDocxBuffer(sample, kind);
    // A .docx is a zip: PK\x03\x04.
    ok(`${kind.padEnd(9)} DOCX ${String(buf.length).padStart(6)} bytes, zip magic ${buf.subarray(0,2).toString()}`, buf.subarray(0, 2).toString() === 'PK' && buf.length > 3000);
    fs.writeFileSync(path.join(out, `${kind}.docx`), buf);
  }

  const lpBuf = await buildDocxBuffer(lessonPlan, 'lessonPlan');
  ok(`lessonPlan DOCX ${String(lpBuf.length).padStart(6)} bytes`, lpBuf.subarray(0, 2).toString() === 'PK' && lpBuf.length > 3000);
  fs.writeFileSync(path.join(out, 'lesson-plan.docx'), lpBuf);

  // Accents must survive into the DOCX XML (unlike the PDF's WinAnsi path).
  const AdmZip = (() => { try { return require('adm-zip'); } catch { return null; } })();
  if (AdmZip) {
    const xml = new AdmZip(lpBuf).readAsText('word/document.xml');
    ok('accents preserved in DOCX xml (élève)', xml.includes('élève'));
  } else {
    console.log('note: adm-zip not installed, skipped XML accent check');
  }

  ok('every KIND has a prompt + normalizer', Object.values(KINDS).every(k => typeof k.buildPrompt === 'function' && typeof k.normalize === 'function'));

  console.log(`\nfiles written to ${out}`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
