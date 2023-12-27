# Payment Integration Examples

## Stripe

## Fondy
Fondy marketplaces are implemented as a hack. Fondy uses their base
database representation of merchant accounts, and then manually adds
flags like "this account is a marketplace fee distributor" to achieve
the desired legal and programmatic behavior.

### Run Code
`npm run fondy`

### Payment Flow
A "FOP" (фоп) is a Ukrainian LLC for small businesses, with low total
effective tax rate(~5%).  They're intended for businesses that make under $200K/year or
so.

They do require registration, but it's a fairly streamlined procedure.
Most Ukrainian stylists who do moderate volume should use this.

#### Stylists without FOP, or who haven't registered FOP with us
Stylist registers their Ukrainian bank account number with us (looks
like a credit card number; Ukrainian accounts use debit cards as account
ids and cards, dual purpose).
1. Client pays our merchant account (or we pre-authorize)
2. Our merchant account sees successful payment or preauth
3. Upon completion of service, we initiate payment to the stylist's
   card.

Explanation in `fondy.js`:
1. `runInteractionB()`. This calls back to the `response_url` endpoint
   in the Express server, which prints the payment status.
2. We save that response
3. Use the code from `payoutStylistCard` or `captureForStylistCard` to
   pay the stylist.
