const crypto = require('crypto');

// implements:  https://docs.fondy.eu/en/docs/page/3/#chapter-3-5
const sign = (req) => {
  const sorted = Object.keys(req).sort().reduce((acc, key) => {
    acc[key] = req[key];
    return acc;
  }, {});
  const joined = 'test|' + Object.keys(sorted).map(key => sorted[key]).join('|');
  const hash = crypto.createHash('sha1');
  hash.update(joined);
  return hash.digest('hex');
};

// "signature":"df38818facfbfd79953fa847667dac73a1291127",
const req = {
    "order_id":"test123456",
    "order_desc":"test order",
    "currency":"USD",
    "amount":"125",
    "merchant_id":"1396424"
  }

console.log(sign(req));
