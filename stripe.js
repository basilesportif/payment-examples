import express from 'express';
import open from 'open';
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
console.log(process.env.STRIPE_SECRET_KEY);


/* Stripe flow */
/* 
 * Connect a stylist
 *  - create a stripe account
 *  - check status of stripe account
 
 * Do a customer payment
 * - create a payment intent
 * - open page
 * - redirect after payment done
*/
