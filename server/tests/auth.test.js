const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sharedAuthMiddleware } = require('../shared/middlewares/shared-auth-middleware');

describe('Authentication & Authorization Security Tests', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  describe('JWT Token Generation & Password Hashing', () => {
    test('hashes password with bcrypt correctly', async () => {
      const plainPassword = 'SecurePassword123!';
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(plainPassword, salt);

      expect(hashedPassword).not.toBe(plainPassword);
      const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
      expect(isMatch).toBe(true);
      const isWrongMatch = await bcrypt.compare('WrongPassword', hashedPassword);
      expect(isWrongMatch).toBe(false);
    });

    test('generates valid JWT with user role and payload', () => {
      const payload = { userId: 'user_12345', role: 'customer' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.userId).toBe('user_12345');
      expect(decoded.role).toBe('customer');
    });

    test('rejects tampered or malformed JWT token', () => {
      const validToken = jwt.sign({ userId: 'user_123' }, JWT_SECRET, { expiresIn: '1h' });
      const tamperedToken = validToken + 'invalid';

      expect(() => {
        jwt.verify(tamperedToken, JWT_SECRET);
      }).toThrow();
    });

    test('detects expired JWT token', () => {
      const expiredToken = jwt.sign({ userId: 'user_123' }, JWT_SECRET, { expiresIn: -10 });

      try {
        jwt.verify(expiredToken, JWT_SECRET);
      } catch (err) {
        expect(err.name).toBe('TokenExpiredError');
      }
    });
  });

  describe('Shared Auth Middleware Enforcement', () => {
    test('returns 401 when Authorization header is missing', () => {
      const req = { header: jest.fn().mockReturnValue(null) };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      sharedAuthMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: expect.stringMatching(/session has expired|sign in/i)
      }));
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 with tokenExpired flag on expired JWT', () => {
      const expiredToken = jwt.sign({ userId: 'user_999', role: 'customer' }, JWT_SECRET, { expiresIn: -500 });
      const req = { header: jest.fn().mockReturnValue(`Bearer ${expiredToken}`) };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      sharedAuthMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        tokenExpired: true
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });
});
