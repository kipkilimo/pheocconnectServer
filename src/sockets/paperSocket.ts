import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { URL } from "url";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Paper, {
  IPaperRegistration,
  IPaperAnnotation,
  IPaperReaction,
  PaperRegistrationStatusEnum,
} from "../models/Paper";
import User from "../models/User";

// ============================================
// TYPES
// ============================================

interface CustomWebSocket extends WebSocket {
  paperId?: string;
  userId?: string;
  user?: any;
  registration?: any;
  isAlive: boolean;
}

interface WSMessage {
  title: string;
  type: string;
  annotationId?: string;
  page?: number;
  rect?: any;
  text?: string;
  reactionType?: string;
  currentPage?: number;
}

// ============================================
// IN-MEMORY STORES
// ============================================

// Connected clients per paper
const paperClients = new Map<string, Set<CustomWebSocket>>();

// Session store
const paperSessions = new Map<
  string,
  {
    isActive: boolean;
    controllerId: string;
    currentPage: number;
    participants: Set<string>;
  }
>();

// ============================================
// WS SERVER
// ============================================

export const paperWSS = new WebSocketServer({ noServer: true });
console.log("✅ Paper WebSocket Server initialized");

paperWSS.on("connection", (ws: CustomWebSocket, req: IncomingMessage) => {
  ws.isAlive = true;

  try {
    const parsedUrl = new URL(req.url!, `http://${req.headers.host}`);
    const token = parsedUrl.searchParams.get("token");
    const paperId = parsedUrl.searchParams.get("paperId");

    if (!token || !paperId) {
      ws.close(1008, "Missing token or paperId");
      return;
    }

    authenticateWebSocketUser(token, paperId)
      .then(async ({ user, registration, paper }) => {
        if (!user || !registration) {
          ws.close(1008, "Authentication failed");
          return;
        }

        ws.userId = user.id.toString();
        ws.user = user;
        ws.registration = registration;
        ws.paperId = paperId;

        // Check if user is approved (registration status must be APPROVED)
        const isApproved = registration.status === "APPROVED";
        const isCreator = paper.createdBy.toString() === ws.userId;

        // Only allow approved users or the creator
        if (!isApproved && !isCreator) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "You are not approved to join this session",
              code: "NOT_APPROVED",
            }),
          );
          ws.close(1008, "Not approved");
          return;
        }

        // Check if token is still valid (not expired)
        const isTokenValid = await validateTokenExpiration(registration, token);
        if (!isTokenValid && !isCreator) {
          ws.send(
            JSON.stringify({
              type: "error",
              message:
                "Your session token has expired. Please renew your access.",
              code: "TOKEN_EXPIRED",
              requiresRenewal: true,
            }),
          );
          ws.close(1008, "Token expired");
          return;
        }

        // Add to connected clients
        if (!paperClients.has(paperId)) {
          paperClients.set(paperId, new Set());
        }
        paperClients.get(paperId)!.add(ws);

        // Send initial annotations
        await sendAnnotations(ws, paperId);

        // Broadcast user joined
        broadcastToPaper(
          paperId,
          {
            type: "user_joined",
            userId: ws.userId,
            userName: user.personalInfo?.fullName || registration.name,
            emailAddress: registration.emailAddress,
            registrationId: registration.id,
            timestamp: new Date().toISOString(),
          },
          ws,
        );

        // If session is active, send current state
        const session = paperSessions.get(paperId);
        if (session && session.isActive) {
          ws.send(
            JSON.stringify({
              type: "session_state",
              currentPage: session.currentPage,
              controllerId: session.controllerId,
              isActive: session.isActive,
              participantCount: session.participants.size,
            }),
          );
        }
      })
      .catch((err) => {
        console.error("WebSocket authentication error:", err);
        ws.close(1011, "Authentication error");
      });
  } catch (err) {
    console.error("WebSocket connection error:", err);
    ws.close(1011, "Connection error");
  }

  ws.on("message", async (data: Buffer) => {
    try {
      const message: WSMessage = JSON.parse(data.toString());
      await handleMessage(ws, message);
    } catch (err) {
      console.error("WS parse error:", err);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
        }),
      );
    }
  });

  ws.on("pong", () => (ws.isAlive = true));

  ws.on("close", () => {
    if (ws.paperId && paperClients.has(ws.paperId)) {
      paperClients.get(ws.paperId)!.delete(ws);

      broadcastToPaper(ws.paperId, {
        type: "user_left",
        userId: ws.userId,
        userName: ws.user?.personalInfo?.fullName || ws.registration?.name,
        timestamp: new Date().toISOString(),
      });

      if (paperClients.get(ws.paperId)!.size === 0) {
        paperClients.delete(ws.paperId);
      }
    }

    // Remove from session participants
    if (ws.paperId && paperSessions.has(ws.paperId)) {
      const session = paperSessions.get(ws.paperId)!;
      session.participants.delete(ws.userId!);
    }
  });
});

