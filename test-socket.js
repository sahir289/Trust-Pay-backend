// Test socket functionality with ES modules
import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:8090';

console.log('🔧 Testing Socket Connection and Force Logout...\n');

// Create first socket connection (Device A)
const socket1 = io(SERVER_URL, {
  transports: ['websocket', 'polling']
});

// Create second socket connection (Device B) 
const socket2 = io(SERVER_URL, {
  transports: ['websocket', 'polling']
});

socket1.on('connect', () => {
  console.log('📱 Device A connected:', socket1.id);
  
  // Login from Device A
  socket1.emit('user-login', {
    userId: 'test-user-123',
    sessionId: 'session-device-a'
  });
});

socket1.on('forceLogout', (data) => {
  console.log('❌ Device A received forceLogout:', data);
});

socket1.on('session-terminated', (data) => {
  console.log('❌ Device A received session-terminated:', data);
});

socket1.on('logout', (data) => {
  console.log('❌ Device A received logout:', data);
});

socket1.on('disconnect', (reason) => {
  console.log('❌ Device A disconnected:', reason);
});

socket2.on('connect', () => {
  console.log('📱 Device B connected:', socket2.id);
  
  // Wait 2 seconds, then login from Device B (should force logout Device A)
  setTimeout(() => {
    console.log('\n🔄 Device B attempting login (should force logout Device A)...\n');
    socket2.emit('user-login', {
      userId: 'test-user-123',
      sessionId: 'session-device-b'
    });
  }, 2000);
});

socket2.on('forceLogout', (data) => {
  console.log('❌ Device B received forceLogout:', data);
});

socket2.on('session-terminated', (data) => {
  console.log('❌ Device B received session-terminated:', data);
});

socket2.on('logout', (data) => {
  console.log('❌ Device B received logout:', data);
});

socket2.on('disconnect', (reason) => {
  console.log('❌ Device B disconnected:', reason);
});

// General events
[socket1, socket2].forEach((socket, index) => {
  const deviceName = index === 0 ? 'Device A' : 'Device B';
  
  socket.on('new-entry', (data) => {
    console.log(`✅ ${deviceName} received new-entry:`, data.message);
  });
  
  socket.on('pongCheck', () => {
    console.log(`🏓 ${deviceName} received pong`);
  });
  
  socket.on('newLogin', (userId) => {
    console.log(`🔔 ${deviceName} received newLogin event for user:`, userId);
  });
});

// Test ping after 3 seconds
setTimeout(() => {
  console.log('\n🏓 Testing ping/pong...');
  socket1.emit('pingCheck');
  socket2.emit('pingCheck');
}, 3000);

// Cleanup after 10 seconds
setTimeout(() => {
  console.log('\n🧹 Cleaning up connections...');
  socket1.disconnect();
  socket2.disconnect();
  process.exit(0);
}, 10000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Terminating...');
  socket1.disconnect();
  socket2.disconnect();
  process.exit(0);
});
