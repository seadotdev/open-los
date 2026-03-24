# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Open LOS, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email **security@sea.dev** with:

- A description of the vulnerability
- Steps to reproduce the issue
- Any potential impact

We will acknowledge receipt within 48 hours and provide an estimated timeline for a fix.

## Scope

This policy applies to the Open LOS codebase and its official packages. Third-party integrations and deployments are the responsibility of their operators.

## Security Considerations

Open LOS handles financial data. If you deploy it in production:

- Run behind a reverse proxy with TLS
- Use a persistent database (not in-memory SQLite)
- Restrict API access with authentication middleware
- Audit the `X-Actor` headers in your deployment
- Keep dependencies up to date