// ============================================
// HEARTBEAT
// ============================================

setInterval(() => {
  paperWSS.clients.forEach((ws: WebSocket) => {
    const c = ws as CustomWebSocket;

    if (!c.isAlive) {
      return c.terminate();
    }

    c.isAlive = false;
    c.ping();
  });
}, 30000);

// ============================================
// AUTHENTICATION HELPERS
// ============================================

async function authenticateWebSocketUser(token: string, paperId: string) {
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as {
      sessionId: string;
      registrationId: string;
      emailAddress: string;
      paperId?: string;
    };

    // Find the paper
    const paper = await Paper.findById(paperId);
    if (!paper) {
      throw new Error("Paper not found");
    }

    // Find registration by ID or emailAddress
    const registration = paper.registrations?.find(
      (r: IPaperRegistration) =>
        r.id === decoded.registrationId ||
        r.emailAddress === decoded.emailAddress,
    );

    if (!registration) {
      throw new Error("Registration not found");
    }

    // Verify that the token matches the last issued token
    if (registration.lastToken && registration.lastToken !== token) {
      throw new Error("Token mismatch - please renew your session");
    }

    // Find the user if they have an account
    // User model uses personalInfo.email (lowercase) or email field
    const user = await User.findOne({
      $or: [
        { "personalInfo.email": registration.emailAddress.toLowerCase() },
        { email: registration.emailAddress.toLowerCase() },
      ],
    });

    if (!user) {
      // Create a temporary user object for email-only registrations
      return {
        user: {
          id: registration.id,
          emailAddress: registration.emailAddress,
          personalInfo: {
            fullName: registration.name,
            email: registration.emailAddress,
          },
        },
        registration,
        paper,
      };
    }

    return { user, registration, paper };
  } catch (err) {
    console.error("Authentication error:", err);
    throw err;
  }
}

async function validateTokenExpiration(
  registration: any,
  token: string,
): Promise<boolean> {
  try {
    // Verify JWT expiration
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as {
      exp: number;
    };

    const currentTime = Math.floor(Date.now() / 1000);
    const isValid = decoded.exp > currentTime;

    // Also check if token was issued within reasonable timeframe (3 hours)
    if (registration.lastTokenIssuedAt && isValid) {
      const tokenAge =
        Date.now() - new Date(registration.lastTokenIssuedAt).getTime();
      const maxAge = 3 * 60 * 60 * 1000; // 3 hours
      return tokenAge <= maxAge;
    }

    return isValid;
  } catch (err) {
    return false;
  }
}

async function sendAnnotations(ws: CustomWebSocket, paperId: string) {
  const paper = await Paper.findById(paperId);
  if (!paper) return;

  const annotations = paper.annotations || [];

  ws.send(
    JSON.stringify({
      type: "annotations_init",
      data: annotations.map((a: IPaperAnnotation) => ({
        id: a.id,
        page: a.page,
        rect: a.rect,
        title: a.title,
        text: a.text,
        author: a.author,
        reactions: a.reactions,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    }),
  );
}

function broadcastToPaper(
  paperId: string,
  message: any,
  exclude?: CustomWebSocket,
) {
  const clients = paperClients.get(paperId);
  if (!clients) return;

  const data = JSON.stringify(message);

  clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN && c !== exclude) {
      c.send(data);
    }
  });
}

