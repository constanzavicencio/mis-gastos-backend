const { auth } = require('express-oauth2-jwt-bearer');
const dotenv = require('dotenv');

dotenv.config();

// Ensure required env vars exist at startup so types align with the auth() API
const audience = process.env.AUTH0_AUDIENCE;
const issuerBaseURL = process.env.AUTH0_ISSUER_BASE_URL;

if (!audience || !issuerBaseURL) {
  throw new Error('Missing required env vars: AUTH0_AUDIENCE and/or AUTH0_ISSUER_BASE_URL');
}

const authMiddleware = auth({
  audience,
  issuerBaseURL,
});

module.exports = { authMiddleware };
