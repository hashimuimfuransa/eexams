require('dotenv').config();
const mongoose = require('mongoose');
require('./models/Level');
require('./models/Question');
require('fs').readdirSync('./models').filter(f=>f.endsWith('.js')).forEach(f=>require('./models/'+f));
require('./models/Exam');
require('./models/User');
const { getDetailedResult } = require('./controllers/studentController');

const RESULT_ID = process.argv[2];
const STUDENT_ID = process.argv[3];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const req = { params: { resultId: RESULT_ID }, user: { _id: new mongoose.Types.ObjectId(STUDENT_ID) } };
  const res = {
    status(code) { this._code = code; return this; },
    json(payload) {
      console.log('\n==== HTTP', this._code || 200, '====');
      console.log('exam        :', payload?.exam?.title);
      console.log('retakeInfo  :', payload?.retakeInfo || payload);
    }
  };

  await getDetailedResult(req, res);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
