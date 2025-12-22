const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

const PRODUCTS_PATH = path.join(__dirname, 'public', 'products.json');
const ORDERS_PATH = path.join(__dirname, 'public', 'orders.json');
const AMAZON_ORDERS_PATH = path.join(__dirname, 'public', 'amazon-orders.json');
const FLIPKART_ORDERS_PATH = path.join(__dirname, 'public', 'flipkart-orders.json');
const WA_LEADS_ORDERS_PATH = path.join(__dirname, 'public', 'wa-leads-orders.json');
const ABANDONED_CART_ORDERS_PATH = path.join(__dirname, 'public', 'abandoned-cart-orders.json');
const META_SPEND_PATH = path.join(__dirname, 'public', 'meta-spend.json');
const AMAZON_SPEND_PATH = path.join(__dirname, 'public', 'amazon-spend.json');
const FLIPKART_SPEND_PATH = path.join(__dirname, 'public', 'flipkart-spend.json');
const MISC_SPEND_PATH = path.join(__dirname, 'public', 'misc-spend.json');
const GURUGRAM_MARTS_PATH = path.join(__dirname, 'public', 'gurugram-marts.json');
const DELHI_MARTS_PATH = path.join(__dirname, 'public', 'delhi-marts.json');
const FOLLOWUPS_PATH = path.join(__dirname, 'public', 'followups.json');

async function readProducts() {
  const data = await fs.readFile(PRODUCTS_PATH, 'utf8');
  return JSON.parse(data);
}

async function writeProducts(products) {
  const json = JSON.stringify(products, null, 2);
  await fs.writeFile(PRODUCTS_PATH, json, 'utf8');
}

