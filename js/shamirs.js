/* ============================================
   js/shamirs.js
   Shamir's Secret Sharing + LSB Steganography

   HOW IT WORKS MATHEMATICALLY:
   ─────────────────────────────────────────────
   We operate in GF(256) — Galois Field of 256
   elements (numbers 0–255). This is the same
   finite field used in AES encryption.

   To split a secret byte S into N shares with
   threshold K:
   1. Pick a random polynomial of degree K-1:
      f(x) = S + a1*x + a2*x² + ... + a(k-1)*x^(k-1)
      where S is the secret (constant term)
      and a1...a(k-1) are random coefficients
   2. Evaluate f(1), f(2), ..., f(N) to get N shares
   3. Share i = (i, f(i))

   To reconstruct from K shares using
   Lagrange interpolation:
      f(0) = Σ y_i * Π (0 - x_j)/(x_i - x_j)
   This recovers the original secret byte S = f(0)

   We process the message byte-by-byte, splitting
   each byte independently into N shares.
   ============================================ */

const Shamirs = (() => {

    // ── GF(256) arithmetic (irreducible poly 0x11b = x^8+x^4+x^3+x+1, same as AES) ──

    function gfMul(a, b) {
        let p = 0;
        for (let i = 0; i < 8; i++) {
            if (b & 1) p ^= a;
            const carry = a & 0x80;
            a = (a << 1) & 0xFF;
            if (carry) a ^= 0x1b; // reduction mod irreducible polynomial
            b >>= 1;
        }
        return p;
    }

    function gfAdd(a, b) { return a ^ b; } // XOR = addition in GF(256)

    // Evaluate polynomial with given coefficients at point x in GF(256)
    // coeffs[0] = secret byte (constant term), coeffs[1..k-1] = random
    function polyEval(coeffs, x) {
        let result = 0;
        // Horner's method: ((a[k]*x + a[k-1])*x + ...) * x + a[0]
        for (let i = coeffs.length - 1; i >= 0; i--) {
            result = gfAdd(gfMul(result, x), coeffs[i]);
        }
        return result;
    }

    // Lagrange interpolation at x=0 to recover secret byte
    // points = [{x, y}, ...] (at least K points)
    function lagrangeAt0(points) {
        let secret = 0;
        for (let i = 0; i < points.length; i++) {
            let num = 1, den = 1;
            for (let j = 0; j < points.length; j++) {
                if (i === j) continue;
                num = gfMul(num, points[j].x);           // 0 - x_j = x_j in GF(256) (since -1 = 1)
                den = gfMul(den, gfAdd(points[i].x, points[j].x)); // x_i - x_j
            }
            // den inverse via Fermat's little theorem: a^(254) in GF(256)
            let inv = 1, base = den, exp = 254;
            while (exp > 0) {
                if (exp & 1) inv = gfMul(inv, base);
                base = gfMul(base, base);
                exp >>= 1;
            }
            secret = gfAdd(secret, gfMul(gfMul(points[i].y, num), inv));
        }
        return secret;
    }

    // ── SPLIT ──
    // message: string
    // n: total shares, k: threshold (minimum to reconstruct)
    // Returns array of N share strings (each is a JSON-encoded payload)
    function split(message, n, k) {
        if (k > n) throw new Error('Threshold K cannot be greater than total shares N.');
        if (k < 2) throw new Error('Threshold K must be at least 2.');
        if (n > 255) throw new Error('Maximum N is 255.');

        // Convert message to bytes
        const msgBytes = stringToBytes(message);

        // For each byte, generate N share values using a random degree-(k-1) polynomial
        // shareMatrix[i] = array of share bytes for share (i+1)
        const shareMatrix = Array.from({ length: n }, () => new Uint8Array(msgBytes.length));

        const randomBytes = new Uint8Array(msgBytes.length * (k - 1));
        crypto.getRandomValues(randomBytes); // use browser crypto for secure randomness

        for (let byteIdx = 0; byteIdx < msgBytes.length; byteIdx++) {
            // Build polynomial: coeffs[0] = secret byte, rest = random
            const coeffs = new Uint8Array(k);
            coeffs[0] = msgBytes[byteIdx];
            for (let c = 1; c < k; c++) {
                coeffs[c] = randomBytes[byteIdx * (k - 1) + (c - 1)];
            }

            // Evaluate at x = 1, 2, ..., N
            for (let shareIdx = 0; shareIdx < n; shareIdx++) {
                shareMatrix[shareIdx][byteIdx] = polyEval(coeffs, shareIdx + 1);
            }
        }

        // Pack each share into a storable string
        // Format: "SSS:version:shareIndex(1-based):N:K:hexData"
        return shareMatrix.map((shareBytes, i) => {
            const hex = Array.from(shareBytes).map(b => b.toString(16).padStart(2, '0')).join('');
            return `SSS:1:${i + 1}:${n}:${k}:${hex}`;
        });
    }

    // ── RECONSTRUCT ──
    // shareStrings: array of share strings (at least K of them)
    // Returns the original message string
    function reconstruct(shareStrings) {
        if (!shareStrings || shareStrings.length === 0) throw new Error('No shares provided.');

        // Parse shares
        const shares = shareStrings.map(s => {
            const parts = s.split(':');
            if (parts.length !== 6 || parts[0] !== 'SSS') throw new Error('Invalid share format. Make sure you are uploading images encoded with the Shamir tab.');
            const shareIdx = parseInt(parts[2]);
            const n = parseInt(parts[3]);
            const k = parseInt(parts[4]);
            const hex = parts[5];
            const bytes = new Uint8Array(hex.match(/.{2}/g).map(h => parseInt(h, 16)));
            return { x: shareIdx, n, k, bytes };
        });

        const k = shares[0].k;
        const msgLen = shares[0].bytes.length;

        if (shares.length < k) {
            throw new Error(`Not enough shares. Need at least ${k}, got ${shares.length}.`);
        }

        // Use exactly k shares (first k if more provided)
        const usedShares = shares.slice(0, k);

        // Reconstruct each byte
        const resultBytes = new Uint8Array(msgLen);
        for (let byteIdx = 0; byteIdx < msgLen; byteIdx++) {
            const points = usedShares.map(s => ({ x: s.x, y: s.bytes[byteIdx] }));
            resultBytes[byteIdx] = lagrangeAt0(points);
        }

        return bytesToString(resultBytes);
    }

    // ── HELPERS ──
    function stringToBytes(str) {
        return new TextEncoder().encode(str);
    }

    function bytesToString(bytes) {
        return new TextDecoder().decode(bytes);
    }

    return { split, reconstruct };

})();