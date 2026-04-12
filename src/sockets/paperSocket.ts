// websocket/paperSocket.ts
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { URL } from "url";
import mongoose from "mongoose";
import Paper from "../models/Paper";
import Annotation from "../models/Annotation";
import User from "../models/User";

interface CustomWebSocket extends WebSocket {
  paperId?: string;
  userId?: string;
  user?: any;
  isAlive: boolean;
}

interface WSMessage {
  type: string;
  annotationId?: string;
  annotation?: any;
  page?: number;
  rect?: any;
  text?: string;
  reactionType?: string;
  currentPage?: number;
}

// Track connected clients per paper
const paperClients = new Map<string, Set<CustomWebSocket>>();

export const paperWSS = new WebSocketServer({ noServer: true });
console.log("✅ Paper WebSocket Server initialized");

paperWSS.on("connection", (ws: CustomWebSocket, req: IncomingMessage) => {
  console.log("🔗 Client connected");
  ws.isAlive = true;

  // Parse URL for authentication
  try {
    const parsedUrl = new URL(req.url!, `http://${req.headers.host}`);
    const token = parsedUrl.searchParams.get("token");
    const paperId = parsedUrl.searchParams.get("paperId");

    if (!token || !paperId) {
      console.error("❌ Missing token or paperId");
      ws.close();
      return;
    }

    // Authenticate user
    authenticateUser(token)
      .then(async (user) => {
        if (!user) {
          ws.close();
          return;
        }

        ws.userId = user._id.toString();
        ws.user = user;
        ws.paperId = paperId;

        // Verify paper exists
        const paper = await Paper.findById(paperId);
        if (!paper) {
          ws.close();
          return;
        }

        // Add to paper clients
        if (!paperClients.has(paperId)) {
          paperClients.set(paperId, new Set());
        }
        paperClients.get(paperId)!.add(ws);

        // Send current annotations
        await sendAnnotations(ws, paperId);

        // Notify others
        broadcastToPaper(
          paperId,
          {
            type: "user_joined",
            userId: ws.userId,
            timestamp: new Date().toISOString(),
          },
          ws,
        );

        console.log(`✅ User ${ws.userId} joined paper ${paperId}`);
      })
      .catch((err) => {
        console.error("❌ Authentication error:", err);
        ws.close();
      });
  } catch (err) {
    console.error("❌ Error parsing URL:", err);
    ws.close();
  }

  // Handle incoming messages
  ws.on("message", async (data: Buffer) => {
    try {
      const message: WSMessage = JSON.parse(data.toString());
      await handleMessage(ws, message);
    } catch (err) {
      console.error("❌ Error parsing message:", err);
    }
  });

  // Handle pong for heartbeat
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  // Handle close
  ws.on("close", () => {
    console.log(`❌ Client disconnected: ${ws.userId}`);
    if (ws.paperId && paperClients.has(ws.paperId)) {
      paperClients.get(ws.paperId)!.delete(ws);

      // Notify others
      broadcastToPaper(ws.paperId, {
        type: "user_left",
        userId: ws.userId,
        timestamp: new Date().toISOString(),
      });

      // Clean up empty paper sets
      if (paperClients.get(ws.paperId)!.size === 0) {
        paperClients.delete(ws.paperId);
      }
    }
  });
});

// Heartbeat interval
setInterval(() => {
  paperWSS.clients.forEach((ws: WebSocket) => {
    const customWs = ws as CustomWebSocket;
    if (customWs.isAlive === false) {
      if (customWs.paperId && paperClients.has(customWs.paperId)) {
        const clients = paperClients.get(customWs.paperId);
        if (clients) {
          clients.delete(customWs);
          if (clients.size === 0) {
            paperClients.delete(customWs.paperId);
          }
        }
      }
      return customWs.terminate();
    }
    customWs.isAlive = false;
    customWs.ping();
  });
}, 30000);

// Helper: Authenticate user from token
async function authenticateUser(token: string) {
  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret");
    const user = await User.findById(decoded.userId);
    return user;
  } catch (error) {
    console.error("Auth error:", error);
    return null;
  }
}