async function readOrders() {
  try {
    const data = await fs.readFile(ORDERS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // If file doesn't exist or is empty, return empty array
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeOrders(orders) {
  const json = JSON.stringify(orders, null, 2);
  await fs.writeFile(ORDERS_PATH, json, 'utf8');
}

async function readAmazonOrders() {
  try {
    const data = await fs.readFile(AMAZON_ORDERS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // If file doesn't exist or is empty, return empty array
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeAmazonOrders(orders) {
  const json = JSON.stringify(orders, null, 2);
  await fs.writeFile(AMAZON_ORDERS_PATH, json, 'utf8');
}

async function readFlipkartOrders() {
  try {
    const data = await fs.readFile(FLIPKART_ORDERS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // If file doesn't exist or is empty, return empty array
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeFlipkartOrders(orders) {
  const json = JSON.stringify(orders, null, 2);
  await fs.writeFile(FLIPKART_ORDERS_PATH, json, 'utf8');
}

async function readWALeadsOrders() {
  try {
    const data = await fs.readFile(WA_LEADS_ORDERS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeWALeadsOrders(orders) {
  const json = JSON.stringify(orders, null, 2);
  await fs.writeFile(WA_LEADS_ORDERS_PATH, json, 'utf8');
}

async function readAbandonedCartOrders() {
  try {
    const data = await fs.readFile(ABANDONED_CART_ORDERS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeAbandonedCartOrders(orders) {
  const json = JSON.stringify(orders, null, 2);
  await fs.writeFile(ABANDONED_CART_ORDERS_PATH, json, 'utf8');
}

async function readMetaSpend() {
  try {
    const data = await fs.readFile(META_SPEND_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeMetaSpend(records) {
  const json = JSON.stringify(records, null, 2);
  await fs.writeFile(META_SPEND_PATH, json, 'utf8');
}

async function readAmazonSpend() {
  try {
    const data = await fs.readFile(AMAZON_SPEND_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeAmazonSpend(records) {
  const json = JSON.stringify(records, null, 2);
  await fs.writeFile(AMAZON_SPEND_PATH, json, 'utf8');
}

async function readFlipkartSpend() {
  try {
    const data = await fs.readFile(FLIPKART_SPEND_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeFlipkartSpend(records) {
  const json = JSON.stringify(records, null, 2);
  await fs.writeFile(FLIPKART_SPEND_PATH, json, 'utf8');
}

async function readMiscSpend() {
  try {
    const data = await fs.readFile(MISC_SPEND_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeMiscSpend(records) {
  const json = JSON.stringify(records, null, 2);
  await fs.writeFile(MISC_SPEND_PATH, json, 'utf8');
}

async function readGurugramMarts() {
  try {
    const data = await fs.readFile(GURUGRAM_MARTS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeGurugramMarts(marts) {
  const json = JSON.stringify(marts, null, 2);
  await fs.writeFile(GURUGRAM_MARTS_PATH, json, 'utf8');
}

async function readDelhiMarts() {
  try {
    const data = await fs.readFile(DELHI_MARTS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeDelhiMarts(marts) {
  const json = JSON.stringify(marts, null, 2);
  await fs.writeFile(DELHI_MARTS_PATH, json, 'utf8');
}

async function readFollowups() {
  try {
    const data = await fs.readFile(FOLLOWUPS_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeFollowups(followups) {
  const json = JSON.stringify(followups, null, 2);
  await fs.writeFile(FOLLOWUPS_PATH, json, 'utf8');
}

app.get('/api/products', async (_req, res) => {
  try {
    const products = await readProducts();
    res.json(products);
  } catch (err) {
    console.error('Error reading products.json', err);
    res.status(500).json({ message: 'Failed to read products' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const newProduct = req.body;
    if (!newProduct || typeof newProduct !== 'object') {
      return res.status(400).json({ message: 'Invalid product payload' });
    }

    const products = await readProducts();

    // Always generate a sequential 4-digit ID like PROD-1000, PROD-1001, ...
    const maxId = products
      .map((p) => p.id)
      .filter((id) => typeof id === 'string' && id.startsWith('PROD-'))
      .map((id) => Number(id.replace('PROD-', '')))
      .filter((n) => !Number.isNaN(n))
      .reduce((max, n) => Math.max(max, n), 1000);
    newProduct.id = `PROD-${maxId + 1}`;

    // Always create a new product here; updates are handled by PUT /api/products/:id
    products.push(newProduct);
    await writeProducts(products);

    res.status(201).json(newProduct);
  } catch (err) {
    console.error('Error writing to products.json', err);
    res.status(500).json({ message: 'Failed to save product' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const products = await readProducts();
    const index = products.findIndex((p) => p.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Product not found' });
    }

    products.splice(index, 1);
    await writeProducts(products);

    res.status(204).end();
  } catch (err) {
    console.error('Error deleting from products.json', err);
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updated = req.body;
    if (!updated || typeof updated !== 'object') {
      return res.status(400).json({ message: 'Invalid product payload' });
    }

    const products = await readProducts();
    const index = products.findIndex((p) => p.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Preserve ID from URL/path
    products[index] = { ...products[index], ...updated, id };
    await writeProducts(products);

    res.json(products[index]);
  } catch (err) {
    console.error('Error updating products.json', err);
    res.status(500).json({ message: 'Failed to update product' });
  }
});

app.get('/api/orders', async (_req, res) => {
  try {
    const orders = await readOrders();
    res.json(orders);
  } catch (err) {
    console.error('Error reading orders.json', err);
    res.status(500).json({ message: 'Failed to read orders' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const newOrder = req.body;
    if (!newOrder || typeof newOrder !== 'object') {
      return res.status(400).json({ message: 'Invalid order payload' });
    }

    const orders = await readOrders();

    // Generate order ID if not provided
    if (!newOrder.id) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const orderNum = orders.length + 1;
      newOrder.id = `PH-${year}${month}${day}-${String(1000 + orderNum)}`;
    }

    orders.push(newOrder);
    await writeOrders(orders);

    res.status(201).json(newOrder);
  } catch (err) {
    console.error('Error writing to orders.json', err);
    res.status(500).json({ message: 'Failed to save order' });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updated = req.body;
    if (!updated || typeof updated !== 'object') {
      return res.status(400).json({ message: 'Invalid order payload' });
    }

    const orders = await readOrders();
    const index = orders.findIndex((o) => o.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Preserve ID from URL/path
    orders[index] = { ...orders[index], ...updated, id };
    await writeOrders(orders);

    res.json(orders[index]);
  } catch (err) {
    console.error('Error updating orders.json', err);
    res.status(500).json({ message: 'Failed to update order' });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const orders = await readOrders();
    const index = orders.findIndex((o) => o.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Order not found' });
    }

    orders.splice(index, 1);
    await writeOrders(orders);

    res.status(204).end();
  } catch (err) {
    console.error('Error deleting from orders.json', err);
    res.status(500).json({ message: 'Failed to delete order' });
  }
});

app.get('/api/amazon-orders', async (_req, res) => {
  try {
    const orders = await readAmazonOrders();
    res.json(orders);
  } catch (err) {
    console.error('Error reading amazon-orders.json', err);
    res.status(500).json({ message: 'Failed to read Amazon orders' });
  }
});

app.post('/api/amazon-orders', async (req, res) => {
  try {
    const newOrder = req.body;
    if (!newOrder || typeof newOrder !== 'object') {
      return res.status(400).json({ message: 'Invalid order payload' });
    }

    const orders = await readAmazonOrders();

    // Generate order ID if not provided
    if (!newOrder.id) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const orderNum = orders.length + 1;
      newOrder.id = `AMZ-${year}${month}${day}-${String(1000 + orderNum)}`;
    }

    orders.push(newOrder);
    await writeAmazonOrders(orders);

    res.status(201).json(newOrder);
  } catch (err) {
    console.error('Error writing to amazon-orders.json', err);
    res.status(500).json({ message: 'Failed to save Amazon order' });
  }
});

app.get('/api/flipkart-orders', async (_req, res) => {
  try {
    const orders = await readFlipkartOrders();
    res.json(orders);
  } catch (err) {
    console.error('Error reading flipkart-orders.json', err);
    res.status(500).json({ message: 'Failed to read Flipkart orders' });
  }
});

app.post('/api/flipkart-orders', async (req, res) => {
  try {
    const newOrder = req.body;
    if (!newOrder || typeof newOrder !== 'object') {
      return res.status(400).json({ message: 'Invalid order payload' });
    }

    const orders = await readFlipkartOrders();

    // Generate order ID if not provided
    if (!newOrder.id) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const orderNum = orders.length + 1;
      newOrder.id = `FLP-${year}${month}${day}-${String(1000 + orderNum)}`;
    }

    orders.push(newOrder);
    await writeFlipkartOrders(orders);

    res.status(201).json(newOrder);
  } catch (err) {
    console.error('Error writing to flipkart-orders.json', err);
    res.status(500).json({ message: 'Failed to save Flipkart order' });
  }
});

app.get('/api/wa-leads-orders', async (_req, res) => {
  try {
    const orders = await readWALeadsOrders();
    res.json(orders);
  } catch (err) {
    console.error('Error reading wa-leads-orders.json', err);
    res.status(500).json({ message: 'Failed to read WA Leads orders' });
  }
});

app.post('/api/wa-leads-orders', async (req, res) => {
  try {
    const newOrder = req.body;
    if (!newOrder || typeof newOrder !== 'object') {
      return res.status(400).json({ message: 'Invalid order payload' });
    }

    const orders = await readWALeadsOrders();

    if (!newOrder.id) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const orderNum = orders.length + 1;
      newOrder.id = `WAL-${year}${month}${day}-${String(1000 + orderNum)}`;
    }

    orders.push(newOrder);
    await writeWALeadsOrders(orders);

    res.status(201).json(newOrder);
  } catch (err) {
    console.error('Error writing to wa-leads-orders.json', err);
    res.status(500).json({ message: 'Failed to save WA Leads order' });
  }
});

app.put('/api/wa-leads-orders/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updated = req.body;
    if (!updated || typeof updated !== 'object') {
      return res.status(400).json({ message: 'Invalid order payload' });
    }

    const orders = await readWALeadsOrders();
    const index = orders.findIndex((o) => o.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Preserve ID from URL/path
    orders[index] = { ...orders[index], ...updated, id };
    await writeWALeadsOrders(orders);

    res.json(orders[index]);
  } catch (err) {
    console.error('Error updating wa-leads-orders.json', err);
    res.status(500).json({ message: 'Failed to update WA Leads order' });
  }
});

app.delete('/api/wa-leads-orders/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const orders = await readWALeadsOrders();
    const index = orders.findIndex((o) => o.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Order not found' });
    }

    orders.splice(index, 1);
    await writeWALeadsOrders(orders);

    res.status(204).end();
  } catch (err) {
    console.error('Error deleting from wa-leads-orders.json', err);
    res.status(500).json({ message: 'Failed to delete WA Leads order' });
  }
});

app.get('/api/abandoned-cart-orders', async (_req, res) => {
  try {
    const orders = await readAbandonedCartOrders();
    res.json(orders);
  } catch (err) {
    console.error('Error reading abandoned-cart-orders.json', err);
    res.status(500).json({ message: 'Failed to read Abandoned Cart orders' });
  }
});

app.post('/api/abandoned-cart-orders', async (req, res) => {
  try {
    const newOrder = req.body;
    if (!newOrder || typeof newOrder !== 'object') {
      return res.status(400).json({ message: 'Invalid order payload' });
    }

    const orders = await readAbandonedCartOrders();

    if (!newOrder.id) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const orderNum = orders.length + 1;
      newOrder.id = `ABC-${year}${month}${day}-${String(1000 + orderNum)}`;
    }

    orders.push(newOrder);
    await writeAbandonedCartOrders(orders);

    res.status(201).json(newOrder);
  } catch (err) {
    console.error('Error writing to abandoned-cart-orders.json', err);
    res.status(500).json({ message: 'Failed to save Abandoned Cart order' });
  }
});

// Marketing Spend API endpoints
app.get('/api/meta-spend', async (_req, res) => {
  try {
    const records = await readMetaSpend();
    res.json(records);
  } catch (err) {
    console.error('Error reading meta-spend.json', err);
    res.status(500).json({ message: 'Failed to read Meta spend' });
  }
});

app.post('/api/meta-spend', async (req, res) => {
  try {
    const newRecord = req.body;
    if (!newRecord || typeof newRecord !== 'object') {
      return res.status(400).json({ message: 'Invalid record payload' });
    }

    const records = await readMetaSpend();
    if (!newRecord.id) {
      newRecord.id = `META-${Date.now()}`;
    }
    records.push(newRecord);
    await writeMetaSpend(records);

    res.status(201).json(newRecord);
  } catch (err) {
    console.error('Error writing to meta-spend.json', err);
    res.status(500).json({ message: 'Failed to save Meta spend' });
  }
});

app.put('/api/meta-spend/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updated = req.body;
    if (!updated || typeof updated !== 'object') {
      return res.status(400).json({ message: 'Invalid record payload' });
    }

    const records = await readMetaSpend();
    const index = records.findIndex((r) => r.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Record not found' });
    }

    records[index] = { ...records[index], ...updated, id };
    await writeMetaSpend(records);

    res.json(records[index]);
  } catch (err) {
    console.error('Error updating meta-spend.json', err);
    res.status(500).json({ message: 'Failed to update Meta spend' });
  }
});

app.delete('/api/meta-spend/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const records = await readMetaSpend();
    const index = records.findIndex((r) => r.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Record not found' });
    }

    records.splice(index, 1);
    await writeMetaSpend(records);

    res.status(204).end();
  } catch (err) {
    console.error('Error deleting from meta-spend.json', err);
    res.status(500).json({ message: 'Failed to delete Meta spend' });
  }
});

app.get('/api/amazon-spend', async (_req, res) => {
  try {
    const records = await readAmazonSpend();
    res.json(records);
  } catch (err) {
    console.error('Error reading amazon-spend.json', err);
    res.status(500).json({ message: 'Failed to read Amazon spend' });
  }
});

app.post('/api/amazon-spend', async (req, res) => {
  try {
    const newRecord = req.body;
    if (!newRecord || typeof newRecord !== 'object') {
      return res.status(400).json({ message: 'Invalid record payload' });
    }

    const records = await readAmazonSpend();
    if (!newRecord.id) {
      newRecord.id = `AMZ-${Date.now()}`;
    }
    records.push(newRecord);
    await writeAmazonSpend(records);

    res.status(201).json(newRecord);
  } catch (err) {
    console.error('Error writing to amazon-spend.json', err);
    res.status(500).json({ message: 'Failed to save Amazon spend' });
  }
});

app.put('/api/amazon-spend/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updated = req.body;
    if (!updated || typeof updated !== 'object') {
      return res.status(400).json({ message: 'Invalid record payload' });
    }

    const records = await readAmazonSpend();
    const index = records.findIndex((r) => r.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Record not found' });
    }

    records[index] = { ...records[index], ...updated, id };
    await writeAmazonSpend(records);

    res.json(records[index]);
  } catch (err) {
    console.error('Error updating amazon-spend.json', err);
    res.status(500).json({ message: 'Failed to update Amazon spend' });
  }
});

app.delete('/api/amazon-spend/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const records = await readAmazonSpend();
    const index = records.findIndex((r) => r.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Record not found' });
    }

    records.splice(index, 1);
    await writeAmazonSpend(records);

    res.status(204).end();
  } catch (err) {
    console.error('Error deleting from amazon-spend.json', err);
    res.status(500).json({ message: 'Failed to delete Amazon spend' });
  }
});

app.get('/api/flipkart-spend', async (_req, res) => {
  try {
    const records = await readFlipkartSpend();
    res.json(records);
  } catch (err) {
    console.error('Error reading flipkart-spend.json', err);
    res.status(500).json({ message: 'Failed to read Flipkart spend' });
  }
});

app.post('/api/flipkart-spend', async (req, res) => {
  try {
    const newRecord = req.body;
    if (!newRecord || typeof newRecord !== 'object') {
      return res.status(400).json({ message: 'Invalid record payload' });
    }

    const records = await readFlipkartSpend();
    if (!newRecord.id) {
      newRecord.id = `FLP-${Date.now()}`;
    }
    records.push(newRecord);
    await writeFlipkartSpend(records);

    res.status(201).json(newRecord);
  } catch (err) {
    console.error('Error writing to flipkart-spend.json', err);
    res.status(500).json({ message: 'Failed to save Flipkart spend' });
  }
});

app.put('/api/flipkart-spend/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updated = req.body;
    if (!updated || typeof updated !== 'object') {
      return res.status(400).json({ message: 'Invalid record payload' });
    }

    const records = await readFlipkartSpend();
    const index = records.findIndex((r) => r.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Record not found' });
    }

    records[index] = { ...records[index], ...updated, id };
    await writeFlipkartSpend(records);

    res.json(records[index]);
  } catch (err) {
    console.error('Error updating flipkart-spend.json', err);
    res.status(500).json({ message: 'Failed to update Flipkart spend' });
  }
});

app.delete('/api/flipkart-spend/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const records = await readFlipkartSpend();
    const index = records.findIndex((r) => r.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Record not found' });
    }

    records.splice(index, 1);
    await writeFlipkartSpend(records);

    res.status(204).end();
  } catch (err) {
    console.error('Error deleting from flipkart-spend.json', err);
    res.status(500).json({ message: 'Failed to delete Flipkart spend' });
  }
});

app.get('/api/misc-spend', async (_req, res) => {
  try {
    const records = await readMiscSpend();
    res.json(records);
  } catch (err) {
    console.error('Error reading misc-spend.json', err);
    res.status(500).json({ message: 'Failed to read Misc spend' });
  }
});

app.post('/api/misc-spend', async (req, res) => {
  try {
    const newRecord = req.body;
    if (!newRecord || typeof newRecord !== 'object') {
      return res.status(400).json({ message: 'Invalid record payload' });
    }

    const records = await readMiscSpend();
    if (!newRecord.id) {
      newRecord.id = `MISC-${Date.now()}`;
    }
    records.push(newRecord);
    await writeMiscSpend(records);

    res.status(201).json(newRecord);
  } catch (err) {
    console.error('Error writing to misc-spend.json', err);
    res.status(500).json({ message: 'Failed to save Misc spend' });
  }
});

app.put('/api/misc-spend/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updated = req.body;
    if (!updated || typeof updated !== 'object') {
      return res.status(400).json({ message: 'Invalid record payload' });
    }

    const records = await readMiscSpend();
    const index = records.findIndex((r) => r.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Record not found' });
    }

    records[index] = { ...records[index], ...updated, id };
    await writeMiscSpend(records);

    res.json(records[index]);
  } catch (err) {
    console.error('Error updating misc-spend.json', err);
    res.status(500).json({ message: 'Failed to update Misc spend' });
  }
});

app.delete('/api/misc-spend/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const records = await readMiscSpend();
    const index = records.findIndex((r) => r.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Record not found' });
    }

    records.splice(index, 1);
    await writeMiscSpend(records);

    res.status(204).end();
  } catch (err) {
    console.error('Error deleting from misc-spend.json', err);
    res.status(500).json({ message: 'Failed to delete Misc spend' });
  }
});

// Gurugram Marts API endpoints
app.get('/api/gurugram-marts', async (_req, res) => {
  try {
    const marts = await readGurugramMarts();
    res.json(marts);
  } catch (err) {
    console.error('Error reading gurugram-marts.json', err);
    res.status(500).json({ message: 'Failed to read Gurugram marts' });
  }
});

app.post('/api/gurugram-marts', async (req, res) => {
  try {
    const newMart = req.body;
    if (!newMart || typeof newMart !== 'object') {
      return res.status(400).json({ message: 'Invalid mart payload' });
    }

    const marts = await readGurugramMarts();
    if (!newMart.id) {
      newMart.id = `GGM-${Date.now()}`;
    }
    marts.push(newMart);
    await writeGurugramMarts(marts);

    res.status(201).json(newMart);
  } catch (err) {
    console.error('Error writing to gurugram-marts.json', err);
    res.status(500).json({ message: 'Failed to save Gurugram mart' });
  }
});

app.put('/api/gurugram-marts/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updated = req.body;
    if (!updated || typeof updated !== 'object') {
      return res.status(400).json({ message: 'Invalid mart payload' });
    }

    const marts = await readGurugramMarts();
    const index = marts.findIndex((m) => m.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Mart not found' });
    }

    marts[index] = { ...marts[index], ...updated, id };
    await writeGurugramMarts(marts);

    res.json(marts[index]);
  } catch (err) {
    console.error('Error updating gurugram-marts.json', err);
    res.status(500).json({ message: 'Failed to update Gurugram mart' });
  }
});

app.delete('/api/gurugram-marts/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const marts = await readGurugramMarts();
    const index = marts.findIndex((m) => m.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Mart not found' });
    }

    marts.splice(index, 1);
    await writeGurugramMarts(marts);

    res.status(204).end();
  } catch (err) {
    console.error('Error deleting from gurugram-marts.json', err);
    res.status(500).json({ message: 'Failed to delete Gurugram mart' });
  }
});

// Delhi Marts API endpoints
app.get('/api/delhi-marts', async (_req, res) => {
  try {
    const marts = await readDelhiMarts();
    res.json(marts);
  } catch (err) {
    console.error('Error reading delhi-marts.json', err);
    res.status(500).json({ message: 'Failed to read Delhi marts' });
  }
});

app.post('/api/delhi-marts', async (req, res) => {
  try {
    const newMart = req.body;
    if (!newMart || typeof newMart !== 'object') {
      return res.status(400).json({ message: 'Invalid mart payload' });
    }

    const marts = await readDelhiMarts();
    if (!newMart.id) {
      newMart.id = `DLM-${Date.now()}`;
    }
    marts.push(newMart);
    await writeDelhiMarts(marts);

    res.status(201).json(newMart);
  } catch (err) {
    console.error('Error writing to delhi-marts.json', err);
    res.status(500).json({ message: 'Failed to save Delhi mart' });
  }
});

app.put('/api/delhi-marts/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updated = req.body;
    if (!updated || typeof updated !== 'object') {
      return res.status(400).json({ message: 'Invalid mart payload' });
    }

    const marts = await readDelhiMarts();
    const index = marts.findIndex((m) => m.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Mart not found' });
    }

    marts[index] = { ...marts[index], ...updated, id };
    await writeDelhiMarts(marts);

    res.json(marts[index]);
  } catch (err) {
    console.error('Error updating delhi-marts.json', err);
    res.status(500).json({ message: 'Failed to update Delhi mart' });
  }
});

app.delete('/api/delhi-marts/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const marts = await readDelhiMarts();
    const index = marts.findIndex((m) => m.id === id);

    if (index === -1) {
      return res.status(404).json({ message: 'Mart not found' });
    }

    marts.splice(index, 1);
    await writeDelhiMarts(marts);

    res.status(204).end();
  } catch (err) {
    console.error('Error deleting from delhi-marts.json', err);
    res.status(500).json({ message: 'Failed to delete Delhi mart' });
  }
});

app.get('/api/followups', async (_req, res) => {
  try {
    const followups = await readFollowups();
    res.json(followups);
  } catch (err) {
    console.error('Error reading followups.json', err);
    res.status(500).json({ message: 'Failed to read followups' });
  }
});

app.post('/api/followups', async (req, res) => {
  try {
    const newFollowup = req.body;
    if (!newFollowup || typeof newFollowup !== 'object') {
      return res.status(400).json({ message: 'Invalid followup payload' });
    }

    const followups = await readFollowups();
    followups.push(newFollowup);
    await writeFollowups(followups);

    res.status(201).json(newFollowup);
  } catch (err) {
    console.error('Error writing to followups.json', err);
    res.status(500).json({ message: 'Failed to save followup' });
  }
});

app.put('/api/followups/:customerPhone', async (req, res) => {
  try {
    const customerPhone = decodeURIComponent(req.params.customerPhone);
    const updated = req.body;
    if (!updated || typeof updated !== 'object') {
      return res.status(400).json({ message: 'Invalid followup payload' });
    }

    const followups = await readFollowups();
    const index = followups.findIndex((f) => f.customerPhone === customerPhone);

    if (index === -1) {
      // If not found, create a new one
      const newFollowup = { ...updated, customerPhone };
      followups.push(newFollowup);
      await writeFollowups(followups);
      return res.json(newFollowup);
    }

    followups[index] = { ...followups[index], ...updated, customerPhone };
    await writeFollowups(followups);

    res.json(followups[index]);
  } catch (err) {
    console.error('Error updating followups.json', err);
    res.status(500).json({ message: 'Failed to update followup' });
  }
});

app.delete('/api/followups/:customerPhone', async (req, res) => {
  try {
    const customerPhone = decodeURIComponent(req.params.customerPhone);
    const followups = await readFollowups();
    const index = followups.findIndex((f) => f.customerPhone === customerPhone);

    if (index === -1) {
      return res.status(404).json({ message: 'Followup not found' });
    }

    followups.splice(index, 1);
    await writeFollowups(followups);

    res.status(204).end();
  } catch (err) {
    console.error('Error deleting from followups.json', err);
    res.status(500).json({ message: 'Failed to delete followup' });
  }
});

app.listen(PORT, () => {
  console.log(`Products API server listening on http://localhost:${PORT}`);
});


