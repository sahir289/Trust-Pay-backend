import app from './src/app.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import chalk from 'chalk';
import config from './src/config/config.js';

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [`${config?.reactFrontOrigin}`, `${config?.reactPaymentOrigin}`],
  },
});

const PORT = config?.port || 8090;

const normalizePort = (val) => {
  const port = parseInt(val, 10);
  if (Number.isNaN(port)) {
    // named pipe
    return val;
  }
  if (port >= 0) {
    // port number
    return port;
  }
  return false;
};

const port = normalizePort(PORT);
const onError = (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }
  switch (error.code) {
    case 'EACCES':
      console.error(`${port} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`${port} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
};

const onListening = () => {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
  const styledServerMessage = chalk.blue(
    `the server started listening on ${bind}`,
  );
  console.log(styledServerMessage);
  const docsUrl = `http://localhost:${PORT}/api-docs`;
  const styledMessage = chalk.bold.yellow(`API docs available at ${docsUrl}`);
  console.log(styledMessage);
};

process.on('SIGINT', () => {
  console.error('stopping the server');
  process.exit();
});

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

io.on('connection', (socket) => {
  console.log(`Client connected with socket ID:${socket.id}`);

  // Emit a test message to the client
  socket.emit('new-entry', { message: 'Hello from server!!!', data: {} });

  // Optional: Broadcast to all clients
  io.emit('broadcast-message', { message: 'A new client has connected!' });

  // Listen for client events
  socket.on('client-message', (data) => {
    console.log(`Received from client:`, data);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.error('Client disconnected');
  });
});

export { io };
