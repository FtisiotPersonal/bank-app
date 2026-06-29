const express = require('express');
const router = express.Router();
const db = require('../db');

// Create account
router.post('/', async (req, res) => {
  const { owner_name, email, initial_balance = 0 } = req.body;
  if (!owner_name || !email) {
    return res.status(400).json({ error: 'owner_name and email are required' });
  }
  try {
    const { rows } = await db.query(
      'INSERT INTO accounts (owner_name, email, balance) VALUES ($1, $2, $3) RETURNING *',
      [owner_name, email, initial_balance]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    throw err;
  }
});

// List all accounts
router.get('/', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM accounts ORDER BY id');
  res.json(rows);
});

// Get single account
router.get('/:id', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM accounts WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Account not found' });
  res.json(rows[0]);
});

// Deposit
router.post('/:id/deposit', async (req, res) => {
  const { amount, description } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'amount must be positive' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: accounts } = await client.query(
      'UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [amount, req.params.id]
    );
    if (!accounts.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Account not found' }); }
    const { rows: txn } = await client.query(
      'INSERT INTO transactions (to_account_id, type, amount, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.id, 'deposit', amount, description || null]
    );
    await client.query('COMMIT');
    res.json({ account: accounts[0], transaction: txn[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Withdraw
router.post('/:id/withdraw', async (req, res) => {
  const { amount, description } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'amount must be positive' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: accounts } = await client.query(
      'UPDATE accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2 AND balance >= $1 RETURNING *',
      [amount, req.params.id]
    );
    if (!accounts.length) {
      const exists = await client.query('SELECT id FROM accounts WHERE id = $1', [req.params.id]);
      await client.query('ROLLBACK');
      if (!exists.rows.length) return res.status(404).json({ error: 'Account not found' });
      return res.status(422).json({ error: 'Insufficient funds' });
    }
    const { rows: txn } = await client.query(
      'INSERT INTO transactions (from_account_id, type, amount, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.id, 'withdrawal', amount, description || null]
    );
    await client.query('COMMIT');
    res.json({ account: accounts[0], transaction: txn[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Transfer
router.post('/:id/transfer', async (req, res) => {
  const { to_account_id, amount, description } = req.body;
  if (!to_account_id || !amount || amount <= 0) {
    return res.status(400).json({ error: 'to_account_id and positive amount are required' });
  }
  if (String(req.params.id) === String(to_account_id)) {
    return res.status(400).json({ error: 'Cannot transfer to the same account' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: from } = await client.query(
      'UPDATE accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2 AND balance >= $1 RETURNING *',
      [amount, req.params.id]
    );
    if (!from.length) {
      const exists = await client.query('SELECT id FROM accounts WHERE id = $1', [req.params.id]);
      await client.query('ROLLBACK');
      if (!exists.rows.length) return res.status(404).json({ error: 'Source account not found' });
      return res.status(422).json({ error: 'Insufficient funds' });
    }
    const { rows: to } = await client.query(
      'UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [amount, to_account_id]
    );
    if (!to.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Destination account not found' }); }
    const { rows: txn } = await client.query(
      'INSERT INTO transactions (from_account_id, to_account_id, type, amount, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.params.id, to_account_id, 'transfer', amount, description || null]
    );
    await client.query('COMMIT');
    res.json({ from_account: from[0], to_account: to[0], transaction: txn[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Transaction history for an account
router.get('/:id/transactions', async (req, res) => {
  const { rows: exists } = await db.query('SELECT id FROM accounts WHERE id = $1', [req.params.id]);
  if (!exists.length) return res.status(404).json({ error: 'Account not found' });

  const { rows } = await db.query(
    `SELECT * FROM transactions
     WHERE from_account_id = $1 OR to_account_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [req.params.id]
  );
  res.json(rows);
});

module.exports = router;
