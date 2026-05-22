import crypto from 'node:crypto';

const key = crypto.randomBytes(32).toString('hex');
console.log(key);
