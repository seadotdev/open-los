# Contributing to Open LOS

Thanks for your interest in contributing to Open LOS.

## Getting Started

```bash
npm install
npm test
```

## Development Workflow

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run the test suite: `npm test`
4. Run type checking: `npm run typecheck`
5. Submit a pull request

## Project Structure

- `packages/core/` — Domain logic, database schema, services
- `packages/api/` — Hono HTTP server and route handlers
- `packages/conformance/` — YAML-driven test suites
- `packages/agent/` — AI agent orchestration
- `packages/chat/` — Slack/Teams chat interface

## Testing

We use YAML-driven conformance tests. To add a test, create or edit a YAML file in `conformance/cases/` and run:

```bash
npm run test:conformance
```

For quick iteration:

```bash
npm run test:smoke
```

## Code Style

- TypeScript strict mode
- No `any` types — use `unknown` and narrow
- Pure functions where possible
- Financial calculations must be deterministic (no AI)

## Pull Requests

- Keep PRs focused on a single change
- Include tests for new functionality
- Update the OpenAPI spec (`openapi/v1.yaml`) if adding/changing endpoints
- Ensure `npm test` and `npm run typecheck` pass

## Reporting Issues

Use [GitHub Issues](https://github.com/seadotdev/open-los/issues) to report bugs or request features.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
