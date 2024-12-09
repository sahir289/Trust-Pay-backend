const tryCatchHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    return next(error);
  }
};

export default tryCatchHandler;