// ============================================
// TOKEN RENEWAL MUTATION (for GraphQL)
// ============================================

export async function renewWebSocketToken(
  registrationId: string,
  paperId: string,
) {
  const paper = await Paper.findById(paperId);
  if (!paper) throw new Error("Paper not found");

  const registration = paper.registrations?.find(
    (r: IPaperRegistration) => r.id === registrationId,
  );
  if (!registration) throw new Error("Registration not found");

  if (registration.status !== PaperRegistrationStatusEnum.APPROVED) {
    throw new Error("Only approved registrations can renew tokens");
  }

  // Generate new token
  const newToken = jwt.sign(
    {
      sessionId: paper.sessionId,
      registrationId: registration.id,
      emailAddress: registration.emailAddress,
      paperId: paper.id,
    },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "3h" },
  );

  // Update registration with new token info
  registration.lastTokenIssuedAt = new Date();
  registration.lastToken = newToken;
  paper.updatedAt = new Date().toISOString();
  await paper.save();

  return {
    success: true,
    token: newToken,
    expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
  };
}

// ============================================
// MESSAGE ROUTER
// ============================================

async function handleMessage(ws: CustomWebSocket, msg: WSMessage) {
  switch (msg.type) {
    case "renew_token":
      return handleRenewToken(ws);
    case "create_annotation":
      return handleCreateAnnotation(ws, msg);
    case "update_annotation":
      return handleUpdateAnnotation(ws, msg);
    case "delete_annotation":
      return handleDeleteAnnotation(ws, msg);
    case "add_reaction":
      return handleAddReaction(ws, msg);
    case "remove_reaction":
      return handleRemoveReaction(ws, msg);
    case "start_session":
      return handleStartSession(ws, msg);
    case "end_session":
      return handleEndSession(ws);
    case "navigate":
      return handleNavigate(ws, msg);
    case "join_session":
      return handleJoinSession(ws);
    case "leave_session":
      return handleLeaveSession(ws);
    case "get_participants":
      return handleGetParticipants(ws);
    default:
      ws.send(
        JSON.stringify({
          type: "error",
          message: `Unknown message type: ${msg.type}`,
        }),
      );
  }
}

// ============================================
// TOKEN RENEWAL HANDLER
// ============================================

async function handleRenewToken(ws: CustomWebSocket) {
  if (!ws.registration || !ws.paperId) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Cannot renew token: missing registration info",
      }),
    );
    return;
  }

  try {
    const result = await renewWebSocketToken(ws.registration.id, ws.paperId);

    ws.send(
      JSON.stringify({
        type: "token_renewed",
        token: result.token,
        expiresAt: result.expiresAt,
      }),
    );

    // Update the connection's stored token
    ws.registration.lastToken = result.token;
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Failed to renew token",
      }),
    );
  }
}

// ============================================
// ANNOTATIONS (using embedded Paper model)
// ============================================

async function handleCreateAnnotation(ws: CustomWebSocket, msg: WSMessage) {
  if (!msg.page || !msg.rect || !msg.text) return;

  const paper = await Paper.findById(ws.paperId);
  if (!paper) return;

  // Ensure userId exists
  if (!ws.userId) {
    ws.send(JSON.stringify({ type: "error", message: "User ID not found" }));
    return;
  }

  const newAnnotation: IPaperAnnotation = {
    id: new mongoose.Types.ObjectId().toString(),
    page: msg.page,
    rect: msg.rect,
    title: msg.title || "PaperAnnotation",
    text: msg.text,
    author: {
      id: ws.userId,
      name:
        ws.user?.personalInfo?.fullName || ws.registration?.name || "Anonymous",
      emailAddress: ws.registration?.emailAddress || "",
    },
    reactions: [],
    createdAt: new Date().toISOString(),
  };

  paper.annotations.push(newAnnotation);
  paper.annotationCount = paper.annotations.length;
  paper.updatedAt = new Date().toISOString();
  await paper.save();

  broadcastToPaper(ws.paperId!, {
    type: "annotation_created",
    annotation: newAnnotation,
  });
}

