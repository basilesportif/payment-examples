import express from 'express';
import open from 'open';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PORT = 3001;

const getAccountLink = async (domain, accountId) => {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${domain}/reauth/${accountId}`,
    return_url: `${domain}/return/${accountId}`,
    type: 'account_onboarding',
  });
  return accountLink;
};

// params is a JSON object: { "transfer_data[destination]": merchId }
const callStripe = async (uri, params) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  var formBody = [];
  for (var k in params) {
    formBody.push(`${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`);
  }
  formBody = formBody.join('&');
  const response = await fetch(uri, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formBody,
  });
  return await response.json();
};

const callStripeGet = async (uri) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const response = await fetch(uri, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      Accept: 'application/json',
    },
  });
  return await response.json();
};

/* Stripe API Utils */
const createAccount = async ({platformId, email, country}) => {
  let service_agreement;
  if (country === 'US') {
    service_agreement = 'full';
  }
  else {
    service_agreement = 'recipient';
  }
  const account_params = {
    type: 'express',
    email,
    country,
    business_profile: {
      url: `https://mush.style/${platformId}`,
    },
    tos_acceptance: {
      service_agreement,
    },
    capabilities: {
      transfers: {
        requested: true,  
      },
    },
    settings: {
      payouts: {
        schedule: {
          interval: 'manual',
        },
      },
    },
  };
  console.log(account_params);
  const account = await stripe.accounts.create(account_params);
  return account;
};
/* end Stripe API Utils */

