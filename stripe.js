import express from 'express';
import open from 'open';
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PORT = 3001;

/ * Stripe API Utils * /
const createAccount = async ({email, country}) => {
  let service_agreement;
  if (country === 'US') {
    service_agreement = 'full';
  }
  else {
    service_agreement = 'recipient';
  }
  const account = await stripe.accounts.create({
    type: 'express',
    email,
    country,
    tos_acceptance: {
      service_agreement,
    },
    capabilities: {
      transfers: {
        requested: true,  
      },
    },
  });
  return account;
};
/* end Stripe API Utils */

const runServer = () => {
  const app = express();
  const port = PORT;
  const domain = `http://localhost:${port}`;
  app.use(express.urlencoded({ extended: true }));

  app.get('/home', async (req, res) => {
    const accounts = await stripe.accounts.list({ limit: 10 });
    let table = "<table>";
    for (const account of accounts.data) {
      table += "<tr>";
      // TODO: id, requirements, charges_enabled, payouts_enabled
      table += `<td>id</td><td>${account.id}</td>`;
      table += `<td>email</td><td>${account.email}</td>`;
      table += `<td>country</td><td>${account.country}</td>`;
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
        </select>
        <input type="submit" value="Create Stylist">
      </form>
      ${table}
      </body></html>`
    );
  });
  app.post('/create_stylist', async (req, res) => {
    console.log('create_stylist');
    console.log(req.body);
    const { email, country } = req.body;
    let account;
    try {
      account = await createAccount({ email, country });
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
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${domain}/reauth/${account.id}`,
      return_url: `${domain}/return/${account.id}`,
      type: 'account_onboarding',
    });
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
    res.send(`reauth ${req.params.accountId}`);
  });
  app.get('/return/:accountId', (req, res) => {
    console.log('return');
    console.log(req.params.accountId);
    res.send(`return ${req.params.accountId}`);
  });

  app.listen(port, () => {
    console.log(`Stripe app listening at ${domain}`);
  });
};

const printAccounts = (accounts) => {
  console.log(accounts.data.map(account => [ 
    account.id,
    account.email,
    account.country,
    account.requirements.disabled_reason,
    account.requirements.current_deadline,
    account.requirements.past_due,
    account.requirements.currently_due,
    account.requirements.eventually_due,
  ]));
};


const run = async () => {
  //open(accountLink.url);
  open(`http://localhost:${PORT}/home`);
  runServer();
};

run();
