# Smoke tests

No test runner is installed and none is added to `package.json`, so these stay
zero-cost for the Docker build. `npm run smoke` pulls `jsdom` with `--no-save`,
builds the harness through Vite (so the real aliases and JSX transform apply)
and runs it under Node.

    npm run smoke              # pages + interactions, against a stubbed API
    npm run smoke:components   # every UI component, rendered with mock props

`apistub.js` stands in for the backend and `sockstub.js` for Socket.IO, so the
tests exercise the real components, contexts and providers without a server.
