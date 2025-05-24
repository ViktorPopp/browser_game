const WebSocket = require("ws");
const server = new WebSocket.Server({ port: 8080 });

let players = {};
let nextId = 1;

server.on("connection", (ws) => {
  let playerId = nextId++;
  let playerName = "Anonymous";

  // Wait for the client to send their name first
  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

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
    delete players[playerId];
    server.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "leave", id: playerId }));
      }
    });
  });
});

console.log("WebSocket server running on ws://localhost:8080");
