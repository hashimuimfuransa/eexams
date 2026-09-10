// Recorder for teacher tool telemetry (see models/ToolUsage.js).
//
// Every call site is on a path a teacher is waiting on — an AI generation, a
// download — so recording is fire-and-forget by design: the write is never
// awaited by the handler and a failure here can never turn a working tool into
// an error. A lost usage row is a gap in a report; a thrown error is a teacher
// who cannot generate a lesson plan.
const ToolUsage = require('../models/ToolUsage');

// Mirrors attachOrgAdminId in middleware/role.js, but as a pure function:
// most tool routes do not run that middleware (they have no org-scoped query
// to build), and the usage row still needs to know which organisation the
// output belongs to.
const resolveOrgAdminId = (user) => {
  if (!user) return null;
  if (user.role === 'teacher' && user.parentAdmin) return user.parentAdmin;
  if (user.role === 'superadmin') return null;
  return user._id;
};

// `req` is used only for the authenticated user; passing the user directly is
// also supported for call sites that have no request in scope.
const recordToolUsage = (reqOrUser, payload = {}) => {
  try {
    const user = reqOrUser?.user || reqOrUser;
    if (!user?._id) return null;

    const doc = {
      user: user._id,
      orgAdminId: resolveOrgAdminId(user),
      userRole: user.role || '',
      organization: user.organization || '',
      tool: payload.tool,
      action: payload.action,
      status: payload.status || 'success',
      format: (payload.format || '').toString().slice(0, 10),
      title: (payload.title || '').toString().slice(0, 200),
      subject: (payload.subject || '').toString().slice(0, 120),
      className: (payload.className || '').toString().slice(0, 120),
      resource: payload.resource || null,
      durationMs: payload.durationMs || 0,
      meta: payload.meta || {}
    };

    // .create() returns a promise the caller does not await; swallow the
    // rejection here so an unhandled rejection can never crash the process.
    return ToolUsage.create(doc).catch((err) => {
      console.error('recordToolUsage failed:', err.message);
      return null;
    });
  } catch (err) {
    console.error('recordToolUsage failed:', err.message);
    return null;
  }
};

// Timer helper so a route can report how long the model actually took without
// threading a start variable through every branch.
const startTimer = () => {
  const t0 = Date.now();
  return () => Date.now() - t0;
};

// Trims an error down to something safe to store on a `failed` event.
const errorMeta = (err) => ({
  error: (err?.message || String(err || 'Unknown error')).slice(0, 300)
});

module.exports = {
  recordToolUsage,
  resolveOrgAdminId,
  startTimer,
  errorMeta
};
