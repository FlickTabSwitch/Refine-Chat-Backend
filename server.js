const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
require('dotenv').config();
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const dayjs = require('dayjs');
const crypto = require('crypto');
const transporter = require('./utils/email');

const Transaction = require('./models/transaction');
const User = require('./models/user');

const { generateInvoicePDF } = require('./utils/invoice');
const path = require('path');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      formAction: ["'self'", "https://secure.payu.in", "https://*.payu.in"]
    }
  }
}));

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true, useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));


app.get("/", (req, res) => {
  res.send("✅ Refine Chat API is alive!");
});

// ============ GOOGLE AUTH ================
app.post('/auth/google', async (req, res) => {
  const { token, referralCode, marketerId } = req.body;
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.error) return res.status(401).json({ success: false, message: 'Invalid token' });

    const googleId = data.id;
    let user = await User.findOne({ googleId });

    if (!user) {
      let referredBy = null;
      if (referralCode) {
        const referrer = await User.findOne({ referralCode });
        if (referrer && referrer.googleId !== googleId) {
          referredBy = referralCode;
          referrer.subscription.credits += 50;
          await referrer.save();
        }
      }

      user = new User({
        googleId,
        email: data.email,
        referralId: referredBy,
        referralCode: googleId.slice(-6),
        marketerId,
        trialStartDate: new Date(),
        subscription: {
          plan: 'free',
          credits: 50,
          expiresAt: dayjs().add(7, 'day').toDate()
        }
      });

      // ✅ Debug log
      console.log(`📈 New user signing up via Google: ${data.email}`);
      console.log(`📣 Referral: ${referredBy || 'None'}`);
      console.log(`💼 Marketer ID: ${marketerId || 'None'}`);
      await user.save();

      // ✅ Send email to user
      await transporter.sendMail({
        from: `"Refine AI" <${process.env.GMAIL_USER}>`,
        to: user.email,
        subject: '👋 Welcome to Refine AI!',
        html: `<h2>Hi ${data.name},</h2><p>You’ve successfully signed in to <strong>Refine AI</strong>.</p><p>Your current plan: <strong>Free</strong> | Credits: <strong>50</strong></p>`
      });

      // ✅ Send email to admin
      await transporter.sendMail({
        from: `"Refine AI" <${process.env.GMAIL_USER}>`,
        to: process.env.GMAIL_USER,
        subject: '🔔 New User Signed In',
        html: `
          <p><strong>New User Signed In</strong></p>
          <ul>
            <li><strong>Name:</strong> ${data.name}</li>
            <li><strong>Email:</strong> ${data.email}</li>
            <li><strong>Referral:</strong> ${referredBy || 'N/A'}</li>
            <li><strong>Plan:</strong> Free (Trial)</li>
            <li><strong>Credits:</strong> 50</li>
          </ul>
        `
      });
    }

    res.json({
      success: true,
      user: {
        email: user.email,
        name: data.name,
        picture: data.picture,
        sub: googleId
      },
      usage: {
        credits: user.subscription.credits,
        plan: user.subscription.plan
      }
    });
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(500).json({ success: false });
  }
});

// ============ CHAT ================
app.post('/chat', async (req, res) => {
  const { messages, userId } = req.body;
  try {
    const user = await User.findOne({ googleId: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.subscription.expiresAt && dayjs().isAfter(dayjs(user.subscription.expiresAt))) {
      user.subscription = { plan: 'free', credits: 0, expiresAt: null };
      await user.save();
    }

    if (user.subscription.credits <= 0) {
      return res.json({ content: '🚫 You have used all your free REFINES. Upgrade or refer friends.' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', messages
    });

    user.subscription.credits -= 1;
    await user.save();

    res.json(completion.choices[0].message);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ PAYPAL ================
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_BASE = 'https://api-m.paypal.com';

app.post('/create-paypal-transaction', async (req, res) => {
  const { userId, plan } = req.body;
  // const amount = plan === 'elite' ? '6.99' : '2.99';
  const amount = '0.02';
  const description = plan === 'elite' ? 'Refine Elite' : 'Refine Pro';

  try {
    const auth = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const { access_token } = await auth.json();

    const order = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ amount: { currency_code: 'USD', value: amount }, description }],
        application_context: {
          return_url: `${BASE_URL}/paypal/success?userId=${userId}&plan=${plan}`,
          cancel_url: `${BASE_URL}/paypal/cancel`
        }
      })
    });

    const orderData = await order.json();
    const approvalLink = orderData.links?.find(link => link.rel === 'approve');
    if (!approvalLink) return res.status(500).json({ error: 'No approval link returned from PayPal' });
      
    const approvalUrl = approvalLink.href;
    res.json({ approvalUrl });
  } catch (err) {
    console.error('PayPal Error:', err);
    res.status(500).json({ error: 'PayPal error' });
  }
});

