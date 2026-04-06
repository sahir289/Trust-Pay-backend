const socketRuntime = {
  userSockets: new Map(),
  ioInstance: null,
  socketRedisPub: null,
  socketRedisSub: null,
  socketBridgePub: null,
  socketBridgeSub: null,
  cleanupInterval: null,
  hasLoggedMissingSocketInstance: false,
};

const resetSocketRuntime = () => {
  socketRuntime.userSockets.clear();
  socketRuntime.ioInstance = null;
  socketRuntime.socketRedisPub = null;
  socketRuntime.socketRedisSub = null;
  socketRuntime.socketBridgePub = null;
  socketRuntime.socketBridgeSub = null;
  socketRuntime.cleanupInterval = null;
  socketRuntime.hasLoggedMissingSocketInstance = false;
};

export { socketRuntime, resetSocketRuntime };
