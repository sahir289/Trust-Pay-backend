# RabbitMQ Implementation for Trust Pay Backend

## Overview

This document describes the complete RabbitMQ implementation for the Trust Pay backend application, including configuration, usage, and examples.

## Configuration

The RabbitMQ configuration is defined in `/src/config/config.js`:

```javascript
rabbitmq: {
  url: Env?.RABBITMQ_URL || 'amqp://localhost:5672',
  queueName: Env?.RABBITMQ_QUEUE_NAME || 'trust-pay-queue',
  exchangeName: Env?.RABBITMQ_EXCHANGE_NAME || 'trust-pay-exchange',
  routingKey: Env?.RABBITMQ_ROUTING_KEY || 'trust-pay-routing-key',
  prefetchCount: parseInt(Env?.RABBITMQ_PREFETCH_COUNT) || 1,
  connectionTimeout: parseInt(Env?.RABBITMQ_CONNECTION_TIMEOUT) || 10000,
  heartbeat: parseInt(Env?.RABBITMQ_HEARTBEAT) || 60,
  retryAttempts: parseInt(Env?.RABBITMQ_RETRY_ATTEMPTS) || 5,
  retryDelay: parseInt(Env?.RABBITMQ_RETRY_DELAY) || 5000,
}
```

### Environment Variables

You can customize the RabbitMQ configuration using these environment variables in your `.env` file:

```bash
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_QUEUE_NAME=trust-pay-queue
RABBITMQ_EXCHANGE_NAME=trust-pay-exchange
RABBITMQ_ROUTING_KEY=trust-pay-routing-key
RABBITMQ_PREFETCH_COUNT=1
RABBITMQ_CONNECTION_TIMEOUT=10000
RABBITMQ_HEARTBEAT=60
RABBITMQ_RETRY_ATTEMPTS=5
RABBITMQ_RETRY_DELAY=5000
```

## Features

### ✅ Automatic Connection with Retry Logic
- Automatic retry mechanism with configurable attempts and delay
- Connection error handling and recovery
- Graceful failure handling for development environments

### ✅ Exchange and Queue Management
- Automatic exchange and queue assertion
- Queue binding with routing keys
- Durable queues and exchanges for persistence

### ✅ Message Publishing
- Publish to exchange with routing keys
- Direct queue publishing
- Persistent message delivery

### ✅ Message Consumption
- Consumer setup with acknowledgment handling
- Configurable prefetch count for load balancing
- Error handling with configurable reject behavior

### ✅ Connection Management
- Heartbeat configuration
- Connection timeout handling
- Graceful shutdown support

## API Endpoints

### Test RabbitMQ Connection
```bash
GET /v1/rabbitmq/test
```

**Response:**
```json
{
  "success": true,
  "message": "RabbitMQ is working correctly with your configuration",
  "config": {
    "url": "amqp://localhost:5672",
    "queueName": "trust-pay-queue",
    "exchangeName": "trust-pay-exchange",
    "routingKey": "trust-pay-routing-key",
    "prefetchCount": 1
  }
}
```

### Publish Message to Exchange
```bash
POST /v1/rabbitmq/publish
Content-Type: application/json

{
  "message": "Your message here",
  "routingKey": "optional.routing.key"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message published successfully",
  "data": {
    "id": 1751204357739,
    "message": "Your message here",
    "timestamp": "2025-06-29T13:39:17.739Z",
    "source": "api"
  }
}
```

### Publish Message to Direct Queue
```bash
POST /v1/rabbitmq/publish-direct
Content-Type: application/json

{
  "queueName": "specific-queue-name",
  "message": "Your direct message"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message published to queue successfully",
  "data": {
    "id": 1751204369310,
    "message": "Your direct message",
    "timestamp": "2025-06-29T13:39:29.310Z",
    "source": "api-direct"
  },
  "queueName": "specific-queue-name"
}
```

## Code Examples

### Basic Usage

```javascript
import { 
  connectRabbitMQ, 
  publishToQueue, 
  publishToDirectQueue, 
  consumeFromQueue 
} from './utils/rabbitmq.js';

// Connect to RabbitMQ (automatic with config)
await connectRabbitMQ();

// Publish to exchange
await publishToQueue({
  paymentId: 'PAY123',
  amount: 1000,
  status: 'completed'
});

// Publish to specific queue
await publishToDirectQueue('urgent-notifications', {
  type: 'urgent',
  message: 'High priority payment alert'
});

// Set up consumer
await consumeFromQueue('payment-queue', async (data) => {
  console.log('Processing payment:', data);
  // Your processing logic here
});
```

