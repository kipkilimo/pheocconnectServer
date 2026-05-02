// server/src/index.ts
import os from "os";
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
import https from "https";
import fs from "fs";
import { URL } from "url";
import { PubSub } from "graphql-subscriptions";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import depthLimit from "graphql-depth-limit";

import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "@apollo/server-plugin-landing-page-graphql-playground";

import connectDB from "./database/connection";
import schema from "./graphql/schema";
import { authMiddleware, context as authContext } from "./utils/authGenerator";
import { connectRedis, disconnectRedis } from "./utils/redis";

/* ============================================
 WEBSOCKET IMPORTS
============================================ */
import { alertWSS, getWebSocketMetrics, closeWebSocketServer } from "./sockets";

/* ============================================
 OPTIONAL ROUTES
============================================ */
import fileRoutes from "./routes/fileRoutes";

/* ============================================
 SECURITY CONFIGURATION
============================================ */

const isProduction = process.env.NODE_ENV === "production";
const MAX_WS_CONNECTIONS = 100;
const WS_AUTH_TOKEN =
  process.env.WS_AUTH_TOKEN || "default-secure-token-change-me";

// Rate limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 minutes
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind proxy
    return (
      (req.headers["x-forwarded-for"] as string) ||
      req.socket.remoteAddress ||
      "unknown"
    );
  },
});

const graphqlLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200, // 200 GraphQL requests per 5 minutes
  message: "GraphQL request limit exceeded. Slow down!",
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 failed attempts
  skipSuccessfulRequests: true,
  message: "Too many login attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

/* ============================================
 BOOTSTRAP
============================================ */

