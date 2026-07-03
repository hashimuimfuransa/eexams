// Generates a PDF invoice for a paid (level or exam) subscription and
// streams it directly to an Express response.
const PDFDocument = require('pdfkit');

const BRAND_NAVY = '#0D406C';
const BRAND_GREEN = '#0CBD73';
const TEXT_MUTED = '#64748B';
const BORDER = '#E2E8F0';

const formatDate = (date) => new Date(date).toLocaleDateString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric'
});

const formatMoney = (amount, currency) => `${Number(amount || 0).toLocaleString()} ${currency || 'RWF'}`;

/**
 * Stream a subscription invoice PDF to the given Express response.
 * @param {Object} res - Express response (headers must not be sent yet)
 * @param {Object} subscription - Subscription doc populated with user, level, plan, exam
 */
const streamSubscriptionInvoice = (res, subscription) => {
  const invoiceNumber = `INV-${String(subscription._id).slice(-8).toUpperCase()}`;
  const isExamPlan = subscription.planType === 'exam' && subscription.exam;

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoiceNumber}.pdf"`);
  doc.pipe(res);

  // ── Header band ──
  doc.rect(0, 0, doc.page.width, 90).fill(BRAND_NAVY);
  doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold').text('EExams', 50, 30);
  doc.fontSize(10).font('Helvetica').fillColor('#DCE7F0').text('Exam Subscription Invoice', 50, 58);

  doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
    .text(invoiceNumber, 0, 30, { align: 'right', width: doc.page.width - 50 });
  doc.fontSize(9).font('Helvetica').fillColor('#DCE7F0')
    .text(`Issued: ${formatDate(new Date())}`, 0, 48, { align: 'right', width: doc.page.width - 50 });

  doc.y = 120;
  doc.fillColor('#000000');

  // ── Bill to / Payment summary ──
  const colLeftX = 50;
  const colRightX = 320;
  const topY = doc.y;

  doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXT_MUTED).text('BILLED TO', colLeftX, topY);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000')
    .text(`${subscription.user?.firstName || ''} ${subscription.user?.lastName || ''}`.trim() || 'Student', colLeftX, topY + 16);
  doc.font('Helvetica').fontSize(10).fillColor(TEXT_MUTED).text(subscription.user?.email || '', colLeftX, topY + 34);

  doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXT_MUTED).text('PAYMENT STATUS', colRightX, topY);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(BRAND_GREEN).text('PAID', colRightX, topY + 16);
  doc.font('Helvetica').fontSize(10).fillColor(TEXT_MUTED)
    .text(`Reference: ${subscription.paymentReference || '—'}`, colRightX, topY + 34, { width: doc.page.width - colRightX - 50 });

  doc.y = topY + 70;
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(BORDER).stroke();
  doc.moveDown(1.5);

  // ── Line item table ──
  const tableTop = doc.y;
  const col1 = 50;   // Description
  const col2 = 340;  // Coverage
  const col3 = 440;  // Duration
  const col4 = 500;  // Amount (right edge)

  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT_MUTED);
  doc.text('DESCRIPTION', col1, tableTop);
  doc.text('COVERAGE', col2, tableTop);
  doc.text('DURATION', col3, tableTop);
  doc.text('AMOUNT', col4, tableTop, { width: doc.page.width - 50 - col4, align: 'right' });

  doc.moveTo(50, tableTop + 16).lineTo(doc.page.width - 50, tableTop + 16).strokeColor(BORDER).stroke();

  const rowY = tableTop + 26;
  const durationDays = subscription.plan?.durationDays;
  const durationLabel = subscription.plan?.durationUnit === 'hours'
    ? `${subscription.plan?.durationValue ?? Math.round((durationDays || 0) * 24)} hour(s)`
    : `${subscription.plan?.durationValue ?? durationDays ?? '—'} day(s)`;
  const coverageLabel = isExamPlan
    ? (subscription.exam?.title || 'Single exam')
    : `${subscription.level?.name || 'Level'}${subscription.subLevel ? ` — ${subscription.subLevel}` : ''}`;

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000')
    .text(subscription.plan?.name || (isExamPlan ? 'Exam Subscription' : 'Level Subscription'), col1, rowY, { width: col2 - col1 - 10 });
  doc.font('Helvetica').fontSize(10).fillColor(TEXT_MUTED)
    .text(isExamPlan ? 'Single-exam access' : 'Level-wide exam access', col1, rowY + 16, { width: col2 - col1 - 10 });

  doc.font('Helvetica').fontSize(10).fillColor('#000000').text(coverageLabel, col2, rowY, { width: col3 - col2 - 10 });
  doc.font('Helvetica').fontSize(10).fillColor('#000000').text(durationLabel, col3, rowY, { width: col4 - col3 });
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000')
    .text(formatMoney(subscription.amountPaid, subscription.currency), col4, rowY, { width: doc.page.width - 50 - col4, align: 'right' });

  doc.y = rowY + 50;
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(BORDER).stroke();
  doc.moveDown(1);

  // ── Total ──
  const totalY = doc.y;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(TEXT_MUTED).text('Total Paid', 340, totalY, { width: 100 });
  doc.font('Helvetica-Bold').fontSize(16).fillColor(BRAND_NAVY)
    .text(formatMoney(subscription.amountPaid, subscription.currency), 340, totalY + 18, { width: doc.page.width - 50 - 340, align: 'right' });

  doc.y = totalY + 55;

  // ── Details grid ──
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(BORDER).stroke();
  doc.moveDown(1.5);
  const detailsY = doc.y;
  const details = [
    ['Payment Method', (subscription.paymentMethod || '—').replace(/_/g, ' ').toUpperCase()],
    ['Subscription Start', formatDate(subscription.startsAt)],
    ['Subscription Expires', formatDate(subscription.expiresAt)],
    ['Status', (subscription.status || '—').toUpperCase()],
  ];
  details.forEach((row, i) => {
    const y = detailsY + i * 20;
    doc.font('Helvetica').fontSize(10).fillColor(TEXT_MUTED).text(row[0], 50, y, { width: 200 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text(row[1], 250, y, { width: 250 });
  });

  // ── Footer ──
  doc.fontSize(8).fillColor(TEXT_MUTED)
    .text('This is a computer-generated invoice and does not require a signature.', 50, doc.page.height - 60, {
      align: 'center', width: doc.page.width - 100
    });

  doc.end();
};

module.exports = { streamSubscriptionInvoice };
