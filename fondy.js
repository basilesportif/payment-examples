import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import express from 'express';
import open from 'open';

/* **** Fondy API Utils **** */
const TEST_MERCHANT_ID = '1396424';
const TEST_PASSWORD = 'test';
const API_ACCEPT_PAYMENT_FLOW_B = 'https://api.fondy.eu/api/checkout/url/';
const API_CAPTURE_PAYMENT = 'https://api.fondy.eu/api/capture/order_id/';
const API_REFUND_PAYMENT = 'https://api.fondy.eu/api/reverse/order_id/';

// implements:  https://docs.fondy.eu/en/docs/page/3/#chapter-3-5
// returns: original request with signature field added
const getSignature = (password, req) => {
  const sorted = Object.keys(req).sort().reduce((acc, key) => {
    acc[key] = req[key];
    return acc;
  }, {});
  const joined = 
    `${password}|` + 
    Object.keys(sorted).map(key => sorted[key]).join('|');
  const signature = crypto.createHash('sha1')
    .update(joined)
    .digest('hex');
  return { ...sorted, signature };
};

const getTestSignature = (req) => {
  return getSignature(TEST_PASSWORD, req);
};

const callFondyTest = async ({apiUrl, req}) => {
  const signedReq = getTestSignature(req);
  const res = await 
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({request: signedReq}),
    });
  return await res.json();
};

/* https://docs.fondy.eu/en/docs/page/12/ */
const capturePayment = async ({order_id, amount, currency}) => {
  const req = {
    order_id,
    merchant_id: TEST_MERCHANT_ID,
    amount,
    currency,
    version: "1.0",
  };
  console.log(req);
  return await callFondyTest({
    apiUrl: API_CAPTURE_PAYMENT,
    req
  });
};

/* https://docs.fondy.eu/en/docs/page/7/ */
const refundPayment = async ({order_id, amount, currency}) => {
  const req = {
    order_id,
    merchant_id: TEST_MERCHANT_ID,
    amount,
    currency,
    version: "1.0",
    comment: "stylist rejected booking",
  };
  console.log(req);
  return await callFondyTest({
    apiUrl: API_REFUND_PAYMENT,
    req
  });
};

const mkReq = ({order_id, order_desc, amount, currency}) => {
  return {
    order_id,
    order_desc,
    currency,
    amount,
    merchant_id: TEST_MERCHANT_ID,
    server_callback_url: 'http://localhost:3000/server_callback_url',
    response_url: 'http://localhost:3000/response_url',
    sender_email: "tim@blah.com",
  };
};

const withPreAuth = (fondyReq) => {
  return {
    ...fondyReq,
    preauth: 'Y',
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
    updateOrderDb({ ...order, preauth: true, captured: false });
    res.status(200).send(
      `<html><body>
      <pre>${strBody}</pre>
      <a href="http://localhost:3000/accept_booking/${order.order_id}">
        <button>Accept Booking</button>
      </a>
      <br/>
      <a href="http://localhost:3000/reject_booking/${order.order_id}">
        <button>Reject Booking</button>
      </a>
      </body></html>`
    );
  });
  app.get('/accept_booking/:order_id', async (req, res) => {
    console.log('accept_booking');
    const order = getOrderDb(req.params.order_id);
    let strResult;
    if (order.preauth) {
      const result = await capturePayment(order);
      strResult = JSON.stringify(result, undefined, 2);
      updateOrderDb({ ...order, captured: true });
    }
    else {
      strResult = "preauth not done; can't capture payment";
    }
    const strOrder = JSON.stringify(getOrderDb(req.params.order_id), undefined, 2);
    res.status(200).send(
      `<html><body>
      <pre>${strOrder}</pre>
      <pre>${strResult}</pre>
      </body></html>`
    );
  });
  app.get('/reject_booking/:order_id', async (req, res) => {
    console.log('reject_booking');
    const order = getOrderDb(req.params.order_id);
    let strResult;
    if (order.preauth) {
      const result = await refundPayment(order);
      strResult = JSON.stringify(result, undefined, 2);
      updateOrderDb({ ...order, captured: false, refunded: true });
    }
    else {
      strResult = "preauth not done; can't refund payment";
    }
    const strOrder = JSON.stringify(getOrderDb(req.params.order_id), undefined, 2);
    res.status(200).send(
      `<html><body>
      <pre>${strOrder}</pre>
      <pre>${strResult}</pre>
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
  const result = await callFondyTest({
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