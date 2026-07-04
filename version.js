import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pkg = require('./package.json');

export const getVersion = (req, res) => {
  res.json({ version: pkg.version });
};

export const getVersionString = () => pkg.version;