async function handleUpdateAnnotation(ws: CustomWebSocket, msg: WSMessage) {
  const paper = await Paper.findById(ws.paperId);
  if (!paper) return;

  const annotation = paper.annotations.find(
    (a: IPaperAnnotation) => a.id === msg.annotationId,
  );
  if (!annotation || annotation.author.id !== ws.userId) return;

  annotation.text = msg.text!;
  annotation.updatedAt = new Date().toISOString();
  paper.updatedAt = new Date().toISOString();
  await paper.save();

  broadcastToPaper(ws.paperId!, {
    type: "annotation_updated",
    annotationId: annotation.id,
    text: annotation.text,
    updatedAt: annotation.updatedAt,
  });
}

async function handleDeleteAnnotation(ws: CustomWebSocket, msg: WSMessage) {
  const paper = await Paper.findById(ws.paperId);
  if (!paper) return;

  const annotationIndex = paper.annotations.findIndex(
    (a: IPaperAnnotation) => a.id === msg.annotationId,
  );

  if (annotationIndex === -1) return;

  const annotation = paper.annotations[annotationIndex];
  if (annotation.author.id !== ws.userId) return;

  paper.annotations.splice(annotationIndex, 1);
  paper.annotationCount = paper.annotations.length;
  paper.updatedAt = new Date().toISOString();
  await paper.save();

  broadcastToPaper(ws.paperId!, {
    type: "annotation_deleted",
    annotationId: msg.annotationId,
  });
}

// ============================================
// REACTIONS
// ============================================

async function handleAddReaction(ws: CustomWebSocket, msg: WSMessage) {
  const paper = await Paper.findById(ws.paperId);
  if (!paper) return;

  const annotation = paper.annotations.find(
    (a: IPaperAnnotation) => a.id === msg.annotationId,
  );
  if (!annotation) return;

  if (!ws.userId) {
    ws.send(JSON.stringify({ type: "error", message: "User ID not found" }));
    return;
  }

  const reaction: IPaperReaction = {
    id: new mongoose.Types.ObjectId().toString(),
    type: msg.reactionType!,
    author: {
      id: ws.userId,
      name:
        ws.user?.personalInfo?.fullName || ws.registration?.name || "Anonymous",
      emailAddress: ws.registration?.emailAddress || "",
    },
    createdAt: new Date().toISOString(),
  };

  annotation.reactions.push(reaction);
  paper.updatedAt = new Date().toISOString();
  await paper.save();

  broadcastToPaper(ws.paperId!, {
    type: "reaction_added",
    annotationId: annotation.id,
    reaction: reaction,
  });
}

async function handleRemoveReaction(ws: CustomWebSocket, msg: WSMessage) {
  const paper = await Paper.findById(ws.paperId);
  if (!paper) return;

  const annotation = paper.annotations.find(
    (a: IPaperAnnotation) => a.id === msg.annotationId,
  );
  if (!annotation) return;

  annotation.reactions = annotation.reactions.filter(
    (r: IPaperReaction) =>
      !(r.author.id === ws.userId && r.type === msg.reactionType),
  );

  paper.updatedAt = new Date().toISOString();
  await paper.save();

  broadcastToPaper(ws.paperId!, {
    type: "reaction_removed",
    annotationId: annotation.id,
    userId: ws.userId,
    reactionType: msg.reactionType,
  });
}

// ============================================
// SESSION MANAGEMENT
// ============================================

async function handleStartSession(ws: CustomWebSocket, msg: WSMessage) {
  const paper = await Paper.findById(ws.paperId);

  // Check if user is the creator
  if (!paper || paper.createdBy.toString() !== ws.userId) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Only the paper creator can start the session",
      }),
    );
    return;
  }

  // Update paper in database
  paper.isSessionOpen = true;
  paper.updatedAt = new Date().toISOString();
  await paper.save();

  // Store in memory for fast access
  paperSessions.set(ws.paperId!, {
    isActive: true,
    controllerId: ws.userId!,
    currentPage: msg.currentPage || 1,
    participants: new Set([ws.userId!]),
  });

  // Get approved participants count
  const approvedCount = paper.registrations?.filter(
    (r: IPaperRegistration) => r.status === "APPROVED",
  ).length;

  broadcastToPaper(ws.paperId!, {
    type: "session_started",
    currentPage: msg.currentPage || 1,
    controllerId: ws.userId,
    controllerName: ws.user?.personalInfo?.fullName || ws.registration?.name,
    participantCount: approvedCount,
    timestamp: new Date().toISOString(),
  });
}

