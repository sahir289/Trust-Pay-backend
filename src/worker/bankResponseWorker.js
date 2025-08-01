import { connectRabbitMQ } from '../utils/rabbitmq.js';
import { startBankResponseWorker } from '../utils/rabbitmq-bank-response.js';

(async () => {
  await connectRabbitMQ();
  await startBankResponseWorker(async (data) => {
    // Your processing logic here
    console.log('[Worker] Processing bank response:', data);
    // ...process the data, update DB, etc...
  });
  console.log('BankResponse worker started and listening for messages...');
})();
