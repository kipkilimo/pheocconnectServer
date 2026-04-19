import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { URL } from "url";

import Incident from "../database/models/Incident";
import EOC from "../database/models/Eoc";

/* ============================================
 CUSTOM SOCKET TYPE
============================================ */

interface AlertWebSocket extends WebSocket {
  eocId?: string;
  role?: string;
}

/* ============================================
 CLIENT REGISTRY
============================================ */

const connectedClients = new Set<AlertWebSocket>();

/* ============================================
 WEBSOCKET SERVER
============================================ */

export const alertWSS = new WebSocketServer({ noServer: true });

console.log("🚨 Alert WebSocket Server initialized (PHEOC realtime engine)");

/* ============================================
 CONNECTION HANDLER
============================================ */

alertWSS.on("connection", (ws: AlertWebSocket, req: IncomingMessage) => {
  console.log("🔗 Alert client connected:", req.url);

  connectedClients.add(ws);

  ws.send(
    JSON.stringify({
      type: "SYSTEM",
      message: "Connected to PHEOC Alert Stream",
    }),
  );

  try {
    const parsedUrl = new URL(req.url!, `http://${req.headers.host}`);

    const eocId = parsedUrl.searchParams.get("eocId");
    const role = parsedUrl.searchParams.get("role");

    ws.eocId = eocId || undefined;
    ws.role = role || undefined;

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleAlertMessage(ws, message);
      } catch (err) {
        console.error("❌ Invalid alert message:", err);
        send(ws, { error: "Invalid message format" });
      }
    });

    ws.on("close", () => {
      console.log("❌ Alert client disconnected");
      connectedClients.delete(ws);
    });

    ws.on("error", (err) => {
      console.error("❌ Alert socket error:", err);
      connectedClients.delete(ws);
    });
  } catch (err) {
    console.error("❌ Invalid WS URL:", err);
    ws.close();
  }
});

/* ============================================
 MESSAGE HANDLER
============================================ */

async function handleAlertMessage(ws: AlertWebSocket, message: any) {
  const { type, payload } = message;

  switch (type) {
    /* ============================================
     NEW INCIDENT ALERT (CORE PHEOC FLOW)
    ============================================ */

    case "NEW_INCIDENT_ALERT": {
      const incident = await Incident.findById(payload.incidentId)
        .populate("eocId")
        .lean();

      if (!incident) {
        return send(ws, { error: "Incident not found" });
      }

      broadcast({
        type: "INCIDENT_ALERT",
        data: incident,
      });

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

      broadcast({
        type: "INCIDENT_UPDATE",
        data: incident,
      });

      break;
    }

    /* ============================================
     EOC ESCALATION ALERT (CRITICAL PHEOC FUNCTION)
    ============================================ */

    case "EOC_ESCALATION": {
      const eoc = await EOC.findById(payload.eocId).lean();

      if (!eoc) {
        return send(ws, { error: "EOC not found" });
      }

      broadcast({
        type: "EOC_ESCALATED",
        data: eoc,
      });

      break;
    }

    /* ============================================
     GIS TRIGGER ALERT (FUTURE MAP INTEGRATION)
    ============================================ */

    case "GEO_ALERT": {
      broadcast({
        type: "GEO_ALERT",
        data: {
          lat: payload.lat,
          lng: payload.lng,
          radiusKm: payload.radiusKm,
          severity: payload.severity || "HIGH",
        },
      });

      break;
    }

    default:
      send(ws, { error: "Unknown alert type" });
  }
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
 BROADCAST (CORE REAL-TIME ENGINE)
============================================ */

function broadcast(message: any) {
  const payload = JSON.stringify(message);

  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });

  console.log("📡 Broadcasted alert:", message.type);
}
