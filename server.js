require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const productRoutes = require('./routes/productRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/inventory_db';
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.json({ message: 'Inventory API running' }));
app.use('/api/products', productRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || DEFAULT_MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed. Check that MongoDB is running and that MONGO_URI is set correctly.');
    console.error('Configured URI:', MONGO_URI);
    console.error(err.message);
    process.exit(1);
  });
