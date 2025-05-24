const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });
const players = {};

wss.on("connection", (ws) => {
  const id = Date.now().toString();
  players[id] = {
    x: 400,
    y: 400,
    vx: 0,
    vy: 0,
    width: 30,
    height: 50,
    onGround: false,
    name: "Player",
    color: "#ff0000",
  };

  ws.on("message", (message) => {
    const data = JSON.parse(message);
    if (data.type === "join") {
      players[id].name = data.name;
      players[id].color = data.color;
      ws.send(JSON.stringify({ type: "init", id, players }));
      broadcast({ type: "update", players }, ws);
    } else if (data.type === "update") {
      players[id].x = data.x;
      players[id].y = data.y;
      players[id].vx = data.vx;
      players[id].vy = data.vy;
      players[id].onGround = data.onGround;
      broadcast({ type: "update", players }, ws);
    }
  });

  ws.on("close", () => {
    delete players[id];
    broadcast({ type: "remove", id });
  });
});

function broadcast(data, exclude = null) {
  wss.clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

console.log("WebSocket server running on ws://localhost:8080");
