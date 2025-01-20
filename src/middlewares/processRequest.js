const processRequest = (source, role) => {
    if (role === 'admin' && source === 'web') {
      return true;
    }
    if (source === 'mobile' && role !== 'admin') {
      return true;
    }
    return false;
  };
  
  export { processRequest };