async function handleEndSession(ws: CustomWebSocket) {
  const paper = await Paper.findById(ws.paperId);

  // Check if user is the creator
  if (!paper || paper.createdBy.toString() !== ws.userId) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Only the paper creator can end the session",
      }),
    );
    return;
  }

  // Update paper in database
  paper.isSessionOpen = false;
  paper.updatedAt = new Date().toISOString();
  await paper.save();

  // Remove from memory
  paperSessions.delete(ws.paperId!);

  broadcastToPaper(ws.paperId!, {
    type: "session_ended",
    timestamp: new Date().toISOString(),
  });
}

async function handleNavigate(ws: CustomWebSocket, msg: WSMessage) {
  const session = paperSessions.get(ws.paperId!);

  // Only controller can navigate
  if (!session || session.controllerId !== ws.userId) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Only the session controller can navigate",
      }),
    );
    return;
  }

  session.currentPage = msg.page!;

  broadcastToPaper(ws.paperId!, {
    type: "navigation",
    page: msg.page,
    controllerId: ws.userId,
    timestamp: new Date().toISOString(),
  });
}

async function handleJoinSession(ws: CustomWebSocket) {
  const session = paperSessions.get(ws.paperId!);
  if (!session) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Session is not active",
      }),
    );
    return;
  }

  // Check if user is approved in the paper
  const paper = await Paper.findById(ws.paperId);
  const registration = paper?.registrations?.find(
    (r: IPaperRegistration) =>
      r.emailAddress === ws.registration?.emailAddress ||
      r.userId === ws.userId,
  );

  const isApproved = registration?.status === "APPROVED";
  const isCreator = paper?.createdBy.toString() === ws.userId;

  if (!isApproved && !isCreator) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "You are not approved to join this session",
      }),
    );
    return;
  }

  session.participants.add(ws.userId!);

  ws.send(
    JSON.stringify({
      type: "session_state",
      currentPage: session.currentPage,
      controllerId: session.controllerId,
      isActive: session.isActive,
      participantCount: session.participants.size,
    }),
  );

  broadcastToPaper(ws.paperId!, {
    type: "participant_joined",
    userId: ws.userId,
    userName: ws.user?.personalInfo?.fullName || ws.registration?.name,
    emailAddress: ws.registration?.emailAddress,
    timestamp: new Date().toISOString(),
  });
}

async function handleLeaveSession(ws: CustomWebSocket) {
  const session = paperSessions.get(ws.paperId!);
  if (!session) return;

  session.participants.delete(ws.userId!);

  broadcastToPaper(ws.paperId!, {
    type: "participant_left",
    userId: ws.userId,
    userName: ws.user?.personalInfo?.fullName || ws.registration?.name,
    timestamp: new Date().toISOString(),
  });
}

async function handleGetParticipants(ws: CustomWebSocket) {
  const session = paperSessions.get(ws.paperId!);
  if (!session) {
    ws.send(
      JSON.stringify({
        type: "participants_list",
        participants: [],
        controllerId: null,
      }),
    );
    return;
  }

  // Get detailed participant info from database
  const paper = await Paper.findById(ws.paperId);
  const approvedRegistrations =
    paper?.registrations?.filter(
      (r: IPaperRegistration) => r.status === "APPROVED",
    ) || [];

  const participants = Array.from(session.participants).map((userId) => {
    const reg = approvedRegistrations.find((r) => r.userId === userId);
    return {
      id: userId,
      name: reg?.name || "Anonymous",
      emailAddress: reg?.emailAddress || "",
    };
  });

  ws.send(
    JSON.stringify({
      type: "participants_list",
      participants: participants,
      controllerId: session.controllerId,
      currentPage: session.currentPage,
      participantCount: session.participants.size,
    }),
  );
}