const startServer = async () => {
  const app = express();
  const pubsub = new PubSub();

  /* ============================================
   DATABASE
  ============================================ */
  await connectDB();
  await connectRedis(); // Connect to Redis

  /* ============================================
   SECURITY MIDDLEWARE
  ============================================ */

  // Hide server fingerprint
  app.disable("x-powered-by");

  // Helmet for security headers
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false, // Disable if using GraphQL playground in dev
      hsts: isProduction
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
    }),
  );

  // Apply global rate limiting
  if (isProduction) {
    app.use(globalLimiter);
  }

  // Apply stricter rate limiting to login endpoints (if you have them)
  app.use("/graphql", graphqlLimiter);
  app.use("/api/login", loginLimiter);

  /* ============================================
   CORS CONFIG (Hardened)
  ============================================ */
  const allowedOrigins = [
    "http://localhost:8040",
    "http://127.0.0.1:8040",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://192.168.43.218:8040",
    "http://192.168.43.218:5173",
    "https://pheocconnect.org",
    "https://www.pheocconnect.org",
    process.env.CORS_ORIGIN,
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        // ✅ Production: strict
        if (isProduction) {
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          return callback(new Error(`CORS blocked: ${origin}`));
        }

        // ✅ Development: allow localhost + LAN
        const isLocal =
          origin.includes("localhost") ||
          origin.includes("127.0.0.1") ||
          origin.startsWith("http://192.168.");

        if (isLocal) {
          return callback(null, true);
        }

        console.warn("⚠️ Dev CORS blocked:", origin);
        return callback(null, false); // DON'T throw error in dev
      },
      credentials: true,
    }),
  );

  // Reduced payload size for security
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true, limit: "5mb" }));

  /* ============================================
   AUTH MIDDLEWARE (Express)
  ============================================ */
  app.use(authMiddleware);

  /* ============================================
   HEALTH CHECK ENDPOINT FOR WEBSOCKET METRICS
  ============================================ */
  app.get("/ws/metrics", (req, res) => {
    // Only expose metrics in production if authenticated
    if (isProduction) {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${process.env.METRICS_TOKEN}`) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }
    res.json(getWebSocketMetrics());
  });

  /* ============================================
   APOLLO SERVER (Hardened - FIXED)
  ============================================ */

  // Then in your ApolloServer configuration:
  const apolloServer = new ApolloServer({
    schema,
    introspection: !isProduction, // Disable introspection in production
    csrfPrevention: true,
    cache: "bounded",
    validationRules: [depthLimit(5)],
    plugins: isProduction
      ? [] // Empty array for production - no playground
      : [ApolloServerPluginLandingPageGraphQLPlayground()], // Playground only in dev
  });

  await apolloServer.start();

  app.use(
    "/graphql",
    expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        // Add request context with timeout
        const user = (req as any).user || (await authContext({ req })).user;
        return {
          req,
          pubsub,
          user,
          startTime: Date.now(),
        };
      },
    }),
  );

  /* ============================================
   REST ENDPOINTS
  ============================================ */
  app.use("/api", fileRoutes);

  /* ============================================
   SERVER (HTTP / HTTPS)
  ============================================ */

  let server: http.Server | https.Server;
  const serverTimeout = 10000; // 10 seconds to prevent Slowloris

  if (isProduction) {
    server = https.createServer(
      {
        key: fs.readFileSync(
          "/etc/letsencrypt/live/pheocconnect.org/privkey.pem",
        ),
        cert: fs.readFileSync(
          "/etc/letsencrypt/live/pheocconnect.org/fullchain.pem",
        ),
        // Additional SSL security
        minVersion: "TLSv1.2",
        ciphers: [
          "ECDHE-ECDSA-AES128-GCM-SHA256",
          "ECDHE-RSA-AES128-GCM-SHA256",
          "ECDHE-ECDSA-AES256-GCM-SHA384",
          "ECDHE-RSA-AES256-GCM-SHA384",
        ].join(":"),
      },
      app,
    );

    console.log("🔐 HTTPS enabled with secure ciphers");
  } else {
    server = http.createServer(app);
    console.log("🧪 HTTP enabled (development)");
  }

  server.setTimeout(serverTimeout);
  server.keepAliveTimeout = 5000; // Reduce keep-alive timeout
  server.headersTimeout = 6000; // Slightly higher than keepAliveTimeout

  /* ============================================
   WEBSOCKET UPGRADE HANDLER (Hardened)
  ============================================ */

  server.on("upgrade", (req, socket, head) => {
    // Validate request
    if (!req.url || !req.headers.host) {
      console.warn("⚠️ WebSocket upgrade denied: missing URL or host");
      socket.destroy();
      return;
    }

    // Check connection limits
    if (alertWSS.clients.size >= MAX_WS_CONNECTIONS) {
      console.warn(
        `⚠️ WebSocket upgrade denied: max connections (${MAX_WS_CONNECTIONS}) reached`,
      );
      socket.destroy();
      return;
    }

    // Authenticate WebSocket (required for production)
    if (isProduction) {
      const authToken = req.headers["sec-websocket-protocol"];

      if (!authToken || authToken !== WS_AUTH_TOKEN) {
        console.warn(
          "⚠️ WebSocket upgrade denied: invalid or missing auth token",
        );
        socket.destroy();
        return;
      }
    }

    try {
      const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

      // Handle WebSocket upgrades for /alerts endpoint
      if (pathname === "/alerts") {
        // Add rate limiting per IP for WebSocket connections
        const clientIP =
          (req.headers["x-forwarded-for"] as string) ||
          req.socket.remoteAddress;

        alertWSS.handleUpgrade(req, socket, head, (ws: any) => {
          // Attach metadata to connection
          (ws as any).clientIP = clientIP;
          (ws as any).connectedAt = Date.now();
          alertWSS.emit("connection", ws, req);
        });
      } else {
        console.warn(`⚠️ WebSocket upgrade denied: invalid path ${pathname}`);
        socket.destroy();
      }
    } catch (err) {
      console.error("❌ WebSocket upgrade error:", err);
      socket.destroy();
    }
  });

  /* ============================================
   START SERVER
  ============================================ */

  const PORT = Number(process.env.PORT) || 4040;

  server.listen(PORT, "0.0.0.0", () => {
    console.log(
      `\n🚀 PHEOC Server running (${isProduction ? "PRODUCTION" : "DEVELOPMENT"} mode)`,
    );
    console.log(`📡 GraphQL: /graphql`);
    console.log(`🚨 Alerts WS: /alerts`);
    console.log(`📊 WS Metrics: /ws/metrics`);
    console.log(`🌍 Port: ${PORT}`);

    if (isProduction) {
      console.log(`\n🔒 Security features enabled:`);
      console.log(`   • Rate limiting (global: 500/15min, GraphQL: 200/5min)`);
      console.log(`   • Query depth limit: 5 levels`);
      console.log(`   • Introspection: disabled`);
      console.log(`   • Payload size limit: 5MB`);
      console.log(`   • WebSocket auth required`);
      console.log(`   • WebSocket max connections: ${MAX_WS_CONNECTIONS}`);
      console.log(`   • Request timeout: ${serverTimeout}ms`);
      console.log(`   • Helmet security headers enabled`);
      console.log(`   • CORS strict mode`);
    }

    console.log(`\n📝 Active endpoints (clickable):\n`);

    // Get all network interfaces
    const networkInterfaces = os.networkInterfaces();

    // Display localhost
    console.log(`   🏠 http://localhost:${PORT}/graphql`);
    console.log(`   🏠 http://127.0.0.1:${PORT}/graphql`);
    console.log(`   🏠 ws://localhost:${PORT}/alerts`);
    console.log(`   🏠 ws://127.0.0.1:${PORT}/alerts`);

    // Display all network IPs
    Object.keys(networkInterfaces).forEach((interfaceName) => {
      const interfaces = networkInterfaces[interfaceName];
      if (interfaces) {
        interfaces.forEach((netInterface) => {
          if (netInterface.family === "IPv4" && !netInterface.internal) {
            console.log(`   🌐 http://${netInterface.address}:${PORT}/graphql`);
            console.log(`   📡 ws://${netInterface.address}:${PORT}/alerts`);
          }
        });
      }
    });

    console.log(`\n✨ Server ready! Press Ctrl+C to stop\n`);
  });

  /* ============================================
   GRACEFUL SHUTDOWN
  ============================================ */

  const gracefulShutdown = async (signal: string) => {
    console.log(`\n⚠️ ${signal} received, starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      console.log("✅ HTTP server closed");

      // Close WebSocket connections
      await closeWebSocketServer();

      // Disconnect Redis
      await disconnectRedis();

      console.log("✨ Graceful shutdown completed");
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error("💥 Force shutdown timeout reached");
      process.exit(1);
    }, 30000);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
};

// Start the server with error handling
startServer().catch(async (err) => {
  console.error("💥 Server failed to start:", err);
  await disconnectRedis();
  process.exit(1);
});
function ApolloServerPluginLandingPageDisabled() {
  throw new Error("Function not implemented.");
}
