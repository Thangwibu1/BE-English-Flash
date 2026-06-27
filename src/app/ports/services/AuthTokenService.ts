export interface TokenPayload {
  id: string;
  role: string;
}

export interface AuthTokenService {
  sign(payload: TokenPayload): string;
  verify(token: string): TokenPayload;
}
