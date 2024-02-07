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
  const domain = `https://onboard.mush.style`;
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(express.static('public'));

  app.get('/account/:accountId', async (req, res) => {
    const { accountId } = req.params;
    const account = await stripe.accounts.retrieve(accountId);
    const accountLink = await getAccountLink(domain, accountId);
    res.send(`
      <html><body>
      <h1>Set up Stripe bank account for: ${account.email}</h1>
      <a href="${accountLink.url}">Click here to do Stripe registration for ${account.email}</a>
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
    table += `<td>Setup Link</td>`;
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
      table += `<td><a href="${domain}/account/${account.id}">Setup Link</a></td>`;
      if (account.requirements.currently_due.length === 0) {
        const loginLink = await stripe.accounts.createLoginLink(account.id);
        table += `<td><a href="${loginLink.url}">Express Dashboard</a></td>`;
        table += `<td>Onboarded</td>`;
        table += `<td><pre>${JSON.stringify(account.settings.payouts.schedule.interval, undefined, 2)}</pre></td>`;
      }
      else {
        table += `<td>n/a</td>`;
        table += `<td><a href="${accountLink.url}">Onboard</a></td>`;
        table += `<td><pre>${JSON.stringify(account.settings.payouts.schedule.interval, undefined, 2)}</pre></td>`;
      }
      table += `<td>${account.charges_enabled}</td>`;
      table += `<td>${account.payouts_enabled}</td>`;
      table += "</tr>";
    }
    table += "</table>";
    res.send(
      `<html><body><title>Mush Stripe Stylists</title>
      <form action="${domain}/create_stylist" method="post">
        <label for="email">Email:</label>
        <input type="email" id="email" name="email" required>

        <label for="country">Country:</label>
        <select id="country" name="country" required>
          <option value="CZ">Czech Republic</option>
          <option value="DK">Denmark</option>
          <option value="FR">France</option>
          <option value="DE">Germany</option>
          <option value="IT">Italy</option>
          <option value="KZ">Kazakhstan</option>
          <option value="PT">Portugal</option>
          <option value="RO">Romania</option>
          <option value="UK">United Kingdom</option>
          <option value="US">USA</option>
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
  app.get('/success', async (req, res) => {
    console.log('success');
    console.log(req.query);
    res.send(`success`);
  });

  app.listen(port, () => {
    console.log(`Stripe app listening at ${domain}, local port ${port}`);
  });
};

const run = async () => {
  //open(accountLink.url);
  open(`http://localhost:${PORT}/home`);
  //open(`http://localhost:${PORT}/payment_flow`);
  //open(`http://localhost:${PORT}/checkout.html`);
  //open(`http://localhost:${PORT}/checkout`);
  runServer();
};

run();
