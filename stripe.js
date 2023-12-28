import express from 'express';
import open from 'open';
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
console.log(process.env.STRIPE_SECRET_KEY);
const PORT = 3001;


const createAccount = async ({email, country}) => {
  const account = await stripe.accounts.create({
    type: 'express',
    email,
    country,
    tos_acceptance: {
      service_agreement: 'recipient',
    },
  });
};

/* Stripe flow */
/* 
 * Connect a stylist
 *  - create a stripe account
 *  - check status of stripe account
 
 * Do a customer payment
 * - create a payment intent
 * - open page
 * - redirect after payment done
 
 * Homepage
 * click to create a stylist account and send them through the flow
 * choose a stylist to do a payment to
 * view all connected accounts
*/

const runServer = () => {
  const app = express();
  const port = PORT;

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
    console.log(`Stripe app listening at http://localhost:${port}`);
  });
};

const run = async () => {
  const accountId = 'acct_1OSLWXH8xIAoOsZC';
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `http://localhost:${PORT}/reauth/${accountId}`,
    return_url: `http://localhost:${PORT}/return/${accountId}`,
    type: 'account_onboarding',
  });
  console.log(accountLink);
  //open(accountLink.url);
  const accounts = await stripe.accounts.list({ limit: 10 });
  console.log(accounts.data.map(account => [ account.id, account.first_name, account.last_name, account.email, account.country ]));
  runServer();
};

run();
