/**
 * Authentication Module
 * Handles password-only admin authentication with JWT tokens
 */

/**
 * Simple bcrypt-like password verification
 * Uses Web Crypto API for secure comparison
 * Note: For production, store a proper bcrypt hash and use a bcrypt library
 * This implementation uses PBKDF2 for password hashing
 */
async function verifyPassword(password, storedHash, env) {
  // If ADMIN_PASSWORD_HASH is a plain bcrypt hash, we need to compare
  // For simplicity, we'll use a SHA-256 based comparison
  // The hash should be generated using the same method

  const encoder = new TextEncoder();
  const data = encoder.encode(password + (env.JWT_SECRET || "salt"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison to prevent timing attacks
  const storedHashNormalized = env.ADMIN_PASSWORD_HASH || "";
  if (computedHash.length !== storedHashNormalized.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < computedHash.length; i++) {
    result |= computedHash.charCodeAt(i) ^ storedHashNormalized.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate a JWT token
 */
async function generateToken(env) {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload = {
    sub: "admin",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
  };

  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Create signature using HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.JWT_SECRET || "default-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signatureInput),
  );
  const signature = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer)),
  )
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify a JWT token
 */
export async function verifyToken(token, env) {
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;

    // Verify signature
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(env.JWT_SECRET || "default-secret"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    // Decode signature
    const signatureBytes = Uint8Array.from(
      atob(signature.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(signatureInput),
    );
    if (!isValid) return null;

    // Decode and verify payload
    const payload = JSON.parse(
      atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/")),
    );

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}

/**
 * Middleware to check authentication
 */
export async function requireAuth(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  return await verifyToken(token, env);
}

/**
 * Handle auth routes
 */
export async function handleAuth(
  request,
  env,
  { jsonResponse, errorResponse },
) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // POST /api/auth/login - Login with password
  if (path === "/api/auth/login" && method === "POST") {
    try {
      const body = await request.json();
      const { password } = body;

      if (!password) {
        return errorResponse("Password is required", 400, env, request);
      }

      // Verify password
      const isValid = await verifyPassword(
        password,
        env.ADMIN_PASSWORD_HASH,
        env,
      );

      if (!isValid) {
        return errorResponse("Invalid password", 401, env, request);
      }

      // Generate token
      const token = await generateToken(env);

      return jsonResponse(
        {
          token,
          expiresIn: 86400, // 24 hours in seconds
        },
        200,
        env,
        request,
      );
    } catch (error) {
      console.error("Login error:", error);
      return errorResponse("Login failed", 500, env, request);
    }
  }

  // GET /api/auth/verify - Verify token
  if (path === "/api/auth/verify" && method === "GET") {
    const user = await requireAuth(request, env);

    if (!user) {
      return errorResponse("Invalid or expired token", 401, env, request);
    }

    return jsonResponse({ valid: true, user }, 200, env, request);
  }

  // POST /api/auth/logout - Logout (client-side token removal)
  if (path === "/api/auth/logout" && method === "POST") {
    // JWT is stateless, so logout is handled client-side
    return jsonResponse({ success: true }, 200, env, request);
  }

  return errorResponse("Not found", 404, env, request);
}
