import { 
  connectRabbitMQ, 
  publishToQueue, 
  publishToDirectQueue, 
  consumeFromQueue, 
  closeRabbitMQ 
} from '../utils/rabbitmq.js';
import config from '../config/config.js';

// Example usage of RabbitMQ with your configuration

async function initializeRabbitMQ() {
  try {
    await connectRabbitMQ();
    console.log('RabbitMQ initialized successfully');
  } catch (error) {
    console.error('Failed to initialize RabbitMQ:', error);
    process.exit(1);
  }
}

// Example: Publishing messages to the exchange
async function publishPaymentNotification(paymentData) {
  try {
    await publishToQueue(paymentData, 'payment.notification');
    console.log('Payment notification published');
  } catch (error) {
    console.error('Failed to publish payment notification:', error);
  }
}

// Example: Publishing directly to a queue
async function publishDirectMessage(queueName, data) {
  try {
    await publishToDirectQueue(queueName, data);
    console.log(`Message published to queue: ${queueName}`);
  } catch (error) {
    console.error('Failed to publish direct message:', error);
  }
}

// Example: Consuming messages from the main queue
async function startPaymentProcessor() {
  try {
    await consumeFromQueue(
      config.rabbitmq.queueName,
      async (data) => {
        console.log('Processing payment:', data);
        
        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('Payment processed successfully');
      },
      { 
        prefetch: config.rabbitmq.prefetchCount,
        rejectOnError: false // Don't requeue failed messages
      }
    );
    console.log('Payment processor started');
  } catch (error) {
    console.error('Failed to start payment processor:', error);
  }
}

// Example: Consuming messages from a specific queue
async function startNotificationProcessor() {
  try {
    await consumeFromQueue(
      'notification-queue',
      async (data) => {
        console.log('Processing notification:', data);
        
        // Process notification (email, SMS, etc.)
        // Your notification logic here
        
        console.log('Notification sent successfully');
      }
    );
    console.log('Notification processor started');
  } catch (error) {
    console.error('Failed to start notification processor:', error);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await closeRabbitMQ();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await closeRabbitMQ();
  process.exit(0);
});

// Example usage (uncomment to run)
// async function main() {
//   await initializeRabbitMQ();
  
//   // Start consumers
//   await startPaymentProcessor();
//   await startNotificationProcessor();
  
//   // Example of publishing messages
//   await publishPaymentNotification({
//     paymentId: 'PAY123',
//     amount: 1000,
//     currency: 'INR',
//     status: 'completed',
//     timestamp: new Date().toISOString()
//   });
  
//   await publishDirectMessage('high-priority-queue', {
//     priority: 'high',
//     message: 'Urgent payment notification',
//     timestamp: new Date().toISOString()
//   });
// }

// Uncomment to run this example
// main().catch(console.error);

export {
  initializeRabbitMQ,
  publishPaymentNotification,
  publishDirectMessage,
  startPaymentProcessor,
  startNotificationProcessor
};