// Helper: Send current annotations to a client
async function sendAnnotations(ws: CustomWebSocket, paperId: string) {
  try {
    const annotations = await Annotation.find({ paperId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    ws.send(
      JSON.stringify({
        type: "annotations_init",
        data: annotations.map((ann) => ({
          id: ann._id,
          page: ann.page,
          rect: ann.rect,
          text: ann.text,
          author: ann.author,
          createdAt: ann.createdAt,
        })),
      }),
    );
  } catch (error) {
    console.error("Error sending annotations:", error);
  }
}

// Helper: Broadcast to all clients in a paper
function broadcastToPaper(
  paperId: string,
  message: any,
  excludeWs?: CustomWebSocket,
) {
  const clients = paperClients.get(paperId);
  if (!clients) return;

  const data = JSON.stringify(message);
  clients.forEach((client: CustomWebSocket) => {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      client.send(data);
    }
  });
}

// Main message handler
async function handleMessage(ws: CustomWebSocket, message: WSMessage) {
  const { type } = message;

  switch (type) {
    case "create_annotation":
      await handleCreateAnnotation(ws, message);
      break;
    case "update_annotation":
      await handleUpdateAnnotation(ws, message);
      break;
    case "delete_annotation":
      await handleDeleteAnnotation(ws, message);
      break;
    case "add_reaction":
      await handleAddReaction(ws, message);
      break;
    case "remove_reaction":
      await handleRemoveReaction(ws, message);
      break;
    case "start_session":
      await handleStartSession(ws, message);
      break;
    case "end_session":
      await handleEndSession(ws, message);
      break;
    case "navigate":
      await handleNavigate(ws, message);
      break;
    case "join_session":
      await handleJoinSession(ws, message);
      break;
    case "leave_session":
      await handleLeaveSession(ws, message);
      break;
    case "ping":
      ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      break;
    default:
      console.log(`Unknown message type: ${type}`);
  }
}

// ============================================
// HANDLERS
// ============================================

async function handleCreateAnnotation(ws: CustomWebSocket, message: WSMessage) {
  try {
    const { page, rect, text } = message;

    if (!page || !rect || !text) {
      return;
    }

    const annotation = new Annotation({
      paperId: ws.paperId,
      page,
      rect,
      text,
      author: {
        id: ws.userId,
        name:
          ws.user?.personalInfo?.fullName || ws.user?.personalInfo?.username,
        email: ws.user?.personalInfo?.email,
      },
      reactions: [],
      createdAt: new Date().toISOString(),
    });

    await annotation.save();

    // Update paper annotation count
    await Paper.findByIdAndUpdate(ws.paperId, {
      $inc: { annotationCount: 1 },
    });

    // Broadcast to all clients
    broadcastToPaper(ws.paperId!, {
      type: "annotation_created",
      annotation: {
        id: annotation._id,
        page: annotation.page,
        rect: annotation.rect,
        text: annotation.text,
        author: annotation.author,
        createdAt: annotation.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating annotation:", error);
  }
}

async function handleUpdateAnnotation(ws: CustomWebSocket, message: WSMessage) {
  try {
    const { annotationId, text } = message;

    if (!annotationId || !text) return;

    const annotation = await Annotation.findById(annotationId);

    if (!annotation || annotation.author.id.toString() !== ws.userId) {
      return;
    }

    annotation.text = text;
    annotation.updatedAt = new Date().toISOString();
    await annotation.save();

    broadcastToPaper(ws.paperId!, {
      type: "annotation_updated",
      annotationId,
      text,
      updatedAt: annotation.updatedAt,
    });
  } catch (error) {
    console.error("Error updating annotation:", error);
  }
}

async function handleDeleteAnnotation(ws: CustomWebSocket, message: WSMessage) {
  try {
    const { annotationId } = message;

    if (!annotationId) return;

    const annotation = await Annotation.findById(annotationId);

    if (!annotation || annotation.author.id.toString() !== ws.userId) {
      return;
    }

    await annotation.deleteOne();

    // Update paper
    await Paper.findByIdAndUpdate(ws.paperId, {
      $inc: { annotationCount: -1 },
    });

    broadcastToPaper(ws.paperId!, {
      type: "annotation_deleted",
      annotationId,
    });
  } catch (error) {
    console.error("Error deleting annotation:", error);
  }
}

async function handleAddReaction(ws: CustomWebSocket, message: WSMessage) {
  try {
    const { annotationId, reactionType } = message;

    if (!annotationId || !reactionType) return;

    const annotation = await Annotation.findById(annotationId);
    if (!annotation) return;

    const newReaction = {
      type: reactionType,
      author: {
        id: ws.userId,
        name:
          ws.user?.personalInfo?.fullName || ws.user?.personalInfo?.username,
      },
      createdAt: new Date().toISOString(),
    };

    annotation.reactions.push(newReaction);
    await annotation.save();

    broadcastToPaper(ws.paperId!, {
      type: "reaction_added",
      annotationId,
      reaction: newReaction,
    });
  } catch (error) {
    console.error("Error adding reaction:", error);
  }
}

async function handleRemoveReaction(ws: CustomWebSocket, message: WSMessage) {
  try {
    const { annotationId, reactionType } = message;

    if (!annotationId || !reactionType) return;

    const annotation = await Annotation.findById(annotationId);
    if (!annotation) return;

    annotation.reactions = annotation.reactions.filter(
      (r: any) =>
        !(r.author.id.toString() === ws.userId && r.type === reactionType),
    );
    await annotation.save();

    broadcastToPaper(ws.paperId!, {
      type: "reaction_removed",
      annotationId,
      reactionType,
      userId: ws.userId,
    });
  } catch (error) {
    console.error("Error removing reaction:", error);
  }
}

async function handleStartSession(ws: CustomWebSocket, message: WSMessage) {
  try {
    const paper = await Paper.findById(ws.paperId);
    if (!paper) return;

    // Check if user is creator
    if (paper.createdBy.toString() !== ws.userId) return;

    paper.liveSession = {
      isActive: true,
      startedAt: new Date().toISOString(),
      controllerId: new mongoose.Types.ObjectId(ws.userId),
      currentPage: message.currentPage || 1,
      participants: [new mongoose.Types.ObjectId(ws.userId)],
    };

    await paper.save();

    broadcastToPaper(ws.paperId!, {
      type: "session_started",
      session: {
        isActive: true,
        currentPage: paper.liveSession.currentPage,
        controllerId: ws.userId,
      },
    });
  } catch (error) {
    console.error("Error starting session:", error);
  }
}

async function handleEndSession(ws: CustomWebSocket, message: WSMessage) {
  try {
    const paper = await Paper.findById(ws.paperId);
    if (!paper || !paper.liveSession?.isActive) return;

    if (
      paper.liveSession.controllerId?.toString() !== ws.userId &&
      paper.createdBy.toString() !== ws.userId
    ) {
      return;
    }

    paper.liveSession.isActive = false;
    paper.liveSession.endedAt = new Date().toISOString();
    await paper.save();

    broadcastToPaper(ws.paperId!, {
      type: "session_ended",
      endedBy: ws.userId,
    });
  } catch (error) {
    console.error("Error ending session:", error);
  }
}

async function handleNavigate(ws: CustomWebSocket, message: WSMessage) {
  try {
    const { page } = message;
    if (page === undefined) return;

    const paper = await Paper.findById(ws.paperId);
    if (!paper || !paper.liveSession?.isActive) return;

    if (paper.liveSession.controllerId?.toString() !== ws.userId) return;

    paper.liveSession.currentPage = page;
    await paper.save();

    broadcastToPaper(ws.paperId!, {
      type: "navigation",
      page,
      controllerId: ws.userId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error navigating:", error);
  }
}

async function handleJoinSession(ws: CustomWebSocket, message: WSMessage) {
  try {
    const paper = await Paper.findById(ws.paperId);
    if (!paper || !paper.liveSession?.isActive) return;

    if (
      !paper.liveSession.participants?.some(
        (p: any) => p.toString() === ws.userId,
      )
    ) {
      if (!paper.liveSession.participants) paper.liveSession.participants = [];
      paper.liveSession.participants.push(
        new mongoose.Types.ObjectId(ws.userId),
      );
      await paper.save();

      broadcastToPaper(ws.paperId!, {
        type: "participant_joined",
        userId: ws.userId,
        participantCount: paper.liveSession.participants.length,
      });
    }

    ws.send(
      JSON.stringify({
        type: "session_state",
        data: {
          currentPage: paper.liveSession.currentPage,
          controllerId: paper.liveSession.controllerId?.toString(),
        },
      }),
    );
  } catch (error) {
    console.error("Error joining session:", error);
  }
}

async function handleLeaveSession(ws: CustomWebSocket, message: WSMessage) {
  try {
    const paper = await Paper.findById(ws.paperId);
    if (!paper || !paper.liveSession?.participants) return;

    paper.liveSession.participants = paper.liveSession.participants.filter(
      (p: any) => p.toString() !== ws.userId,
    );
    await paper.save();

    broadcastToPaper(ws.paperId!, {
      type: "participant_left",
      userId: ws.userId,
      participantCount: paper.liveSession.participants.length,
    });
  } catch (error) {
    console.error("Error leaving session:", error);
  }
}
