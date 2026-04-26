import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { URL } from "url";
import jwt, { JwtPayload } from "jsonwebtoken";

import Incident from "../database/models/Incident";
import EOC from "../database/models/Eoc";

/* ============================================
 CUSTOM SOCKET TYPE
============================================ */

interface AlertWebSocket extends WebSocket {
  eocId?: string;
  role?: string;
  userId?: string;
  isAuthenticated: boolean;
}

/* ============================================
 CLIENT REGISTRY
============================================ */

const connectedClients = new Set<AlertWebSocket>();
const eocRooms = new Map<string, Set<AlertWebSocket>>(); // Room support

/* ============================================
 WEBSOCKET SERVER
============================================ */

export const alertWSS = new WebSocketServer({ noServer: true });

console.log("🚨 Alert WebSocket Server initialized (PHEOC realtime engine)");

/* ============================================
 AUTH FUNCTION (Reuses your existing auth logic)
============================================ */

function authenticateWebSocket(req: IncomingMessage): {
  userId?: string;
  isAuthenticated: boolean;
} {
  // Extract token from multiple possible locations
  let token: string | undefined;

  // 1. Check Authorization header (primary method)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.replace("Bearer ", "");
  }

  // 2. Check URL query params (fallback for WebSocket connections)
  if (!token && req.url) {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      token = parsedUrl.searchParams.get("token") || undefined;
    } catch (err) {
      // Invalid URL
    }
  }

  if (!token) {
    return { isAuthenticated: false };
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    return {
      userId: user.id || user.userId,
      isAuthenticated: true,
    };
  } catch (error) {
    console.error("❌ WebSocket JWT verification failed:", error);
    return { isAuthenticated: false };
  }
}

/* ============================================
 CONNECTION HANDLER (with auth integration)
============================================ */

alertWSS.on("connection", (ws: AlertWebSocket, req: IncomingMessage) => {
  console.log("🔗 New WebSocket connection attempt:", req.url);

  // Authenticate the connection FIRST
  const auth = authenticateWebSocket(req);
  ws.isAuthenticated = auth.isAuthenticated;
  ws.userId = auth.userId;

  // Reject unauthenticated connections
  if (!ws.isAuthenticated) {
    console.log("🔒 Rejecting unauthenticated WebSocket connection");
    ws.send(
      JSON.stringify({
        type: "ERROR",
        error: "Authentication required",
        code: "UNAUTHORIZED",
      }),
    );
    ws.close(1008, "Unauthorized");
    return;
  }

  console.log(`✅ Authenticated WebSocket client: userId=${ws.userId}`);

  // Parse URL parameters for additional context (optional, after auth)
  try {
    const parsedUrl = new URL(req.url!, `http://${req.headers.host}`);
    const eocId = parsedUrl.searchParams.get("eocId");
    const role = parsedUrl.searchParams.get("role");

    ws.eocId = eocId || undefined;
    ws.role = role || undefined;

    // Join EOC-specific room if eocId provided
    if (eocId) {
      if (!eocRooms.has(eocId)) {
        eocRooms.set(eocId, new Set());
      }
      eocRooms.get(eocId)!.add(ws);
      console.log(`📌 Client joined EOC room: ${eocId}`);
    }
  } catch (err) {
    console.error("❌ Invalid URL params:", err);
  }

  // Add to connected clients
  connectedClients.add(ws);

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "SYSTEM",
      message: "Connected to PHEOC Alert Stream",
      authenticated: true,
      userId: ws.userId,
      timestamp: new Date().toISOString(),
    }),
  );

  /* ============================================
   HEARTBEAT/PING-PONG MECHANISM
  ============================================ */
  let isAlive = true;

  ws.on("pong", () => {
    isAlive = true;
  });

  const heartbeatInterval = setInterval(() => {
    if (!isAlive) {
      console.log("💀 WebSocket client died, terminating connection");
      ws.terminate();
      return;
    }

    isAlive = false;
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000); // Check every 30 seconds

  /* ============================================
   MESSAGE HANDLER
  ============================================ */
  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());

      // Validate message structure
      if (!message.type) {
        send(ws, { error: "Missing message type" });
        return;
      }

      await handleAlertMessage(ws, message);
    } catch (err) {
      console.error("❌ Invalid alert message:", err);
      send(ws, { error: "Invalid message format" });
    }
  });

  /* ============================================
   CLEANUP ON CLOSE
  ============================================ */
  ws.on("close", () => {
    console.log(`❌ Alert client disconnected: userId=${ws.userId}`);
    clearInterval(heartbeatInterval);
    connectedClients.delete(ws);

    // Remove from all EOC rooms
    eocRooms.forEach((clients, eocId) => {
      if (clients.has(ws)) {
        clients.delete(ws);
        console.log(`📌 Client left EOC room: ${eocId}`);
      }
    });
  });

  ws.on("error", (err) => {
    console.error(`❌ Alert socket error for userId=${ws.userId}:`, err);
    clearInterval(heartbeatInterval);
    connectedClients.delete(ws);
  });
});

