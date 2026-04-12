import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { URL } from "url";
import Resource from "../models/Resource"; // Mongoose model
import { IResource } from "../models/Resource";

interface CustomWebSocket extends WebSocket {
  sessionId?: string;
  accessKey?: string;
}

// Track all connected clients
const connectedClients = new Set<CustomWebSocket>();

export const posterWSS = new WebSocketServer({ noServer: true });
console.log("✅ Poster WebSocket server initialized.");

posterWSS.on("connection", (ws: CustomWebSocket, req: IncomingMessage) => {
  console.log("🔗 Client connected:", req.url);
  ws.send(JSON.stringify({ message: "Connected to Poster WebSocket Server" }));

  // Add the new client to the connected clients set
  connectedClients.add(ws);

  try {
    const parsedUrl = new URL(req.url!, `http://${req.headers.host}`);
    const sessionId = parsedUrl.searchParams.get("sessionId");
    const accessKey = parsedUrl.searchParams.get("accessKey");

    if (!sessionId || !accessKey) {
      console.error("❌ Missing sessionId or accessKey");
      ws.send(JSON.stringify({ error: "Missing sessionId or accessKey" }));
      ws.close();
      return;
    }

    ws.sessionId = sessionId;
    ws.accessKey = accessKey;

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log("Received message:", message);
        await handlePosterSocket(ws, message);
      } catch (err) {
        console.error("❌ Error parsing message:", err);
        sendResponse(ws, null, "Invalid message format");
      }
    });

    ws.on("close", () => {
      console.log("❌ Client disconnected.");
      // Remove the client from the connected clients set
      connectedClients.delete(ws);
    });

    ws.on("error", (err) => {
      console.error("❌ WebSocket error:", err);
      // Remove the client from the connected clients set
      connectedClients.delete(ws);
    });
  } catch (err) {
    console.error("❌ Error parsing URL:", err);
    ws.close();
  }
});

// Helper function to send a reaction to a specific client
function sendResponse(
  ws: WebSocket,
  data: any | null,
  error: string | null = null
) {
  const reaction = JSON.stringify({ data, error });
  console.log("Sending reaction:", reaction);
  ws.send(reaction);
  console.log("Response sent.");
}

// Helper function to broadcast a message to all connected clients
function broadcastToAllClients(message: any) {
  const reaction = JSON.stringify(message);
  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(reaction);
    }
  });
  // console.log("Broadcasted message to all clients:", reaction);
}