const runServer = () => {
  const app = express();
  const port = PORT;
  const domain = `http://localhost:${port}`;
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(express.static('public'));

  app.get('/capture_payment/:payment_intent_id', async (req, res) => {
    var intent = await stripe.paymentIntents.retrieve(req.params.payment_intent_id);
    var refund_button = '';
    if (intent.status === 'requires_capture') {
      intent = await stripe.paymentIntents.capture(req.params.payment_intent_id);
      refund_button = `<a href="http://localhost:3001/refund_payment/${req.params.payment_intent_id}">
        <button>Refund Payment</button>
      </a>`;
    }
    res.send(`
      <html><body>
      ${refund_button}
      <pre>${JSON.stringify(intent.status, undefined, 2)}</pre>
      <pre>${JSON.stringify(intent, undefined, 2)}</pre>
      </body></html>
    `);
  });
  app.get('/cancel_payment/:payment_intent_id', async (req, res) => {
    var intent = await stripe.paymentIntents.retrieve(req.params.payment_intent_id);
    // match following statuses:
    // requires_payment_method, requires_capture, requires_confirmation, requires_action, processing
    if (intent.status === 'requires_payment_method' || 
        intent.status === 'requires_capture' || 
        intent.status === 'requires_confirmation' || 
        intent.status === 'requires_action' || 
        intent.status === 'processing') {
      intent = await stripe.paymentIntents.cancel(req.params.payment_intent_id);
    }
    res.send(`
      <html><body>
      <pre>${JSON.stringify(intent.status, undefined, 2)}</pre>
      <pre>${JSON.stringify(intent, undefined, 2)}</pre>
      </body></html>
    `);
  });
  app.get('/refund_payment/:payment_intent_id', async (req, res) => {
    //TODO: can get   type: 'StripeInvalidRequestError' if already
    //refunded
    var intent = await stripe.paymentIntents.retrieve(req.params.payment_intent_id);
    if (intent.status === 'succeeded') {
      intent = await stripe.refunds.create({
        payment_intent: req.params.payment_intent_id,
        refund_application_fee: true,
        reverse_transfer: true,
      });
    }
    res.send(`
      <html><body>
      <pre>${JSON.stringify(intent.status, undefined, 2)}</pre>
      <pre>${JSON.stringify(intent, undefined, 2)}</pre>
      </body></html>
    `);
  });

  app.get('/payment_return', async (req, res) => {
    const pi_id = req.query.payment_intent;
    res.send(`
      <html><body>
        <a href="/capture_payment/${pi_id}"><button>Capture Payment</button></a>
        <a href="/cancel_payment/${pi_id}"><button>Cancel Payment</button></a>
      </body></html>
    `);
  });
  app.post('/create_payment_intent', async (req, res) => {
    const merchantId = 'acct_1OVXQDIAKCZWBuAI';
    const platformFeeRate = 0.1;
    const { amount } = req.body;
    const application_fee_amount = Math.round(amount * platformFeeRate);
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      application_fee_amount, 
      currency: 'usd',
      capture_method: 'manual',
      transfer_data: {
        destination: merchantId,
      },
    });
    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  });
  app.get('/payment_flow', async (req, res) => {
    const merchantId = 'acct_1OUsMTIdo1igeWBZ';
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1099,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      capture_method: 'manual',
    });
    console.log(paymentIntent);
    res.send(`
      <html><body>
      <pre>${JSON.stringify(paymentIntent, undefined, 2)}</pre>
      </body></html>
    `);
  });

  app.get('/home', async (req, res) => {
    const accounts = await stripe.accounts.list({ limit: 10 });
    const amount = 15000;
    let table = "<table border='1' padding='1'>";
    table += "<tr>";
    table += `<td>id</td>`;
    table += `<td>email</td>`;
    table += `<td>country</td>`;
    table += `<td>Express Dashboard</td>`;
    table += `<td>Status</td>`;
    table += `<td>Payout Interval</td>`;
    table += `<td>charges_enabled</td>`;
    table += `<td>payouts_enabled</td>`;
    table += "</tr>";
    for (const account of accounts.data) {
      const accountLink = await getAccountLink(domain, account.id);
      table += "<tr>";
      // TODO: id, requirements, charges_enabled, payouts_enabled
      table += `<td>${account.id}</td>`;
      table += `<td>${account.email}</td>`;
      table += `<td>${account.country}</td>`;
      if (account.requirements.currently_due.length === 0) {
        const loginLink = await stripe.accounts.createLoginLink(account.id);
        table += `<td><a href="${loginLink.url}">Express Dashboard</a></td>`;
        table += `<td>Onboarded</td>`;
        table += `<td><pre>${JSON.stringify(account.settings.payouts.schedule.interval, undefined, 2)}</pre></td>`;
      }
      else {
        table += `<td>n/a</td>`;
        table += `<td><a href="${accountLink.url}">Onboard</a></td>`;
      }
      table += `<td>${account.charges_enabled}</td>`;
      table += `<td>${account.payouts_enabled}</td>`;
      table += "</tr>";
    }
    table += "</table>";
    res.send(
      `<html><body>
      <form action="${domain}/create_stylist" method="post">
        <label for="email">Email:</label>
        <input type="email" id="email" name="email" required>

        <label for="country">Country:</label>
        <select id="country" name="country" required>
          <option value="US">USA</option>
          <option value="UA">Ukraine</option>
          <option value="KZ">Kazakhstan</option>
          <option value="IT">Italy</option>
          <option value="FR">France</option>
          <option value="DE">Germany</option>
          <option value="UK">United Kingdom</option>
        </select>
        <input type="submit" value="Create Stylist">
      </form>
      <br/>
      <a href="/checkout.html?amount=${amount}"><button>Checkout for $${amount / 100.0}</button></a>
      <br/>
      ${table}
      </body></html>`
    );
  });
  app.post('/create_stylist', async (req, res) => {
    console.log('create_stylist');
    console.log(req.body);
    const platformId = uuidv4();
    const { email, country } = req.body;
    let account;
    try {
      account = await createAccount({ platformId, email, country });
      console.log(account);
    } catch (err) {
      console.log(err);
      res.send(`
        <html><body>
        <div>Failed to create stylist ${email} ${country}</div>
        <pre>${JSON.stringify(err, undefined, 2)}</pre>
        </body></html>
      `);
      return;
    }
    console.log(account);
    const accountLink = await getAccountLink(domain, account.id);
    res.send(`
      <html><body>
      <div>Created stylist ${email} ${country}, id ${account.id}</div>
      <a href="${accountLink.url}">
        <button>Complete onboarding</button>
      </a>
      </body></html>
    `);
  });
  app.get('/reauth/:accountId', (req, res) => {
    console.log('reauth');
    console.log(req.params.accountId);
    res.send(`reauth ${req.params.accountId}
      <br>
      <a href="${domain}/home">Home</a>
      `);
  });
  app.get('/return/:accountId', async (req, res) => {
    console.log('return');
    console.log(req.params.accountId);
    const account = stripe.accounts.retrieve(req.params.accountId);
    console.log('onboarded');

    res.send(`return ${req.params.accountId}
      <br>
      <a href="${domain}/home">Home</a>
    `);
  });
  app.get('/checkout', async (req, res) => {
    /*
     * Example of how to get a PaymentIntent from a PaymentIntent ID
    const apiUrl = `https://api.stripe.com/v1/payment_intents`;
    const piId = 'pi_3OWge1IhzJLcQFgD0HxkzPzw';
    const intent = await callStripeGet(`${apiUrl}/${piId}`);
    console.log(intent);
    */

    const merchantId = 'acct_1OVXQDIAKCZWBuAI';
    const stylistName = 'Anna Galebach';
    const service = 'Wardrobe Selection - Online';
    const platformFeeRate = 0.1;
    const amount = 15120;
    const application_fee_amount = Math.round(amount * platformFeeRate);
    // example array: line_items[0][price]
    const session = {
      'mode': 'payment',
      'success_url': `${domain}/success`,
      //'locale': 'ru',
      'customer_email': 'blah@timblah.com',
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': amount,
      'line_items[0][price_data][product_data][name]': `${stylistName}: ${service}`,
      'payment_intent_data[application_fee_amount]': application_fee_amount,
      'payment_intent_data[capture_method]': 'manual',
      'payment_intent_data[transfer_data][destination]': merchantId,
      'payment_intent_data[metadata][stylist-id]': merchantId,
      'payment_intent_data[metadata][service]': service,
    }
    const json = await callStripe(
      'https://api.stripe.com/v1/checkout/sessions',
      session,
    );
    console.log(json.url)
    res.send(`
      <html><body>
      <pre>${JSON.stringify(json, undefined, 2)}</pre>
      </body></html>
    `);
  });
  app.get('/success', async (req, res) => {
    console.log('success');
    console.log(req.query);
    res.send(`success`);
  });

  app.post('/stripe_webhooks', async (req, res) => {
    console.log('------webhook-------');
    const obj = req.body.data.object;
    console.log(req.body.type);
    console.log(req.body);
    if (req.body.type === 'payment_intent.amount_capturable_updated') {
      const intent = await stripe.paymentIntents.retrieve(obj.id);
      console.log(intent);
      console.log(intent.metadata);
    }
    res.status(200).send();
  });

  app.listen(port, () => {
    console.log(`Stripe app listening at ${domain}`);
  });
};

const run = async () => {
  //open(accountLink.url);
  //open(`http://localhost:${PORT}/home`);
  //open(`http://localhost:${PORT}/payment_flow`);
  //open(`http://localhost:${PORT}/checkout.html`);
  open(`http://localhost:${PORT}/checkout`);
  runServer();
};

run();
