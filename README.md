# MyBankApp

A simple REST banking API backed by Aiven PostgreSQL 17.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your Aiven password
3. `npm start`  (or `npm run dev` for auto-reload)

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/accounts` | Create account (`owner_name`, `email`, optional `initial_balance`) |
| `GET` | `/accounts` | List all accounts |
| `GET` | `/accounts/:id` | Get account by ID |
| `POST` | `/accounts/:id/deposit` | Deposit (`amount`, optional `description`) |
| `POST` | `/accounts/:id/withdraw` | Withdraw (`amount`, optional `description`) |
| `POST` | `/accounts/:id/transfer` | Transfer (`to_account_id`, `amount`, optional `description`) |
| `GET` | `/accounts/:id/transactions` | Transaction history (last 100) |

## Example

```bash
# Create an account
curl -s -X POST http://localhost:3000/accounts \
  -H 'Content-Type: application/json' \
  -d '{"owner_name":"Alice","email":"alice@example.com","initial_balance":1000}'

# Deposit
curl -s -X POST http://localhost:3000/accounts/1/deposit \
  -H 'Content-Type: application/json' \
  -d '{"amount":250,"description":"Paycheck"}'

# Transfer
curl -s -X POST http://localhost:3000/accounts/1/transfer \
  -H 'Content-Type: application/json' \
  -d '{"to_account_id":2,"amount":100}'
```

## Database Schema

```
accounts       — id, owner_name, email, balance, created_at, updated_at
transactions   — id, from_account_id, to_account_id, type, amount, description, created_at
```

Constraints: balance can never go negative (DB-level `CHECK`); all balance mutations run inside transactions.