/* ============================================
 MESSAGE HANDLER (with auth checks)
============================================ */

async function handleAlertMessage(ws: AlertWebSocket, message: any) {
  const { type, payload } = message;

  // Ensure authentication for all message types
  if (!ws.isAuthenticated) {
    return send(ws, { error: "Authentication required" });
  }

  switch (type) {
    /* ============================================
     NEW INCIDENT ALERT
    ============================================ */
    case "NEW_INCIDENT_ALERT": {
      // Optional: Check if user has permission to create alerts
      if (ws.role !== "admin" && ws.role !== "dispatcher") {
        return send(ws, { error: "Insufficient permissions" });
      }

      const incident = await Incident.findById(payload.incidentId)
        .populate("eocId")
        .lean();

      if (!incident) {
        return send(ws, { error: "Incident not found" });
      }

      // Broadcast to specific EOC or all based on incident
      if (incident.eocId) {
        broadcastToEOC(incident.eocId.toString(), {
          type: "INCIDENT_ALERT",
          data: incident,
          source: ws.userId,
          timestamp: new Date().toISOString(),
        });
      } else {
        broadcast({
          type: "INCIDENT_ALERT",
          data: incident,
          source: ws.userId,
          timestamp: new Date().toISOString(),
        });
      }
      break;
    }

    /* ============================================
     INCIDENT STATUS UPDATE
    ============================================ */
    case "INCIDENT_UPDATE": {
      const incident = await Incident.findById(payload.incidentId).lean();

      if (!incident) {
        return send(ws, { error: "Incident not found" });
      }

      broadcastToEOC(incident.eocId?.toString() || "", {
        type: "INCIDENT_UPDATE",
        data: incident,
        updatedBy: ws.userId,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    /* ============================================
     EOC ESCALATION ALERT
    ============================================ */
    case "EOC_ESCALATION": {
      const eoc = await EOC.findById(payload.eocId).lean();

      if (!eoc) {
        return send(ws, { error: "EOC not found" });
      }

      // Only broadcast to that specific EOC's room
      broadcastToEOC(payload.eocId, {
        type: "EOC_ESCALATED",
        data: eoc,
        escalatedBy: ws.userId,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    /* ============================================
     SUBSCRIBE TO EOC ROOM
    ============================================ */
    case "SUBSCRIBE_EOC": {
      const { eocId } = payload;
      if (!eocId) {
        return send(ws, { error: "EOC ID required" });
      }

      if (!eocRooms.has(eocId)) {
        eocRooms.set(eocId, new Set());
      }
      eocRooms.get(eocId)!.add(ws);
      ws.eocId = eocId;

      send(ws, {
        type: "SUBSCRIBED",
        eocId,
        message: `Subscribed to EOC ${eocId} alerts`,
      });
      break;
    }

    /* ============================================
     GIS TRIGGER ALERT
    ============================================ */
    case "GEO_ALERT": {
      // Geo alerts might be broadcast to all users with GIS permissions
      broadcast({
        type: "GEO_ALERT",
        data: {
          lat: payload.lat,
          lng: payload.lng,
          radiusKm: payload.radiusKm,
          severity: payload.severity || "HIGH",
          triggeredBy: ws.userId,
          timestamp: new Date().toISOString(),
        },
      });
      break;
    }

    /* ============================================
     HEARTBEAT (Client -> Server)
    ============================================ */
    case "PONG":
      // Already handled by server pings, but client can also initiate
      break;

    default:
      send(ws, { error: "Unknown alert type", type: type });
  }
}

/* ============================================
 BROADCAST TO SPECIFIC EOC ROOM
============================================ */

function broadcastToEOC(eocId: string, message: any) {
  const payload = JSON.stringify(message);
  const room = eocRooms.get(eocId);

  if (!room) {
    console.log(`📡 No clients in EOC room: ${eocId}`);
    return;
  }

  let sentCount = 0;
  room.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sentCount++;
    }
  });

  console.log(
    `📡 Broadcasted to EOC ${eocId}: ${message.type} (${sentCount} clients)`,
  );
}

/* ============================================
 BROADCAST TO ALL (with rate limiting)
============================================ */

let messageQueue: any[] = [];
let isProcessing = false;

function broadcast(message: any) {
  messageQueue.push(message);

  if (!isProcessing) {
    processBroadcastQueue();
  }
}

async function processBroadcastQueue() {
  isProcessing = true;

  while (messageQueue.length > 0) {
    const message = messageQueue.shift();
    const payload = JSON.stringify(message);

    const broadcastPromises = Array.from(connectedClients).map(
      async (client) => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(payload);
          } catch (err) {
            console.error("Failed to send to client:", err);
          }
        }
      },
    );

    await Promise.allSettled(broadcastPromises);
    console.log(
      `📡 Broadcasted to ${connectedClients.size} clients:`,
      message.type,
    );

    // Small delay to prevent overwhelming the event loop
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  isProcessing = false;
}

/* ============================================
 SEND SINGLE CLIENT
============================================ */

function send(ws: WebSocket, message: any) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/* ============================================
 HEALTH CHECK & METRICS
============================================ */

export function getWebSocketMetrics() {
  return {
    activeConnections: connectedClients.size,
    authenticatedConnections: Array.from(connectedClients).filter(
      (c) => c.isAuthenticated,
    ).length,
    activeRooms: eocRooms.size,
    totalRoomSubscriptions: Array.from(eocRooms.values()).reduce(
      (sum, set) => sum + set.size,
      0,
    ),
    queueLength: messageQueue.length,
    timestamp: new Date().toISOString(),
  };
}

/* ============================================
 GRACEFUL SHUTDOWN
============================================ */

export async function closeWebSocketServer() {
  console.log("🛑 Closing WebSocket server...");

  // Close all active connections
  const closePromises = Array.from(connectedClients).map(async (client) => {
    return new Promise<void>((resolve) => {
      client.close(1000, "Server shutting down");
      client.on("close", () => resolve());
      setTimeout(resolve, 5000); // Force resolve after 5 seconds
    });
  });

  await Promise.allSettled(closePromises);

  // Close the server
  return new Promise<void>((resolve, reject) => {
    alertWSS.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Connection limit (Quick Win)
const MAX_CONNECTIONS = 1000;
alertWSS.on("connection", (ws, req) => {
  if (connectedClients.size >= MAX_CONNECTIONS) {
    console.log("⚠️ Max connections reached, rejecting new client");
    ws.close(1013, "Too many connections");
    return;
  }
  // ... rest of connection handler
});
