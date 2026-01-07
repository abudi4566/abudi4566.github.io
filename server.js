require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files (buy.html, checkout.html, index.html, assets)
app.use(express.static(path.join(__dirname)));

const PAYPAL_API = process.env.PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken(){
  const client = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if(!client || !secret) throw new Error('Missing PayPal credentials in env');
  const resp = await fetch(PAYPAL_API + '/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + Buffer.from(client + ':' + secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const data = await resp.json();
  if(!data.access_token) throw new Error('Could not get access token: ' + JSON.stringify(data));
  return data.access_token;
}

app.post('/create-order', async (req, res) => {
  try{
    const { cart } = req.body;
    if(!cart || !Array.isArray(cart) || cart.length === 0) return res.status(400).json({ error: 'Cart required' });
    const total = cart.reduce((s,i)=>s + (i.price||0), 0).toFixed(2);

    const accessToken = await getAccessToken();
    const orderResp = await fetch(PAYPAL_API + '/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ amount: { currency_code: 'USD', value: total } }],
        application_context: {
          return_url: `${process.env.BASE_URL || 'http://localhost:3000'}/capture-order`,
          cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/checkout-cancel`
        }
      })
    });
    const orderData = await orderResp.json();
    const approveLink = orderData.links && orderData.links.find(l=>l.rel==='approve');
    if(!approveLink) return res.status(500).json({ error: 'No approve link', details: orderData });
    res.json({ approveUrl: approveLink.href, order: orderData });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Buttons-style API: create order and return order data (id)
app.post('/api/orders', async (req, res) => {
  try{
    const { cart } = req.body;
    if(!cart || !Array.isArray(cart) || cart.length === 0) return res.status(400).json({ error: 'Cart required' });
    const total = cart.reduce((s,i)=>s + (i.price||0), 0).toFixed(2);

    const accessToken = await getAccessToken();
    const orderResp = await fetch(PAYPAL_API + '/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ amount: { currency_code: 'USD', value: total } }]
      })
    });
    const orderData = await orderResp.json();
    return res.json(orderData);
  }catch(err){
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Capture endpoint for Buttons flow
app.post('/api/orders/:id/capture', async (req, res) => {
  try{
    const id = req.params.id;
    if(!id) return res.status(400).json({ error: 'Missing order id' });
    const accessToken = await getAccessToken();
    const cap = await fetch(PAYPAL_API + `/v2/checkout/orders/${id}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }
    });
    const capData = await cap.json();
    return res.json(capData);
  }catch(err){
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Expose public config (safe: client id only)
app.get('/config', (req, res) => {
  res.json({ paypalClientId: process.env.PAYPAL_CLIENT_ID || 'sb', env: process.env.PAYPAL_ENV || 'sandbox' });
});

app.get('/capture-order', async (req, res) => {
  const token = req.query.token || req.query.orderID;
  if(!token) return res.status(400).send('Missing order token');
  try{
    const accessToken = await getAccessToken();
    const cap = await fetch(PAYPAL_API + `/v2/checkout/orders/${token}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }
    });
    const capData = await cap.json();
    // Simple success page
    res.send(`<h1>Payment captured</h1><pre>${JSON.stringify(capData, null, 2)}</pre><p><a href="/">Return</a></p>`);
  }catch(e){
    console.error(e);
    res.status(500).send('Capture error: ' + e.message);
  }
});

app.get('/checkout-cancel', (req,res)=>{
  res.send('<h1>Payment cancelled</h1><p><a href="/buy.html">Return to shop</a></p>');
});

const port = process.env.PORT || 3000;
app.listen(port, ()=>console.log('Server running on port', port));
