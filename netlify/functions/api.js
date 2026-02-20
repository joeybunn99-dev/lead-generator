const serverless = require('serverless-http');
const app = require('../../server');

// Wrap the Express app as a Netlify / AWS Lambda function
module.exports.handler = serverless(app);
