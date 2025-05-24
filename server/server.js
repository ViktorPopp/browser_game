const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });
const players = {};
const platforms = [
  { x: 0, y: 500, width: 800, height: 100 },
  { x: 200, y: 400, width: 200, height: 20 },
  { x: 500, y: 300, width: 150, height: 20 },
];
const gravity = 0.8; // Increased for faster falls
const jumpForce = -15; // Stronger jump for quicker, higher jumps
const moveSpeed = 8; // Faster movement
const canvasHeight = 600;

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
    keys: { ArrowLeft: false, ArrowRight: false, ArrowUp: false },
  };

  ws.on("message", (message) => {
    const data = JSON.parse(message);
    if (data.type === "join") {
      players[id].name = data.name;
      players[id].color = data.color;
      ws.send(JSON.stringify({ type: "init", id, players }));
      broadcast({ type: "update", players }, ws);
    } else if (data.type === "input") {
      players[id].keys = data.keys;
    }
  });

  ws.on("close", () => {
    delete players[id];
    broadcast({ type: "remove", id });
  });
});

function updatePhysics() {
  for (const id in players) {
    const player = players[id];

    // Apply input
    player.vx = 0;
    if (player.keys.ArrowLeft) player.vx = -moveSpeed;
    if (player.keys.ArrowRight) player.vx = moveSpeed;
    if (player.keys.ArrowUp && player.onGround) {
      player.vy = jumpForce;
      player.onGround = false;
    }

    // Apply gravity and update position
    player.vy += gravity;
    player.x += player.vx;
    player.y += player.vy;

    // Platform collision
    player.onGround = false;
    for (const platform of platforms) {
      if (
        player.x < platform.x + platform.width &&
        player.x + player.width > platform.x &&
        player.y + player.height > platform.y &&
        player.y + player.height - player.vy <= platform.y
      ) {
        player.y = platform.y - player.height;
        player.vy = 0;
        player.onGround = true;
      }
    }

    // Ground collision
    if (player.y > canvasHeight - player.height) {
      player.y = canvasHeight - player.height;
      player.vy = 0;
      player.onGround = true;
    }
  }

  // Broadcast updated player states
  broadcast({ type: "update", players });
}

function broadcast(data, exclude = null) {
  wss.clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Run physics at 60 FPS
setInterval(updatePhysics, 1000 / 120);

console.log("WebSocket server running on ws://localhost:8080");