async function handlePosterSocket(ws: CustomWebSocket, message: any) {
  try {
    const { type, posterId, timerDuration, reaction } = message;
    const { accessKey, sessionId } = ws;

    if (!accessKey || !sessionId) {
      sendResponse(ws, null, "Session data missing. Reconnect and try again.");
      return;
    }

    console.log(
      `Querying for resource with sessionId: ${sessionId}, accessKey: ${accessKey}`
    );

    const resource = await Resource.findOne({
      accessKey,
      sessionId,
    })
      .populate({
        path: "createdBy",
        model: "User",
        select: {
          id: 1,
          "personalInfo.username": 1,
          "personalInfo.fullName": 1,
          "personalInfo.email": 1,
          "personalInfo.scholarId": 1,
          "personalInfo.activationToken": 1,
          "personalInfo.resetToken": 1,
          "personalInfo.tokenExpiry": 1,
          "personalInfo.activatedAccount": 1,
          role: 1,
        },
      })
      .exec();

    if (!resource) {
      sendResponse(ws, null, "Resource not found.");
      return;
    }

    switch (type) {
      case "fetch_poster":
        console.log("Handling fetch_poster request");
        // Broadcast the resource to all connected clients
        broadcastToAllClients({
          action: "poster_data",
          data: resource,
        });
        break;
      case "start_timer":
        if (!posterId || !timerDuration) {
          sendResponse(ws, null, "Missing posterId or timerDuration.");
          return;
        }
        console.log("Handling start_timer request");
        // Broadcast the start_timer event to all connected clients
        broadcastToAllClients({
          action: "start_timer",
          data: {
            duration: 8 * 60, // Assuming resource contains the duration of the countdown
          },
        });
        break;
      case "submit_reaction":
        // Validate required fields
        if (!posterId || !reaction) {
          sendResponse(ws, null, "Missing posterId or reaction.");
          return;
        }
        console.log({ reaction });

        try {
          // Parse the stringified reaction data
          let parsedReaction;
          try {
            parsedReaction = JSON.parse(reaction);
          } catch (error) {
            console.error("Error parsing reaction:", error);
            sendResponse(
              ws,
              null,
              "Invalid reaction format: Expected a valid JSON string."
            );
            return;
          }

          // Ensure parsedReaction is an array (as per your reactionData format)
          if (!Array.isArray(parsedReaction)) {
            parsedReaction = [parsedReaction]; // Wrap it in an array if it's not already
          }

          // Extract the reaction object from the array
          const reactionObj = parsedReaction[0];

          // Parse the metaInfo object if it exists and is a string
          let metaInfo = resource.metaInfo;
          if (metaInfo && typeof metaInfo === "string") {
            try {
              metaInfo = JSON.parse(metaInfo);
            } catch (error) {
              console.error("Error parsing metaInfo:", error);
              sendResponse(
                ws,
                null,
                "Invalid metaInfo format: Expected a valid JSON string."
              );
              return;
            }
          }

          // Ensure metaInfo is an array and contains at least one item
          if (!Array.isArray(metaInfo) || metaInfo.length === 0) {
            throw new Error(
              "Invalid metaInfo format: Expected a non-empty array."
            );
          }

          // Parse the posterReactions if it exists and is a string
          let posterReactions = metaInfo[0].posterReactions;
          if (posterReactions && typeof posterReactions === "string") {
            try {
              posterReactions = JSON.parse(posterReactions);
            } catch (error) {
              console.error("Error parsing posterReactions:", error);
              sendResponse(
                ws,
                null,
                "Invalid posterReactions format: Expected a valid JSON string."
              );
              return;
            }
          }

          // Ensure posterReactions is an array
          if (!Array.isArray(posterReactions)) {
            posterReactions = [];
          }

          // Push the new reaction object into the posterReactions array
          posterReactions.push(reactionObj);

          // Update the posterReactions field in metaInfo
          metaInfo[0].posterReactions = JSON.stringify(posterReactions);

          // Save the updated metaInfo back to the resource
          resource.metaInfo = JSON.stringify(metaInfo);

          // Save the updated resource
          await resource.save();

          // Send response to the client
          sendResponse(ws, {
            action: "poster_data",
            data: resource,
          });

          // Broadcast the updated resource data to all clients
          broadcastToAllClients({
            action: "poster_data",
            data: resource,
          });
        } catch (error) {
          console.error("Error processing submit_reaction:", error);
          sendResponse(
            ws,
            null,
            "An error occurred while processing the reaction."
          );
        }
        break;
      case "reset_all_reactions":
        try {
          // Validate if resource and metaInfo exist
          if (!resource || !resource.metaInfo) {
            throw new Error("Invalid resource or metaInfo data.");
          }

          // Parse the metaInfo object if it exists and is a string
          let metaInfo = resource.metaInfo;
          if (typeof metaInfo === "string") {
            metaInfo = JSON.parse(metaInfo);
          }

          // Ensure metaInfo is an array and contains at least one item
          if (!Array.isArray(metaInfo) || metaInfo.length === 0) {
            throw new Error(
              "Invalid metaInfo format: Expected a non-empty array."
            );
          }

          // Parse the posterReactions if it exists and is a string
          let posterReactions = metaInfo[0].posterReactions;
          if (typeof posterReactions === "string") {
            posterReactions = JSON.parse(posterReactions);
          }

          // Ensure posterReactions is an array
          if (!Array.isArray(posterReactions)) {
            posterReactions = [];
          }

          // Reset posterReactions to an empty array
          posterReactions = [];

          // Update the posterReactions field in metaInfo
          metaInfo[0].posterReactions = JSON.stringify(posterReactions);

          // Save the updated metaInfo back to the resource
          resource.metaInfo = JSON.stringify(metaInfo);

          // Save the updated resource
          await resource.save();

          // Broadcast the updated resource data to all clients
          broadcastToAllClients({
            action: "resource_data",
            data: resource,
          });
        } catch (error) {
          console.error("Error resetting reactions:", error);
          sendResponse(
            ws,
            null,
            "An error occurred while resetting reactions."
          );
        }
        break;

      case "close_resource":
        try {
          ws.close;
        } catch (error) {
          console.error("Error closing resource:", error);
          sendResponse(
            ws,
            null,
            "An error occurred while closing the resource."
          );
        }
        break;
      default:
        sendResponse(ws, null, "Invalid message type.");
    }
  } catch (error) {
    console.error("❌ PosterSocket Error:", error);
    sendResponse(ws, null, "Internal server error.");
  }
}
