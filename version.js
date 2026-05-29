
export const getVersion = async (req, res) => {
  // Use dynamic import for ESM compatibility
  const pkg = (await import('./package.json')).default;
  res.json({ version: pkg.version });
};
