const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Gfundreach API Server' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Example API routes for future extensions
app.get('/api/posts', async (req, res) => {
  try {
    // This is handled by Firebase in the frontend
    // But you can add server-side logic here if needed
    res.json({ message: 'Posts endpoint - handled by Firebase in frontend' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    // This is handled by Firebase in the frontend
    // But you can add server-side logic here if needed
    res.json({ message: 'Transactions endpoint - handled by Firebase in frontend' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Payment processing endpoint (placeholder for Stripe integration)
app.post('/api/process-payment', async (req, res) => {
  try {
    const { amount, currency } = req.body;
    
    // In production, integrate with Stripe or other payment gateway
    // For now, this is a placeholder
    res.json({
      success: true,
      message: 'Payment endpoint ready for integration',
      amount,
      currency
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook endpoint for payment confirmations
app.post('/api/webhook', async (req, res) => {
  try {
    // Handle payment gateway webhooks here
    res.json({ received: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Gfundreach API server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
});

module.exports = app;
