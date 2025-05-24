const WebSocket = require("ws");

// Game configuration
const CONFIG = {
  // Physics settings
  PHYSICS: {
    GRAVITY: 0.5, // Pixels per frame squared
    MOVE_SPEED: 4, // Pixels per frame
    JUMP_SPEED: 10, // Initial upward velocity
    TERMINAL_VELOCITY: 15, // Max fall speed
    FRICTION: 0.8, // Slowdown when not moving (not used for horizontal movement)
  },
  // Map configuration: array of platforms [x, y, width, height]
  MAP: [
    // Ground and base platforms
    [0, 400, 800, 20], // Ground
    [0, 580, 800, 20], // Lower ground for extra space
    // Middle platforms
    [100, 350, 150, 20], // Left-middle platform
    [300, 320, 200, 20], // Center-middle platform
    [550, 340, 150, 20], // Right-middle platform
    // Higher platforms
    [50, 250, 100, 20], // Left-high platform
    [200, 220, 120, 20], // Left-center-high platform
    [400, 200, 100, 20], // Center-high platform
    [600, 230, 120, 20], // Right-high platform
    // Floating platforms
    [150, 150, 80, 20], // Small floating left
    [350, 120, 80, 20], // Small floating center
    [550, 140, 80, 20], // Small floating right
    // Wall platforms
    [0, 200, 20, 150], // Left wall platform
    [780, 200, 20, 150], // Right wall platform
    // Scattered small platforms
    [250, 280, 50, 20], // Small mid-left
    [450, 260, 50, 20], // Small mid-right
    [100, 100, 60, 20], // Tiny high-left
    [650, 110, 60, 20], // Tiny high-right
    // Staggered platforms for vertical climb
    [700, 300, 80, 20], // Right-middle climb
    [650, 200, 80, 20], // Right-high climb
    [700, 100, 80, 20], // Right-top climb
  ],
  // Game world dimensions (used for reference, not bounds enforcement)
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

    // No boundary checks to allow free exploration
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
