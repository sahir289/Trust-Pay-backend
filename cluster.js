// To run local in cluster mode: npm run cluster
import cluster from 'node:cluster';
import os from 'node:os';

const numCPUs = Math.min(os.cpus().length, 2); // Use 2 workers for local dev

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);
  console.log(`Starting ${numCPUs} workers...`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
    cluster.fork();
  });

  cluster.on('online', (worker) => {
    console.log(`Worker ${worker.process.pid} is online`);
  });
} else {
  // Workers run the server
  import('./server.js');
}
