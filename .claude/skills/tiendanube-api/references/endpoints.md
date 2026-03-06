# Tienda Nube Endpoints Reference

Base URL: `https://api.tiendanube.com/v1/{storeId}`

## Orders

### `GET /{storeId}/orders`

**Query Parameters**: `created_at_min={ISO}`, `created_at_max={ISO}`, `payment_status=paid|refunded`, `per_page=200`, `page=N`

**Order Object Fields**:
- `id`, `number` — Identifiers
- `status` — `open`, `closed`, `cancelled`
- `payment_status` — `paid`, `authorized`, `pending`, `voided`, `refunded`
- `total`, `subtotal`, `discount`, `shipping_cost_customer`, `total_usd` — All strings, need `parseFloat()`
- `currency`, `created_at`
- `storefront` — `store` (web), `meli` (MercadoLibre), `api` (external), `form` (manual), `pos` (point of sale)
- `shipping_status` — `unpacked`, `unfulfilled`, `fulfilled`, `delivered`
- `products[]` — `{ id, product_id, name, price (string), quantity }`
- `customer` — `{ id }`

## Storefront Values

| Value | Channel |
|---|---|
| `store` | Main website |
| `meli` | MercadoLibre marketplace |
| `api` | External/API integration |
| `form` | Manual order form |
| `pos` | Physical point of sale |

## Important Notes

- API returns JSON arrays directly (not wrapped in a `data` property).
- `payment_status` filter only accepts ONE value per request — fetch paid and refunded separately.
- Date format in params: ISO without timezone offset (`T00:00:00`).
- All monetary fields are **strings** — always `parseFloat()`.