app.get('/paypal/success', async (req, res) => {
  const { token, userId, plan } = req.query;
  // const amount = plan === 'elite' ? 6.99 : 2.99;
  const amount = '0.02';
  const credits = plan === 'elite' ? 2500 : 1000;

  try {
    const auth = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const { access_token } = await auth.json();

    const capture = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${token}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await capture.json();
    const user = await User.findOne({ googleId: userId });
    if (!user) return res.send('<h3>User not found</h3>');

    user.subscription = {
      plan,
      credits,
      expiresAt: dayjs().add(30, 'day').toDate()
    };
    await user.save();

    await Transaction.create({
      userId: user._id,
      gateway: 'paypal',
      plan,
      amount,
      currency: 'USD',
      status: 'success',
      txnId: data.id
    });

    generateInvoicePDF(user, {
      txnId: data.id,
      plan,
      amount,
      currency: 'USD',
      status: 'success',
      gateway: 'paypal',
      createdAt: new Date()
    }, async (filePath) => {
      const mailOptions = {
        from: `"Refine AI" <${process.env.GMAIL_USER}>`,
        to: user.email,
        subject: `🧾 Invoice - ${plan.toUpperCase()} Plan`,
        html: `<p>Thanks for purchasing <strong>${plan}</strong>. You've received <strong>${credits}</strong> credits.</p>`,
        attachments: [{ filename: path.basename(filePath), path: filePath }]
      };
    
      const adminMail = {
        from: `"Refine AI" <${process.env.GMAIL_USER}>`,
        to: process.env.GMAIL_USER, // Admin email is same
        subject: `🔔 New Purchase - ${plan.toUpperCase()} Plan`,
        html: `<p>User <strong>${user.email}</strong> just purchased <strong>${plan}</strong> via PayPal. Amount: <strong>$${amount}</strong></p>`,
        attachments: [{ filename: path.basename(filePath), path: filePath }]
      };
    
      await transporter.sendMail(mailOptions);
      await transporter.sendMail(adminMail);
    });

    res.send('<h2>✅ Payment Successful</h2><p>You will be redirected...</p>');
  } catch (err) {
    console.error(err);
    res.send('<h3>❌ Payment Failed</h3>');
  }
});

// ============ PAYU ================
app.post('/generate-payu-form', async (req, res) => {
  const { userId, plan } = req.body;
  if (!['pro', 'elite'].includes(plan)) {
    return res.status(400).json({ success: false, message: 'Invalid plan' });
  }

  try {
    const user = await User.findOne({ googleId: userId });
    if (!user) return res.status(404).json({ success: false });

    const txnid = 'Txn_' + Math.floor(Math.random() * 1000000);
    // const amount = plan === 'elite' ? '579.00' : '249.00';
    const amount = '2.00';
    const productinfo = plan === 'elite' ? 'Refine Elite' : 'Refine Pro';
    const firstname = user.email.split('@')[0];
    const email = user.email;

    const hashString = `${process.env.PAYU_KEY}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${process.env.PAYU_SALT}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    const params = new URLSearchParams({
      key: process.env.PAYU_KEY,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      surl: `${BASE_URL}/payu/success?plan=${plan}`,
      furl: `${BASE_URL}/payu/fail`,
      hash
    });

    res.json({ url: `${BASE_URL}/payu-redirect.html?${params.toString()}` });
  } catch (err) {
    console.error('/generate-payu-form error:', err);
    res.status(500).json({ success: false });
  }
});


app.post('/payu/success', async (req, res) => {
  const { email, mihpayid, txnid, productinfo, amount, status } = req.body;

  if (status !== 'success') return res.status(400).json({ success: false, message: 'Payment failed' });

  const plan = productinfo.toLowerCase().includes('elite') ? 'elite' : 'pro';
  const credits = plan === 'elite' ? 2500 : 1000;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.subscription = {
      plan,
      credits,
      expiresAt: dayjs().add(30, 'day').toDate()
    };
    await user.save();

    const txn = await Transaction.create({
      userId: user._id,
      gateway: 'payu',
      plan,
      amount: parseFloat(amount),
      currency: 'INR',
      status: 'success',
      txnId: mihpayid || txnid
    });

    // ✅ Optional: PDF invoice generation
    generateInvoicePDF(user, txn, async (filePath) => {
      await transporter.sendMail({
        from: `"Refine AI" <${process.env.GMAIL_USER}>`,
        to: user.email,
        subject: `🧾 Invoice - ${plan.toUpperCase()} Plan`,
        html: `<p>Thanks for purchasing <strong>${plan}</strong>. You've received <strong>${credits}</strong> credits.</p>`,
        attachments: [{ filename: path.basename(filePath), path: filePath }]
      });

      await transporter.sendMail({
        from: `"Refine AI" <${process.env.GMAIL_USER}>`,
        to: process.env.GMAIL_USER,
        subject: `🔔 New Purchase - ${plan.toUpperCase()} Plan`,
        html: `<p>User <strong>${user.email}</strong> just purchased <strong>${plan}</strong> via PayU. Amount: <strong>₹${amount}</strong></p>`,
        attachments: [{ filename: path.basename(filePath), path: filePath }]
      });
    });

    res.json({ success: true });
  } catch (err) {
    console.error('/payu/success error:', err);
    res.status(500).json({ success: false });
  }
});



// ============ MISC ============
app.get('/me/:userId', async (req, res) => {
  const user = await User.findOne({ googleId: req.params.userId });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const referralCount = await User.countDocuments({ referralId: user.referralCode });
  res.json({
    success: true,
    user: {
      plan: user.subscription.plan,
      credits: user.subscription.credits,
      referralCode: user.referralCode,
      referralCount
    }
  });
});

app.post('/refill', async (req, res) => {
  const user = await User.findOne({ googleId: req.body.userId });
  if (!user) return res.status(404).json({ success: false });

  user.subscription.credits += 50;
  await user.save();
  res.json({ success: true });
});

app.get('/analytics/marketers', async (req, res) => {
  const result = await User.aggregate([
    { $match: { marketerId: { $ne: null } } },
    { $group: { _id: '$marketerId', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  res.json({ success: true, data: result });
});

app.use((req, res) => {
  res.status(404).send('404 Not Found');
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at ${BASE_URL}`));
