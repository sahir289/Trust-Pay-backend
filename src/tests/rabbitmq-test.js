import { 
  publishToQueue, 
  publishToDirectQueue, 
  consumeFromQueue,
  getRabbitChannel 
} from '../utils/rabbitmq.js';
import config from '../config/config.js';

// Test RabbitMQ functionality
export async function testRabbitMQ() {
  try {
    console.log('Starting RabbitMQ tests...');
    
    // Test 1: Check if channel is available
    const channel = getRabbitChannel();
    if (!channel) {
      throw new Error('RabbitMQ channel not available');
    }
    console.log('✓ RabbitMQ channel is available');
    
    // Test 2: Publish to exchange
    const testMessage = {
      id: Date.now(),
      message: 'Test message from Trust Pay backend',
      timestamp: new Date().toISOString()
    };
    
    await publishToQueue(testMessage);
    console.log('✓ Message published to exchange successfully');
    
    // Test 3: Publish directly to queue
    await publishToDirectQueue('test-queue', {
      ...testMessage,
      type: 'direct-queue-test'
    });
    console.log('✓ Message published to direct queue successfully');
    
    // Test 4: Set up a consumer (for demonstration)
    console.log('✓ Setting up test consumer...');
    await consumeFromQueue(
      config.rabbitmq.queueName,
      async (data) => {
        console.log('📨 Received message:', data);
      },
      { 
        prefetch: 1,
        rejectOnError: false
      }
    );
    console.log('✓ Consumer set up successfully');
    
    console.log('🎉 All RabbitMQ tests passed!');
    
    return {
      success: true,
      message: 'RabbitMQ is working correctly with your configuration',
      config: {
        url: config.rabbitmq.url,
        queueName: config.rabbitmq.queueName,
        exchangeName: config.rabbitmq.exchangeName,
        routingKey: config.rabbitmq.routingKey,
        prefetchCount: config.rabbitmq.prefetchCount
      }
    };
    
  } catch (error) {
    console.error('❌ RabbitMQ test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Export the test for use in other files
export default testRabbitMQ;
