/**
 * Test Suite for Refactored RabbitMQ Implementation
 * Run with: node test-rabbitmq-refactor.js
 */

import chalk from 'chalk';

const tests = [];
const results = { passed: 0, failed: 0 };

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log(chalk.cyan('\n=== RabbitMQ Refactor Test Suite ===\n'));

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(chalk.green(`✅ ${name}`));
      results.passed++;
    } catch (error) {
      console.log(chalk.red(`❌ ${name}`));
      console.log(chalk.red(`   Error: ${error.message}`));
      results.failed++;
    }
  }

  console.log(chalk.cyan('\n=== Test Results ==='));
  console.log(chalk.green(`Passed: ${results.passed}`));
  console.log(chalk.red(`Failed: ${results.failed}`));
  console.log(chalk.cyan(`Total: ${tests.length}\n`));

  process.exit(results.failed > 0 ? 1 : 0);
}

// Test 1: Connection Manager Loads
test('Connection Manager Module Loads', async () => {
  const module = await import('./src/utils/rabbitmq-connection.js');
  if (!module.RabbitMQConnection) throw new Error('RabbitMQConnection not exported');
  if (!module.publisherConnection) throw new Error('publisherConnection not exported');
  if (!module.consumerConnection) throw new Error('consumerConnection not exported');
});

// Test 2: Publisher Module Loads
test('Publisher Module Loads', async () => {
  const module = await import('./src/utils/rabbitmq-publisher.js');
  if (!module.publishBankResponse) throw new Error('publishBankResponse not exported');
  if (!module.publishBankResponseBulk) throw new Error('publishBankResponseBulk not exported');
  if (!module.closePublisher) throw new Error('closePublisher not exported');
});

// Test 3: Worker Module Loads
test('Worker Module Loads', async () => {
  const module = await import('./src/worker/bank-response-worker.js');
  if (!module.startBankResponseWorker) throw new Error('startBankResponseWorker not exported');
  if (!module.startBankResponseHandler) throw new Error('startBankResponseHandler not exported');
  if (!module.shutdownWorker) throw new Error('shutdownWorker not exported');
});

// Test 4: Backward Compatibility
test('Backward Compatibility (old module works)', async () => {
  const module = await import('./src/utils/rabbitmq-bank-response.js');
  if (!module.publishBankResponse) throw new Error('publishBankResponse not re-exported');
  if (!module.publishBankResponseBulk) throw new Error('publishBankResponseBulk not re-exported');
});

// Test 5: Config Validation
test('Configuration Has Required Fields', async () => {
  const config = await import('./src/config/config.js');
  const rabbitmq = config.default.rabbitmq;
  
  if (!rabbitmq.url) throw new Error('rabbitmq.url not configured');
  if (!rabbitmq.bankResponseQueue) throw new Error('rabbitmq.bankResponseQueue not configured');
  if (rabbitmq.prefetchCount === undefined) throw new Error('rabbitmq.prefetchCount not configured');
  if (!rabbitmq.retryAttempts) throw new Error('rabbitmq.retryAttempts not configured');
});

// Test 6: Connection Manager Class
test('Connection Manager Class Works', async () => {
  const { RabbitMQConnection } = await import('./src/utils/rabbitmq-connection.js');
  const connection = new RabbitMQConnection('test');
  
  if (typeof connection.connect !== 'function') throw new Error('connect method missing');
  if (typeof connection.getChannel !== 'function') throw new Error('getChannel method missing');
  if (typeof connection.close !== 'function') throw new Error('close method missing');
});

// Test 7: Server Import Check
test('Server Imports New Worker Module', async () => {
  const fs = await import('fs');
  const serverContent = fs.readFileSync('./server.js', 'utf-8');
  
  if (!serverContent.includes('bank-response-worker.js')) {
    throw new Error('Server not importing from new worker file');
  }
  
  if (serverContent.includes('consume-bank-response-worker.js')) {
    throw new Error('Server still importing old worker file');
  }
});

