const mongoose = require('mongoose');
const { AppError } = require('./errorHandler');

const PRODUCT_FIELDS = ['name', 'sku', 'category', 'price', 'quantity', 'reorderLevel', 'supplier'];

// Rejects malformed ObjectIds before they reach the database
const validateId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return next(new AppError('Invalid product ID', 400));
  }
  next();
};

// Keeps only known product fields from the request body
const pickProductFields = (req, res, next) => {
  const body = req.body || {};
  req.body = {};
  PRODUCT_FIELDS.forEach((f) => {
    if (body[f] !== undefined) req.body[f] = body[f];
  });
  if (Object.keys(req.body).length === 0) {
    return next(new AppError('Request body has no valid product fields', 400));
  }
  next();
};

// Stock adjustment needs a non-zero integer "change"
const validateStockChange = (req, res, next) => {
  const change = req.body && req.body.change;
  if (!Number.isInteger(change) || change === 0) {
    return next(new AppError('"change" must be a non-zero integer (positive = restock, negative = sale)', 400));
  }
  next();
};

module.exports = { validateId, pickProductFields, validateStockChange };
