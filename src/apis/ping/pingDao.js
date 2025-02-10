

const pingDao = async (req, res) => {
  try {
    const data = res.status(200).json({ message: 'pong' });
    console.log(data.message, "data0000")
    console.log('getting ping response', data);
    return data;
  } catch {
    console.error('getting error');
  }
};

export { pingDao };