### Advanced Consumer with Error Handling

```javascript
await consumeFromQueue(
  'payment-processing',
  async (data) => {
    try {
      // Process payment
      await processPayment(data);
      console.log('Payment processed:', data.paymentId);
    } catch (error) {
      console.error('Payment processing failed:', error);
      throw error; // Will reject the message
    }
  },
  {
    prefetch: 5,
    rejectOnError: true // Requeue failed messages
  }
);
```

## Management Interface

Access the RabbitMQ Management UI at: http://localhost:15672

**Default Credentials:**
- Username: `guest`
- Password: `guest`

## Installation and Setup

1. **Install RabbitMQ** (macOS):
   ```bash
   brew install rabbitmq
   brew services start rabbitmq
   ```

2. **Verify Installation**:
   ```bash
   brew services list | grep rabbitmq
   lsof -i :5672  # Check AMQP port
   lsof -i :15672 # Check management interface
   ```

3. **Test Connection**:
   ```bash
   curl -X GET http://localhost:8090/v1/rabbitmq/test
   ```

## Best Practices

### 1. Message Structure
Always include these fields in your messages:
```javascript
{
  id: Date.now(), // Unique identifier
  timestamp: new Date().toISOString(), // When created
  type: 'payment.processed', // Message type
  data: { /* your payload */ }, // Actual data
  source: 'payment-service', // Originating service
  version: '1.0' // Message schema version
}
```

### 2. Queue Naming Convention
- Use descriptive names: `payment-notifications`, `user-registrations`
- Use dots for hierarchy: `payment.process`, `payment.notify`
- Use environment prefixes: `dev-payment-queue`, `prod-payment-queue`

### 3. Error Handling
```javascript
await consumeFromQueue('queue-name', async (data) => {
  try {
    await processMessage(data);
  } catch (error) {
    console.error('Processing failed:', error);
    // Log error details for debugging
    await logError(error, data);
    throw error; // Let RabbitMQ handle retry logic
  }
});
```

### 4. Graceful Shutdown
```javascript
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await closeRabbitMQ();
  process.exit(0);
});
```

## Troubleshooting

### Connection Issues
1. Check if RabbitMQ is running: `brew services list | grep rabbitmq`
2. Verify ports are open: `lsof -i :5672`
3. Check configuration in config.js
4. Review application logs for connection errors

### Message Not Being Consumed
1. Verify queue exists in management interface
2. Check consumer is properly set up
3. Verify routing key matches
4. Check for unacked messages in queue

### Performance Issues
1. Adjust prefetch count based on processing speed
2. Use multiple consumers for parallel processing
3. Monitor queue depth in management interface
4. Consider message persistence vs performance trade-offs

## Files Structure

```
src/
├── config/
│   └── config.js                 # RabbitMQ configuration
├── utils/
│   └── rabbitmq.js              # Core RabbitMQ utilities
├── routes/
│   └── rabbitmq.js              # API endpoints for testing
├── examples/
│   └── rabbitmq-example.js      # Usage examples
└── tests/
    └── rabbitmq-test.js          # Test functions
```

## Next Steps

1. **Implement Message Consumers**: Create specific consumers for your business logic
2. **Add Dead Letter Queues**: Handle failed messages appropriately
3. **Implement Message Routing**: Use different routing keys for different message types
4. **Add Monitoring**: Implement health checks and monitoring for RabbitMQ
5. **Scale Consumers**: Add multiple consumers for high-throughput scenarios

## Production Considerations

1. **Environment Variables**: Set up proper environment-specific configurations
2. **Connection Pooling**: Consider connection pooling for high-throughput applications
3. **Monitoring**: Set up monitoring and alerting for queue depths and connection issues
4. **Backup**: Implement proper backup strategies for persistent queues
5. **Security**: Configure proper authentication and SSL/TLS for production

---

## Support

For issues or questions about the RabbitMQ implementation, please check:
1. RabbitMQ official documentation: https://www.rabbitmq.com/documentation.html
2. Management interface: http://localhost:15672
3. Application logs for error details
