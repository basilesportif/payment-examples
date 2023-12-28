const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const express = require('express');

/* **** Fondy API Utils **** */
const API_INTERACTION_B = 'https://api.fondy.eu/api/checkout/url/';

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

const callFondy = async (apiUrl, fondyReq) => {
  const res = await 
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({request: getSignature(fondyReq)}),
    });
  return await res.json();
};

const mkReq = (order_id, order_desc) => {
  return {
    order_id,
    order_desc,
    currency: 'USD',
    amount: '45200',
    merchant_id: '1396424',
    server_callback_url: 'http://localhost:3000/server_callback_url',
    response_url: 'http://localhost:3000/response_url',
    sender_email: "tim@blah.com",
  };
};

const withPreAuth = (fondyReq) => {
  return {
    ...fondyReq,
    preauth: 'Y',
    required_rectoken: 'Y',
  };
};
/* **** end Fondy API Utils **** */


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
  const fondyReq = mkReq(uuidv4(), 'Stylist: Ganna');
  const result = await callFondy(API_INTERACTION_B, withPreAuth(fondyReq));
  console.log(result);
  runServer();
};

// use uuidv4() for order_id

//TODO 
// payoutStylistCard
// captureForStylistCard

run();
