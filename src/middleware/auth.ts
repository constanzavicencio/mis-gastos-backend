import { auth } from 'express-oauth2-jwt-bearer';
import dotenv from 'dotenv';

dotenv.config();

const audience = process.env.AUTH0_AUDIENCE;
const issuerBaseURL = process.env.AUTH0_ISSUER_BASE_URL;

if (!audience || !issuerBaseURL) {
  throw new Error('Missing required env vars: AUTH0_AUDIENCE and/or AUTH0_ISSUER_BASE_URL');
}

export const authMiddleware = auth({
  audience,
  issuerBaseURL,
});
