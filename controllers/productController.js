const Product = require('../models/Product');
const { AppError } = require('../middleware/errorHandler');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const SORTABLE = ['name', 'sku', 'category', 'price', 'quantity', 'createdAt', 'updatedAt'];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isStr = (v) => typeof v === 'string' && v.trim() !== '';

// POST /api/products
exports.createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json(product);
});

// GET /api/products?category=&supplier=&search=&minPrice=&maxPrice=&inStock=&sort=&page=&limit=
exports.getProducts = asyncHandler(async (req, res) => {
  const { category, supplier, search, minPrice, maxPrice, inStock, sort, page, limit } = req.query;
  const filter = {};

  if (isStr(category)) filter.category = new RegExp(`^${escapeRegex(category.trim())}$`, 'i');
  if (isStr(supplier)) filter.supplier = new RegExp(`^${escapeRegex(supplier.trim())}$`, 'i');
  if (isStr(search)) filter.name = new RegExp(escapeRegex(search.trim()), 'i');
  if (inStock === 'true') filter.quantity = { $gt: 0 };
  if (inStock === 'false') filter.quantity = 0;

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined && !isNaN(minPrice)) filter.price.$gte = Number(minPrice);
    if (maxPrice !== undefined && !isNaN(maxPrice)) filter.price.$lte = Number(maxPrice);
    if (!Object.keys(filter.price).length) delete filter.price;
  }

  // sort=-price,name  (only whitelisted fields)
  const sortBy = isStr(sort)
    ? sort.split(',').filter((f) => SORTABLE.includes(f.replace(/^-/, ''))).join(' ')
    : '';

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  const total = await Product.countDocuments(filter);
  const products = await Product.find(filter)
    .sort(sortBy || '-createdAt')
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum);

  res.json({
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
    count: products.length,
    products,
  });
});

// GET /api/products/:id
exports.getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  res.json(product);
});

// PUT /api/products/:id
exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!product) throw new AppError('Product not found', 404);
  res.json(product);
});

// PATCH /api/products/:id/stock   body: { "change": 10 } or { "change": -3 }
exports.adjustStock = asyncHandler(async (req, res) => {
  const { change } = req.body;
  const filter = { _id: req.params.id };
  if (change < 0) filter.quantity = { $gte: -change }; // never let stock go below 0

  // Single atomic update, safe under concurrent sales
  const product = await Product.findOneAndUpdate(filter, { $inc: { quantity: change } }, { new: true });

  if (!product) {
    const exists = await Product.exists({ _id: req.params.id });
    if (!exists) throw new AppError('Product not found', 404);
    throw new AppError('Insufficient stock for this sale', 400);
  }
  res.json({ message: 'Stock updated', product });
});

// DELETE /api/products/:id
exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  res.json({ message: 'Product deleted', id: product.id });
});

// GET /api/products/low-stock  (quantity <= reorderLevel)
exports.getLowStock = asyncHandler(async (req, res) => {
  const lowStockItems = await Product.aggregate([
    { $match: { $expr: { $lte: ['$quantity', '$reorderLevel'] } } },
    { $addFields: { stockValue: { $multiply: ['$price', '$quantity'] } } },
    { $sort: { quantity: 1 } },
  ]);
  res.json({ count: lowStockItems.length, lowStockItems });
});

// GET /api/products/summary  (category-wise report)
exports.getSummary = asyncHandler(async (req, res) => {
  const summary = await Product.aggregate([
    {
      $group: {
        _id: '$category',
        totalItems: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        totalStockValue: { $sum: { $multiply: ['$price', '$quantity'] } },
        avgPrice: { $avg: '$price' },
      },
    },
    { $sort: { totalStockValue: -1 } },
  ]);
  res.json({ categories: summary.length, summary });
});
