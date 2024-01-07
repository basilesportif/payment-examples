import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import express from 'express';
import open from 'open';

/* **** Fondy API Utils **** */
const TEST_MERCHANT_ID = '1396424';
const TEST_PASSWORD = 'test';
const TEST_CREDIT_PASSWORD = 'testcredit';
const API_ACCEPT_PAYMENT_FLOW_B = 'https://api.fondy.eu/api/checkout/url/';
const API_CAPTURE_PAYMENT = 'https://api.fondy.eu/api/capture/order_id/';
const API_REFUND_PAYMENT = 'https://api.fondy.eu/api/reverse/order_id/';
const API_P2P_CREDIT = 'https://api.fondy.eu/api/p2pcredit/';

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

const callFondy = async ({password, apiUrl, req}) => {
  const signedReq = getSignature(password, req);
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
  return await callFondy({
    password: TEST_PASSWORD,
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
  return await callFondy({
    password: TEST_PASSWORD,
    apiUrl: API_REFUND_PAYMENT,
    req
  });
};

const doP2PPayment = async ({card, amount, currency}) => {
  const req = {
    order_id: uuidv4(),
    order_desc: `payment to ${card}`,
    amount,
    currency,
    version: "1.0",
    receiver_card_number: card,
    merchant_id: TEST_MERCHANT_ID,
  };
  console.log(req);
  return await callFondy({
    password: TEST_CREDIT_PASSWORD,
    apiUrl: API_P2P_CREDIT,
    req
  });
};

const mkReq = ({order_id, order_desc, email, amount, currency}) => {
  return {
    order_id,
    order_desc,
    currency,
    amount,
    merchant_id: TEST_MERCHANT_ID,
    server_callback_url: 'http://116.203.79.97:3000/server_callback_url',
    response_url: 'http://localhost:3000/response_url',
    sender_email: email,
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
    res.send(`
      <html><body>
      <pre>${JSON.stringify(req.body, undefined, 2)}</pre>
      </body></html>
    `);
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
  app.get('/p2p_payment/:card/:amount', async (req, res) => {
    const card = req.params.card;
    const result = await doP2PPayment({
      card,
      amount: req.params.amount,
      currency: 'USD',
    });
    res.send(
      `<html><body>
      <pre>${JSON.stringify(result, undefined, 2)}</pre>
      </body></html>`
    );
  });
  app.post('/new_order', async (req, res) => {
    const order = {
      order_id: uuidv4(),
      order_desc: 'Stylist: Ganna',
      email: req.body.email,
      amount: req.body.amount,
      currency: 'USD'};
    insertOrderDb(order);
    const fondyReq = mkReq(order);
    console.log(withPreAuth(fondyReq));
    const result = await callFondy({
      password: TEST_PASSWORD,
      apiUrl: API_ACCEPT_PAYMENT_FLOW_B,
      req: withPreAuth(fondyReq)
    });
    console.log(result);
    if (result.response.response_status === 'success') {
      res.redirect(result.response.checkout_url);
    }
    else {
      const strResult = JSON.stringify(result, undefined, 2);
      res.send(
        `<html><body>
        <pre>${strResult}</pre>
        </body></html>`
      );
    }
  });
  app.get('/home', (req, res) => {
    const card1 = "4444555566661111";
    const amount = "42000";
    res.send(
      `<html><body>
      <a href="http://localhost:3000/p2p_payment/${card1}/${amount}">
        <button>Payout $${amount/100.0} to ${card1}</button>
      </a>
      <br/>
      <br/>
      <form action="/new_order" method="post">
        <label for="amount">Amount:</label><br>
        <input type="text" id="amount" name="amount" value="45200"><br>
        <label for="email">Email:</label><br>
        <input type="text" id="email" name="email" value="tim@blah.com"/><br/>
        <input type="submit" value="preauthorize new booking"/>
      </form>
      </body></html>`
    );
  });

  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
};

const run = async () => {
  open("http://localhost:3000/home");
  runServer();
};

run();
