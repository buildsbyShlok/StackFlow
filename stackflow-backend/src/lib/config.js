// Validate before connecting or listening. Errors identify settings, never values.
export function readConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  for (const key of ["DB_URI", "ACCESS_SECRET", "REFRESH_SECRET"]) {
    if (!env[key]?.trim()) throw new Error(`Missing required environment variable: ${key}.`);
  }
  const minimum = production ? 32 : 24;
  if (env.ACCESS_SECRET === env.REFRESH_SECRET ||
      env.ACCESS_SECRET.length < minimum || env.REFRESH_SECRET.length < minimum ||
      /replace-with/i.test(env.ACCESS_SECRET + env.REFRESH_SECRET)) {
    throw new Error("ACCESS_SECRET and REFRESH_SECRET must be different random values of at least " + minimum + " characters; placeholders are not accepted.");
  }
  const port = Number(env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be an integer between 1 and 65535.");
  const { trustProxy, origins } = readHttpConfig(env);
  if (production) {
    let atlas = false;
    try {
      const uri = new URL(env.DB_URI);
      atlas = uri.protocol === "mongodb+srv:" && uri.hostname.endsWith(".mongodb.net") &&
        uri.pathname.length > 1 && !["admin", "local", "config"].includes(uri.pathname.slice(1)) &&
        ![...uri.searchParams].some(([key, value]) =>
          (["tls", "ssl"].includes(key.toLowerCase()) && value.toLowerCase() === "false") ||
          (["tlsinsecure", "tlsallowinvalidcertificates", "tlsallowinvalidhostnames"].includes(key.toLowerCase()) && value.toLowerCase() === "true"));
    } catch { /* Never include a credential-bearing URI in the error. */ }
    if (!atlas) throw new Error("Production DB_URI must be a MongoDB Atlas mongodb+srv URI with an application database and verified TLS.");
  }
  return { port, trustProxy, origins };
}

export function readHttpConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  const trustProxy = Number(env.TRUST_PROXY || 0);
  if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 2)
    throw new Error("TRUST_PROXY must be 0, 1, or 2 verified proxy hops.");
  const origins = (env.FRONTEND_URL || (production ? "" : "http://localhost:5173"))
    .split(",").map(value => value.trim());
  if (origins.some(origin => {
    try {
      const url = new URL(origin);
      return url.origin !== origin || !["http:", "https:"].includes(url.protocol) ||
        (production && (url.protocol !== "https:" || /^(localhost|127\.|\[::1\])/.test(url.hostname)));
    } catch { return true; }
  })) throw new Error("FRONTEND_URL must contain exact origins without trailing slashes; production requires HTTPS.");
  return { trustProxy, origins };
}
