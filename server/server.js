const WebSocket = require("ws");
const server = new WebSocket.Server({ port: 8080 });

let players = {};
let nextId = 1;

server.on("connection", (ws) => {
  const id = nextId++;
  players[id] = { x: 100, y: 100 };

  ws.send(JSON.stringify({ type: "init", id, players }));

  server.clients.forEach((client) => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "join", id, x: 100, y: 100 }));
    }
  });

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);
    if (data.type === "move") {
      players[id] = { x: data.x, y: data.y };
      server.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({ type: "move", id, x: data.x, y: data.y })
          );
        }
      });
    }
  });

  ws.on("close", () => {
    delete players[id];
    server.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "leave", id }));
      }
    });
  });
});

console.log("WebSocket server running on ws://localhost:8080");
