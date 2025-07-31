import express from 'express';
import { publishToQueue, publishToDirectQueue } from '../utils/rabbitmq.js';
import testRabbitMQ from '../tests/rabbitmq-test.js';

const router = express.Router();

// Test RabbitMQ connection and functionality
router.get('/test', async (req, res) => {
  try {
    const result = await testRabbitMQ();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Publish a message to the exchange
router.post('/publish', async (req, res) => {
  try {
    const { message, routingKey } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    const messageData = {
      id: Date.now(),
      message,
      timestamp: new Date().toISOString(),
      source: 'api'
    };
    
    await publishToQueue(messageData, routingKey);
    
    res.json({
      success: true,
      message: 'Message published successfully',
      data: messageData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Publish a message directly to a queue
router.post('/publish-direct', async (req, res) => {
  try {
    const { queueName, message } = req.body;
    
    if (!queueName || !message) {
      return res.status(400).json({
        success: false,
        error: 'Queue name and message are required'
      });
    }
    
    const messageData = {
      id: Date.now(),
      message,
      timestamp: new Date().toISOString(),
      source: 'api-direct'
    };
    
    await publishToDirectQueue(queueName, messageData);
    
    res.json({
      success: true,
      message: 'Message published to queue successfully',
      data: messageData,
      queueName
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
