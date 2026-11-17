const express = require('express');
const c = require('../controllers/productController');
const { validateId, pickProductFields, validateStockChange } = require('../middleware/validate');

const router = express.Router();

// Fixed paths must come before "/:id"
router.get('/low-stock', c.getLowStock);
router.get('/summary', c.getSummary);

router.route('/')
  .get(c.getProducts)
  .post(pickProductFields, c.createProduct);

router.patch('/:id/stock', validateId, validateStockChange, c.adjustStock);

router.route('/:id')
  .all(validateId)
  .get(c.getProductById)
  .put(pickProductFields, c.updateProduct)
  .delete(c.deleteProduct);

module.exports = router;
