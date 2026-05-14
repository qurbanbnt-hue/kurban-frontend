# Security & Performance Implementation Guide

> Updated: 2026-05-14 · Kurban Digital Platform

## 🔒 Security Improvements Implemented

### 1. **Request Tracing & Audit Logging**
- Every request gets unique `X-Request-ID` header
- Sanitized logging: email addresses masked as `user@***`, no token/password exposure
- Secure log function: `logSecure(action, message)` prevents sensitive data leaks

**Files Modified:**
- `api/proxy.js` — Added `logSecure()` & `generateRequestId()`
- `backend/Code.gs` — Replaced `Logger.log()` with `logSecure()`

---

### 2. **Enhanced Security Headers**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
X-Request-ID: [unique-id-per-request]
Content-Security-Policy: default-src 'none'; script-src 'self'
Cache-Control: no-store, no-cache, must-revalidate
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

**Implementation:** `api/proxy.js` main handler

---

### 3. **CORS & Cookie Security**
- CORS origin validation (whitelist in `ALLOWED_ORIGINS`)
- **New:** httpOnly, Secure, SameSite cookies for auth tokens
  ```javascript
  Set-Cookie: authToken=...; HttpOnly; Secure; SameSite=Strict; Max-Age=28800
  ```
- Credentials support: `Access-Control-Allow-Credentials: true`

**Action Required:** Update frontend to support httpOnly cookies:
- Phase 1 (current): Keep localStorage + Bearer token (works with Set-Cookie)
- Phase 2 (future): Remove localStorage, rely purely on httpOnly cookie

---

### 4. **Brute Force Protection**
- 2-second delay on failed login attempts
- Rate limiting: 60 req/min per IP, 40 req/min per user
- 429 response includes `Retry-After: 60` header

```javascript
// In proxy.js login endpoint
if (!result.success) {
  await new Promise(r => setTimeout(r, 2000)); // Delay brute force
  return res.status(401).json({ success: false, error: 'Email atau password salah' });
}
```

---

### 5. **Pagination Support (Performance)**
Three admin endpoints now support pagination to prevent full table fetches:

#### `getRegistrations(page, limit)`
```javascript
POST /api/proxy?action=getRegistrations
Body: { page: 1, limit: 50 }
Response: { success: true, data: [...], pagination: { page, limit, total, totalPages } }
```

#### `getKKDetailByMasjid(masjidId, page, limit)`
```javascript
POST /api/proxy?action=getKKDetailByMasjid
Body: { masjid_id: "...", page: 1, limit: 50 }
```

#### `getKKPerluVerifikasiByMasjid(masjidId, page, limit)`
```javascript
POST /api/proxy?action=getKKPerluVerifikasi
Body: { masjid_id: "...", page: 1, limit: 50 }
```

**Limits:** page ≥ 1, limit: 1–500 (default 50)

**Files Modified:**
- `backend/Code.gs` — Updated 3 functions with pagination logic
- `api/proxy.js` — Added `validatePagination(body)` validator

---

### 6. **Input Validation Enhancements**
- Stricter pagination parameter validation
- File MIME type whitelist (image/jpeg, image/png, image/webp, video/mp4, video/webm)
- File size limits: 5 MB for images, 20 MB for videos
- Base64 length validation before processing

---

### 7. **Error Handling Without Information Disclosure**
- Generic error messages to clients: "Internal server error"
- Detailed errors logged securely (email masked)
- No stack traces or system details exposed in responses

---

## ⚠️ Pending Security Fixes

### 🔴 CRITICAL
1. **CSRF Token Enforcement** — Generated but not validated yet
   - [ ] Add `X-CSRF-Token` header validation to state-changing endpoints
   - [ ] Store CSRF token in httpOnly cookie + session storage

2. **Virus Scanning** — File uploads need malware detection
   - Recommended: VirusTotal API, ClamAV, or VirusShare
   - Check before storing in Google Drive

3. **Password Hashing Review**
   - Current: SHA-256 + 500 iterations + random salt (acceptable)
   - Consider bcrypt library if deploying outside Google Apps Script

### 🟡 HIGH
4. **Rate Limit Persistence** — In-memory Map loses data on deployment restart
   - Solution: Store counters in GAS Cache or Sheets

5. **Session Revocation** — Check `revokeTokenMasjid()` properly invalidates user sessions
   - Verify token blacklist implementation

6. **Request Signing** — Current `GAS_SECRET` is shared symmetric key
   - Consider asymmetric signing (RSA) for future versions

---

## 📋 Configuration Checklist

### Environment Variables (Vercel)
```bash
APPS_SCRIPT_URL=https://script.google.com/macros/d/YOUR_SCRIPT_ID/usercontent
GAS_SECRET=generate-strong-random-secret-here
JWT_SECRET=generate-strong-random-secret-here
CSRF_SECRET=generate-strong-random-secret-here
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
NODE_ENV=production
```

### Google Apps Script Properties
1. Go to **Project Settings** → **Script Properties**
2. Add:
   ```
   SCRIPT_SECRET=same-value-as-GAS_SECRET-above
   FONNTE_API_TOKEN=your-fonnte-token
   ```

3. Set `ROOT_FOLDER_ID` in Code.gs with your Google Drive folder ID

---

## 🧪 Security Testing

### 1. CORS Preflight
```bash
curl -X OPTIONS https://api.yourdomain.com/api/proxy \
  -H "Origin: https://yourdomain.com" \
  -H "Access-Control-Request-Method: POST" \
  -v
```
Should return: `Access-Control-Allow-Origin: https://yourdomain.com`

### 2. Rate Limiting
```bash
# Send 41 requests in 60s as same user
for i in {1..41}; do
  curl -X POST https://api.yourdomain.com/api/proxy?action=getPublicStats
  sleep 1.5
done
```
Request 41 should return 429 with `Retry-After: 60`

### 3. Brute Force Protection
```bash
# Failed login attempts
curl -X POST https://api.yourdomain.com/api/proxy?action=login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}' \
  -w "Time: %{time_total}s\n"
```
Should take ~2+ seconds (brute force delay)

### 4. Pagination
```bash
curl -X POST https://api.yourdomain.com/api/proxy?action=getRegistrations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"page":1,"limit":50}'
```
Should return: `{ success: true, data: [...], pagination: {...} }`

---

## 📚 Related Resources

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Google Apps Script Security: https://developers.google.com/apps-script/guides/security
- JWT Best Practices: https://tools.ietf.org/html/rfc7519
- CORS Guide: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

---

## 👤 Security Contact

For security issues, email: `security@yourdomain.com` (do not use public GitHub issues)
