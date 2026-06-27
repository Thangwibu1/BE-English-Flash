import jwt from 'jsonwebtoken';
import { AuthTokenService, TokenPayload } from '../../app/ports/services/AuthTokenService';

export class JwtAuthTokenService implements AuthTokenService {
  private secret: string;

  constructor() {
    this.secret = process.env.JWT_SECRET || 'change_me_default_secret';
  }

  sign(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: '7d' });
  }

  verify(token: string): TokenPayload {
    return jwt.verify(token, this.secret) as TokenPayload;
  }
}
