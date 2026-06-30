require('dotenv').config();
const db = require('../src/db');

const FIRST_NAMES = ['Alice','Bob','Carol','David','Eve','Frank','Grace','Hank','Iris','Jack','Karen','Leo','Mia','Nate','Olivia','Paul','Quinn','Rosa','Sam','Tina','Uma','Victor','Wendy','Xander','Yara','Zoe','Aria','Ben','Cleo','Diego'];
const LAST_NAMES  = ['Johnson','Martinez','White','Kim','Nguyen','Patel','Smith','Brown','Garcia','Lee','Wilson','Taylor','Anderson','Thomas','Jackson','Harris','Clark','Lewis','Robinson','Walker','Hall','Allen','Young','Hernandez','King','Wright','Scott','Green','Baker','Adams'];

const DEPOSIT_DESCS    = ['Salary','Freelance payment','Bonus','Consulting fee','Tax refund','Rental income','Investment return','Side project','Commission','Reimbursement'];
const WITHDRAW_DESCS   = ['Rent','Groceries','Electricity bill','Internet bill','Gym membership','Streaming services','Phone bill','Insurance premium','Car payment','Restaurant'];
const TRANSFER_DESCS   = ['Rent share','Lunch repayment','Dinner split','Coffee bet','Shared subscription','Holiday fund','Concert tickets','Birthday gift','Debt repayment','Utilities split'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return +(Math.random() * (max - min) + min).toFixed(2); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function seed() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM transactions');
    await client.query('DELETE FROM accounts');

    // Build 30 unique accounts
    const accountData = FIRST_NAMES.map((first, i) => ({
      owner_name: `${first} ${LAST_NAMES[i]}`,
      email: `${first.toLowerCase()}.${LAST_NAMES[i].toLowerCase()}@example.com`,
      balance: rand(100, 20000),
    }));

    const placeholders = accountData.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(',');
    const values = accountData.flatMap(a => [a.owner_name, a.email, a.balance]);
    const { rows: accounts } = await client.query(
      `INSERT INTO accounts (owner_name, email, balance) VALUES ${placeholders} RETURNING id, owner_name`,
      values
    );
    console.log(`Created ${accounts.length} accounts.`);

    const ids = accounts.map(a => a.id);

    // Generate 500 transactions
    const txns = [];
    for (let i = 0; i < 500; i++) {
      const daysAgo = randInt(0, 90);
      const type = pick(['deposit', 'deposit', 'withdrawal', 'withdrawal', 'transfer']); // deposit/withdrawal twice as likely as transfer
      const amount = rand(10, 2000);

      let fromId = null, toId = null, description;
      if (type === 'deposit') {
        toId = pick(ids);
        description = pick(DEPOSIT_DESCS);
      } else if (type === 'withdrawal') {
        fromId = pick(ids);
        description = pick(WITHDRAW_DESCS);
      } else {
        fromId = pick(ids);
        toId = pick(ids.filter(id => id !== fromId));
        description = pick(TRANSFER_DESCS);
      }
      txns.push([fromId, toId, type, amount, description, daysAgo]);
    }

    // Bulk insert transactions in batches of 100
    for (let i = 0; i < txns.length; i += 100) {
      const batch = txns.slice(i, i + 100);
      const ph = batch.map((_, j) => `($${j*6+1},$${j*6+2},$${j*6+3},$${j*6+4},$${j*6+5},NOW() - ($${j*6+6} || ' days')::interval)`).join(',');
      const vals = batch.flatMap(t => t);
      await client.query(
        `INSERT INTO transactions (from_account_id, to_account_id, type, amount, description, created_at) VALUES ${ph}`,
        vals
      );
    }
    console.log(`Created ${txns.length} transactions.`);

    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await db.end();
  }
}

seed();
