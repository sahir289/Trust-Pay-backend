const sendSuccess = (
    res,
    data = undefined,
    message = undefined,
    status = 200,
    total,
    page
  ) => {
    let finalRes = {
      error: {},
      meta: {},
      data: {},
    };
  
    if (message) {
      finalRes.meta.message = message;
    }
    if (data) {
      finalRes.data = { ...data };
    }
    if (total) {
      finalRes = { ...finalRes, total };
    }
    if (page) {
      finalRes = { ...finalRes, page };
    }
    return res.status(status).json(finalRes);
  };
  
  const sendError = (
    res,
    error = undefined,
    message = undefined,
    statusCode = 500
  ) => {
    const finalRes = {
      error: {},
      meta: {},
      data: {},
    };
  
    if (message) {
      finalRes.meta.message = message;
    }
    if (error) {
      finalRes.error = { ...error };
    }
    return res.status(statusCode).json(finalRes);
  };
  
  export { sendSuccess, sendError };