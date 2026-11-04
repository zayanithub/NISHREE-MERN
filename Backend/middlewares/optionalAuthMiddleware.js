import authMiddleware from "./authMiddleware.js";

/*
|--------------------------------------------------------------------------
| Optional Customer Authentication
|--------------------------------------------------------------------------
|
| Logged-in customer:
|   Valid Bearer token required.
|   Existing authMiddleware verifies the token.
|
| Guest customer:
|   No Authorization header is allowed.
|   Guest cart identity is handled separately using a secure session.
|
| Important:
|   If a token is provided but invalid, do not silently
|   downgrade the request to guest access.
|--------------------------------------------------------------------------
*/

const optionalAuthMiddleware = (req, res, next) => {
  const authorization = req.headers.authorization;

  // No token: allow guest access.
  if (!authorization) {
    req.auth = null;
    return next();
  }

  // Token provided: require valid customer authentication.
  return authMiddleware(req, res, next);
};

export default optionalAuthMiddleware;