const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// implements:  https://docs.fondy.eu/en/docs/page/3/#chapter-3-5
// returns: original request with signature field added
const getSignature = (req) => {
  const sorted = Object.keys(req).sort().reduce((acc, key) => {
    acc[key] = req[key];
    return acc;
  }, {});
  const joined = 'test|' + Object.keys(sorted).map(key => sorted[key]).join('|');
  const hash = crypto.createHash('sha1');
  hash.update(joined);
  return { ...sorted, signature: hash.digest('hex') };
};

const genReq = () => {
  return {
  "order_id": uuidv4(),
  "order_desc":"test order 2",
  "currency":"USD",
  "amount":"125",
  "merchant_id":"1396424",
  "server_callback_url":"http://myshop/callback/",
  "response_url":"http://myshop/return/",
  }
}

// signature: 91ea7da493a8367410fe3d7f877fb5e0ed666490
const staticReq = {
  "server_callback_url": "http://myshop/callback/",
  "order_id": "TestOrder2",
  "currency": "USD",
  "merchant_id": "1396424",
  "order_desc": "Test payment",
  "amount": "1000",
}

/*
// Interaction A: TODO doesn't work with these params
var res = 
fetch('https://pay.fondy.eu/api/checkout/redirect', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({request: getSignature(genReq())})
});
res.then(r => r.text()).then(console.log);
*/

// Interaction B
var res =
fetch('https://pay.fondy.eu/api/checkout/url', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({request: getSignature(genReq())}),
});
res.then(r => r.json()).then(console.log);
