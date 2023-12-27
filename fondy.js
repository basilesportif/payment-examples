const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const express = require('express');

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
  "server_callback_url":"http://localhost:3000/server_callback_url",
  "response_url":"http://localhost:3000/response_url",
  "sender_email": "tim@blah.com",
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

const withPreAuth = (fondyReq) => {
  return {
    ...fondyReq,
    preauth: 'Y',
    required_rectoken: 'Y',
  };
};

const runInteractionB = async (fondyReq) => {
  const res = await 
    fetch('https://pay.fondy.eu/api/checkout/url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({request: fondyReq}),
    });
  const json = await res.json();
  console.log(json);
  return json.response.checkout_url;
};

const runServer = () => {
  // indent all
  const app = express();
  const port = 3000;
  app.use(express.urlencoded({ extended: true }));
  
  app.post('/server_callback_url', (req, res) => {
    console.log('server_callback_url');
    res.send('server_callback_url');
  });
  app.post('/response_url', (req, res) => {
    console.log('response_url');
    console.log(req.body);
    const strBody = JSON.stringify(req.body, undefined, 2);
    res.status(200).send(`<html><body><pre>${strBody}</pre></body></html>`);
  });
  
  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
};

const run = async () => {
  const fondyReq = genReq();
  const withPreAuthReq = withPreAuth(fondyReq);
  const checkout_url = await runInteractionB(getSignature(withPreAuthReq));
  console.log(checkout_url);
  runServer();
};


//TODO 
// payoutStylistCard
// captureForStylistCard

run();
