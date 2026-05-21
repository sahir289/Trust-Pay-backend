// __mocks__/@aws-sdk/client-s3.js
export class S3Client {
  send() {
    // Always resolve to a dummy object for tests
    return Promise.resolve({ Body: Buffer.from('dummy') });
  }
}
export class GetObjectCommand {
  constructor() {}
}
