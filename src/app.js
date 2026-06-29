...require('dotenv').config();
const path = require('path');
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/accounts', require('./routes/accounts'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Central error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bank app running on port ${PORT}`));

module.exports = app;
