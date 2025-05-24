const WebSocket = require("ws");
const server = new WebSocket.Server({ port: 8080 });

// Logger function for human-readable output
const log = (level, message, meta = {}) => {
  const timestamp = new Date().toLocaleString();
  let logMessage = `[${timestamp}] ${level}: ${message}`;
  if (Object.keys(meta).length) {
    logMessage += ` | ${Object.entries(meta)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(", ")}`;
  }
  console.log(logMessage);
};

let players = {};
let nextId = 1;

server.on("connection", (ws) => {
  const playerId = nextId++;
  let playerName = "Anonymous";

  log("INFO", `New connection established`, { playerId });

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (error) {
      return;
    }

    if (data.type === "login" && data.name) {
      playerName = data.name;
      players[playerId] = { x: 100, y: 100, name: playerName };

      // Send init message with all players and new player id
      ws.send(JSON.stringify({ type: "init", id: playerId, players }));

      // Notify all other players about new player
      server.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "join",
              id: playerId,
              x: 100,
              y: 100,
              name: playerName,
            })
          );
        }
      });
    }

    if (data.type === "move" && players[playerId]) {
      players[playerId].x = data.x;
      players[playerId].y = data.y;

      // Broadcast new position to all clients
      server.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({ type: "move", id: playerId, x: data.x, y: data.y })
          );
        }
      });
    }
  });

  ws.on("close", () => {
    log("INFO", `Player disconnected`, { playerId, playerName });
    delete players[playerId];
    let broadcastCount = 0;
    server.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "leave", id: playerId }));
        broadcastCount++;
      }
    });
    log("INFO", `Broadcasted player leave`, { playerId, broadcastCount });
  });
});

log("INFO", `Server initializing`, { port: 8080 });
