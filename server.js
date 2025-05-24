const WebSocket = require("ws");

// Game configuration
const CONFIG = {
  // Physics settings
  PHYSICS: {
    GRAVITY: 0.5, // Pixels per frame squared
    MOVE_SPEED: 4, // Pixels per frame
    JUMP_SPEED: 10, // Initial upward velocity
    TERMINAL_VELOCITY: 15, // Max fall speed
    FRICTION: 0.8, // Slowdown when not moving (not used for horizontal movement anymore)
  },
  // Map configuration: array of platforms [x, y, width, height]
  MAP: [
    [0, 400, 800, 20], // Ground
    [200, 300, 200, 20], // Middle platform
    [500, 200, 150, 20], // Higher platform
  ],
  // Game world dimensions
  WORLD: {
    WIDTH: 800,
    HEIGHT: 600,
  },
  UPDATE_RATE: 60, // Updates per second
};

// Game state
const players = new Map(); // playerId -> { id, name, color, x, y, vx, vy }
let nextPlayerId = 1;

// WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws) => {
  const playerId = nextPlayerId++;
  console.log(`Player ${playerId} connected`);

  // Handle incoming messages
  ws.on("message", (message) => {
    const data = JSON.parse(message);
    switch (data.type) {
      case "join":
        // Initialize player
        players.set(playerId, {
          id: playerId,
          name: data.name || `Player${playerId}`,
          color: data.color || "#ff0000",
          x: 100,
          y: 100,
          vx: 0,
          vy: 0,
          grounded: false,
        });
        // Send player their ID
        ws.send(JSON.stringify({ type: "init", playerId }));
        break;
      case "input":
        // Update player velocity based on input
        const player = players.get(playerId);
        if (player) {
          // Set horizontal velocity to 0 if no movement keys are pressed
          player.vx = data.inputs.left
            ? -CONFIG.PHYSICS.MOVE_SPEED
            : data.inputs.right
            ? CONFIG.PHYSICS.MOVE_SPEED
            : 0;
          if (data.inputs.jump && player.grounded) {
            player.vy = -CONFIG.PHYSICS.JUMP_SPEED;
            player.grounded = false;
          }
        }
        break;
    }
  });

  ws.on("close", () => {
    console.log(`Player ${playerId} disconnected`);
    players.delete(playerId);
  });
});

// Physics and game loop
setInterval(() => {
  // Update each player
  players.forEach((player) => {
    // Apply gravity
    player.vy += CONFIG.PHYSICS.GRAVITY;
    if (player.vy > CONFIG.PHYSICS.TERMINAL_VELOCITY) {
      player.vy = CONFIG.PHYSICS.TERMINAL_VELOCITY;
    }

    // Update position
    player.x += player.vx;
    player.y += player.vy;

    // Check collisions with platforms
    player.grounded = false;
    for (const platform of CONFIG.MAP) {
      const [px, py, pw, ph] = platform;
      // Simple AABB collision detection
      if (
        player.x + 20 > px &&
        player.x < px + pw &&
        player.y + 20 > py &&
        player.y < py + ph
      ) {
        // Resolve collision (player on top of platform)
        if (player.vy > 0 && player.y + 20 - player.vy <= py) {
          player.y = py - 20;
          player.vy = 0;
          player.grounded = true;
        }
      }
    }

    // Keep player in bounds
    if (player.x < 0) player.x = 0;
    if (player.x > CONFIG.WORLD.WIDTH - 20) player.x = CONFIG.WORLD.WIDTH - 20;
    if (player.y > CONFIG.WORLD.HEIGHT - 20) {
      player.y = CONFIG.WORLD.HEIGHT - 20;
      player.vy = 0;
      player.grounded = true;
    }
  });

  // Broadcast game state
  const state = {
    type: "state",
    players: Array.from(players.values()),
    map: CONFIG.MAP,
  };
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(state));
    }
  });
}, 1000 / CONFIG.UPDATE_RATE);

console.log("Server running on ws://localhost:8080");