// Test 8: Worker Has Proper Error Handling
test('Worker Has Retry Logic', async () => {
  const fs = await import('fs');
  const workerContent = fs.readFileSync('./src/worker/bank-response-worker.js', 'utf-8');
  
  if (!workerContent.includes('RETRYABLE_ERROR_PATTERNS')) {
    throw new Error('Missing retry error patterns');
  }
  
  if (!workerContent.includes('x-retry-count')) {
    throw new Error('Missing retry count header logic');
  }
  
  if (!workerContent.includes('MAX_RETRIES')) {
    throw new Error('Missing max retries constant');
  }
});

// Test 9: Publisher Has Fallback Logic
test('Publisher Has Database Fallback', async () => {
  const fs = await import('fs');
  const publisherContent = fs.readFileSync('./src/utils/rabbitmq-publisher.js', 'utf-8');
  
  if (!publisherContent.includes('fallbackToDatabase')) {
    throw new Error('Missing database fallback function');
  }
  
  if (!publisherContent.includes('createBankResponseService')) {
    throw new Error('Missing createBankResponseService import');
  }
});

// Test 10: No Syntax Errors in New Files
test('No Syntax Errors in New Files', async () => {
  await import('./src/utils/rabbitmq-connection.js');
  await import('./src/utils/rabbitmq-publisher.js');
  await import('./src/worker/bank-response-worker.js');
  // If we get here, no syntax errors
});

// Test 11: DLQ Configuration
test('Worker Has DLQ Configuration', async () => {
  const fs = await import('fs');
  const workerContent = fs.readFileSync('./src/worker/bank-response-worker.js', 'utf-8');
  
  if (!workerContent.includes('DLX_NAME')) {
    throw new Error('Missing DLX configuration');
  }
  
  if (!workerContent.includes('DLQ_NAME')) {
    throw new Error('Missing DLQ configuration');
  }
  
  if (!workerContent.includes('x-dead-letter-exchange')) {
    throw new Error('Missing dead letter exchange setup');
  }
});

// Test 12: Graceful Shutdown
test('Worker Has Graceful Shutdown', async () => {
  const fs = await import('fs');
  const workerContent = fs.readFileSync('./src/worker/bank-response-worker.js', 'utf-8');
  
  if (!workerContent.includes('isShuttingDown')) {
    throw new Error('Missing shutdown flag');
  }
  
  if (!workerContent.includes('channel.cancel')) {
    throw new Error('Missing consumer cancellation');
  }
});

// Test 13: Separate Connections
test('Publisher and Consumer Use Separate Connections', async () => {
  const { publisherConnection, consumerConnection } = await import('./src/utils/rabbitmq-connection.js');
  
  if (publisherConnection === consumerConnection) {
    throw new Error('Publisher and consumer sharing same connection instance');
  }
  
  if (publisherConnection.connectionName === consumerConnection.connectionName) {
    throw new Error('Publisher and consumer have same connection name');
  }
});

// Test 14: Exponential Backoff
test('Connection Manager Has Exponential Backoff', async () => {
  const fs = await import('fs');
  const connectionContent = fs.readFileSync('./src/utils/rabbitmq-connection.js', 'utf-8');
  
  if (!connectionContent.includes('_getRetryDelay')) {
    throw new Error('Missing retry delay calculation');
  }
  
  if (!connectionContent.includes('Math.pow(2')) {
    throw new Error('Missing exponential backoff formula');
  }
});

// Test 15: Logging Prefixes
test('Modules Have Logging Prefixes', async () => {
  const fs = await import('fs');
  
  const publisherContent = fs.readFileSync('./src/utils/rabbitmq-publisher.js', 'utf-8');
  const workerContent = fs.readFileSync('./src/worker/bank-response-worker.js', 'utf-8');
  
  if (!publisherContent.includes('[Publisher]')) {
    throw new Error('Publisher missing logging prefix');
  }
  
  if (!workerContent.includes('[Consumer]')) {
    throw new Error('Consumer missing logging prefix');
  }
});

runTests();
