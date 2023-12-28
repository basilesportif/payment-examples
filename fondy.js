import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import express from 'express';
import open from 'open';

/* **** Fondy API Utils **** */
const API_ACCEPT_PAYMENT_FLOW_B = 'https://api.fondy.eu/api/checkout/url/';

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

const callFondy = async ({apiUrl, req}) => {
  const res = await 
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({request: getSignature(req)}),
    });
  return await res.json();
};

const mkReq = ({order_id, order_desc, amount, currency}) => {
  return {
    order_id,
    order_desc,
    currency,
    amount,
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

/* orders indexed by order_id */
var orderDb = {};

const insertOrderDb = (order) => {
  orderDb[order.order_id] = order;
};

const updateOrderDb = (updatedOrder) => {
  orderDb[updatedOrder.order_id] = updatedOrder;
};

const getOrderDb = (order_id) => {
  return orderDb[order_id];
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
    const order = getOrderDb(req.body.order_id);
    updateOrderDb({...order, rectoken: req.body.rectoken});
    res.status(200).send(
      `<html><body>
      <pre>${strBody}</pre>
      <a href="http://localhost:3000/accept_booking/${order.order_id}">
        <button>Accept Booking</button>
      </a>
      </body></html>`
    );
  });
  app.get('/accept_booking/:order_id', (req, res) => {
    console.log('accept_booking');
    const order_id = req.params.order_id;
    const strOrder = JSON.stringify(getOrderDb(order_id), undefined, 2);
    res.status(200).send(
      `<html><body>
      <pre>${strOrder}</pre>
      </body></html>`
    );
  });
  
  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
};

const run = async () => {
  const order = {
    order_id: uuidv4(),
    order_desc: 'Stylist: Ganna',
    amount: 45200,
    currency: 'USD'};
  insertOrderDb(order);
  const fondyReq = mkReq(order);
  const result = await callFondy({
    apiUrl: API_ACCEPT_PAYMENT_FLOW_B,
    req: withPreAuth(fondyReq)
  });
  console.log(result);
  open(result.response.checkout_url);  //open in default browser
  runServer();
};

// use uuidv4() for order_id

//TODO 
// payoutStylistCard
// captureForStylistCard

run();
