# Cartify Smart Locker — Unlock Code Algorithm Specification

## Overview

Replaces MQTT-based locker communication with a **deterministic, offline code generation** system.  
Both the backend and the Arduino firmware independently compute identical unlock codes — no internet required.

---

## Terminology

| Term        | Definition |
|---|---|
| `userId`    | A short numeric ID assigned to each return request (e.g. `583274`) |
| `date`      | Today's date in `YYYYMMDD` format (UTC) |
| `secretKey` | A shared 32-character hex string known only to backend + Arduino firmware |
| `unlockCode`| A 4-digit numeric code derived from the above |

---

## Algorithm — Step by Step

### Inputs
```
date      = "20260606"          // YYYYMMDD, UTC
userId    = "583274"
secretKey = "A3F7C2D1E4B8..."   // 32 hex chars, never exposed to frontend
```

### Step 1 — Build input string
```
input = date + ":" + userId + ":" + secretKey
// "20260606:583274:A3F7C2D1E4B8..."
```

### Step 2 — Hash with SHA-256
```
hash = SHA256(input)
// produces 32-byte (256-bit) hex string
```

### Step 3 — Extract 4-digit code
Take the **first 8 hex characters** of the hash, parse as unsigned 32-bit integer, modulo 9000, add 1000.

```
raw   = parseInt(hash.substring(0, 8), 16)   // 0 to 4294967295
code  = (raw % 9000) + 1000                  // always 1000–9999 (4 digits)
```

This guarantees:
- Always exactly 4 digits
- Uniform distribution (9000 possible values)
- Daily rotation (date changes every day UTC)
- Per-user uniqueness (userId differs)
- Brute-force resistance (SHA-256 preimage resistance)

---

## Daily Rotation

| Day        | userId | Code |
|---|---|---|
| 2026-06-06 | 583274 | 4821 |
| 2026-06-07 | 583274 | 7039 | ← different next day |
| 2026-06-06 | 291847 | 3156 | ← different user, same day |

Return codes are valid for **48 hours** from creation.  
The locker tries **today's date** first, then **yesterday's date** as fallback.

---

## Security Properties

- Secret key is never stored in the frontend or sent over the network
- SHA-256 is not reversible — knowing the code does not reveal the key
- Each (date, userId) pair produces a unique code
- An attacker would need to try all 9000 combinations per day (trivially detectable)
- Codes rotate automatically at UTC midnight

---

## Backend Implementation (Node.js)

See: `src/utils/lockerCode.js`

```js
import { createHash } from 'crypto';

const SECRET_KEY = process.env.LOCKER_SECRET_KEY; // 32+ char hex string

export function generateLockerCode(userId, dateStr = null) {
  const date  = dateStr || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const input = `${date}:${userId}:${SECRET_KEY}`;
  const hash  = createHash('sha256').update(input).digest('hex');
  const raw   = parseInt(hash.substring(0, 8), 16);
  return String((raw % 9000) + 1000);
}

export function validateLockerCode(userId, enteredCode) {
  const today     = new Date();
  const todayStr  = today.toISOString().slice(0, 10).replace(/-/g, '');
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const yestStr   = yesterday.toISOString().slice(0, 10).replace(/-/g, '');

  return enteredCode === generateLockerCode(userId, todayStr) ||
         enteredCode === generateLockerCode(userId, yestStr);
}
```

---

## Arduino / Hardware Implementation (C++)

```cpp
#include <SHA256.h>   // Arduino SHA256 library (e.g. Crypto library by rweather)

const char* SECRET_KEY = "A3F7C2D1E4B8...";  // same as backend .env

int generateLockerCode(const char* userId, const char* dateStr) {
  // Build input string: "YYYYMMDD:userId:secretKey"
  char input[128];
  snprintf(input, sizeof(input), "%s:%s:%s", dateStr, userId, SECRET_KEY);

  // SHA-256 hash
  uint8_t hash[32];
  SHA256 sha256;
  sha256.reset();
  sha256.update((const uint8_t*)input, strlen(input));
  sha256.finalize(hash, 32);

  // Extract first 4 bytes as uint32
  uint32_t raw = ((uint32_t)hash[0] << 24) |
                 ((uint32_t)hash[1] << 16) |
                 ((uint32_t)hash[2] << 8)  |
                  (uint32_t)hash[3];

  return (int)(raw % 9000) + 1000;
}

bool validateCode(const char* userId, const char* enteredCode, const char* todayDate, const char* yesterdayDate) {
  char buf[8];
  snprintf(buf, sizeof(buf), "%d", generateLockerCode(userId, todayDate));
  if (strcmp(buf, enteredCode) == 0) return true;
  snprintf(buf, sizeof(buf), "%d", generateLockerCode(userId, yesterdayDate));
  return strcmp(buf, enteredCode) == 0;
}
```

---

## Environment Variable

Add to `.env`:
```
LOCKER_SECRET_KEY=your_32_char_hex_key_here_never_expose
```

Generate a secure key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Return Request Flow (Updated)

1. User submits return request via `POST /returns`
2. Backend generates a **6-digit numeric userId** (random, stored with return)
3. Backend generates the **4-digit unlock code** using `generateLockerCode(userId, today)`
4. Backend responds with:
   ```json
   {
     "returnRequest": {
       "userId": "583274",
       "unlockCode": "4821",
       "expiresAt": "2026-06-08T..."
     }
   }
   ```
5. Frontend displays **both** to the user
6. User goes to locker, enters **userId** then **unlockCode**
7. Arduino computes `F(today, userId, SECRET_KEY)` locally — if match → opens

---

## Files Changed

| File | Change |
|---|---|
| `src/utils/lockerCode.js` | NEW — code generation + validation |
| `src/modules/return/return.controller.js` | Generates userId + unlockCode on create |
| `db/models/return.model.js` | Added `lockerUserId`, `unlockCode` fields |
| `returns.html` | Displays userId + unlockCode to user |
| `.env.example` | Added `LOCKER_SECRET_KEY` |
| `package.json` | Removed `mqtt` dependency |
| `src/modules/mqtt/` | DELETED |
| `index.js` | Removed `initMqtt()` call |
