export interface AccessTokenPayload {
  /** user id */
  sub: string;
  /** organization (tenant) id */
  org: string;
  email: string;
  roles: string[];
  perms: string[];
  typ: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  org: string;
  /** Refresh token id — lets us revoke a single session. */
  jti: string;
  typ: 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  roles: string[];
  permissions: string[];
  employeeId: string | null;
}
