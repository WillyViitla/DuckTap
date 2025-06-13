const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage (use Redis or MongoDB in production)
let globalData = {
  totalClicks: 0,
  connectedUsers: 0,
  duckPosition: { x: 50, y: 50 }, // percentage based
  duckDirection: 1, // 1 for right, -1 for left
  isWaddling: false,
  lastClickTime: Date.now(),
  milestones: [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000]
};

// User cooldowns
const userCooldowns = new Map();

// Duck auto-movement
setInterval(() => {
  // Make duck waddle around occasionally
  if (Math.random() < 0.3) {
    globalData.isWaddling = true;
    
    // Random movement
    const moveX = (Math.random() - 0.5) * 10;
    const moveY = (Math.random() - 0.5) * 10;
    
    globalData.duckPosition.x = Math.max(10, Math.min(90, globalData.duckPosition.x + moveX));
    globalData.duckPosition.y = Math.max(10, Math.min(90, globalData.duckPosition.y + moveY));
    
    // Determine direction based on movement
    if (moveX > 0) globalData.duckDirection = 1;
    else if (moveX < 0) globalData.duckDirection = -1;
    
    io.emit('duckMove', {
      position: globalData.duckPosition,
      direction: globalData.duckDirection,
      isWaddling: true
    });
    
    setTimeout(() => {
      globalData.isWaddling = false;
      io.emit('duckMove', {
        position: globalData.duckPosition,
        direction: globalData.duckDirection,
        isWaddling: false
      });
    }, 3000);
  }
}, 5000);

// Cleanup old cooldowns
setInterval(() => {
  const now = Date.now();
  for (const [userId, cooldownTime] of userCooldowns.entries()) {
    if (now - cooldownTime > 60000) { // Remove after 1 minute
      userCooldowns.delete(userId);
    }
  }
}, 30000);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  globalData.connectedUsers++;
  
  // Send initial data to new user
  socket.emit('initialData', {
    totalClicks: globalData.totalClicks,
    connectedUsers: globalData.connectedUsers,
    duckPosition: globalData.duckPosition,
    duckDirection: globalData.duckDirection,
    isWaddling: globalData.isWaddling
  });
  
  // Broadcast updated user count
  io.emit('userCountUpdate', globalData.connectedUsers);
  
  socket.on('duckClick', (data) => {
    const now = Date.now();
    const userCooldown = userCooldowns.get(socket.id);
    
    // Check cooldown (1 second)
    if (userCooldown && now - userCooldown < 1000) {
      socket.emit('cooldownActive', {
        remaining: 1000 - (now - userCooldown)
      });
      return;
    }
    
    // Update cooldown
    userCooldowns.set(socket.id, now);
    
    // Increment counter
    globalData.totalClicks++;
    globalData.lastClickTime = now;
    
    // Check for milestone
    const milestone = globalData.milestones.find(m => globalData.totalClicks === m);
    
    // Make duck react to click
    const duckReaction = {
      bounce: true,
      speech: getRandomSpeech(),
      timestamp: now
    };
    
    // Broadcast update to all users
    io.emit('duckClicked', {
      totalClicks: globalData.totalClicks,
      clickerId: socket.id,
      duckReaction,
      milestone: milestone || null,
      position: globalData.duckPosition
    });
    
    // If milestone reached, trigger special event
    if (milestone) {
      setTimeout(() => {
        io.emit('milestoneReached', {
          milestone,
          totalClicks: globalData.totalClicks
        });
      }, 500);
    }
    
    console.log(`Duck clicked! Total: ${globalData.totalClicks}, User: ${socket.id}`);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    globalData.connectedUsers--;
    userCooldowns.delete(socket.id);
    io.emit('userCountUpdate', globalData.connectedUsers);
  });
});

function getRandomSpeech() {
  const speeches = [
    "Quack! 🦆", "That tickles!", "You got me!", "Waddle waddle!",
    "Quack quack!", "Nice click!", "Keep going!", "I'm famous!",
    "This is fun!", "More clicks please!", "Quacktastic!",
    "I'm getting dizzy!", "Click me more!", "Wheee!",
    "Catch me if you can!", "Ouch!", "Hehe!", "That was good!",
    "I'm a celebrity duck!", "Click responsibly!", "Quack attack!",
    "Duck yeah!", "Feeling lucky!", "You're quacking me up!"
  ];
  
  return speeches[Math.floor(Math.random() * speeches.length)];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🦆 Duck Counter server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to start clicking!`);
});