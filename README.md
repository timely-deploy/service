# Timely Deploy Service

[![Build status][build-image]][build-url]
[![Build coverage][coverage-image]][coverage-url]

> Tiny service for simplifying deployments with GitHub.

## Getting started

1. Install the [GitHub App](https://github.com/apps/timely-deploy) to trigger deployments.
2. Install the [action](https://github.com/timely-deploy/action) to trigger deployments.
3. Install the [status action](https://github.com/timely-deploy/status-action) to update deployment statuses.

## Development

```
make [clean | lint | format | test | install | build | deploy]
```

See [deploy.yml](.github/workflows/deploy.yml) for an example of deploying the service.

## License

MIT

[build-image]: https://img.shields.io/github/workflow/status/timely-deploy/action/CI/main
[build-url]: https://github.com/timely-deploy/action/actions/workflows/ci.yml?query=branch%3Amain
[coverage-image]: https://img.shields.io/codecov/c/gh/timely-deploy/action
[coverage-url]: https://codecov.io/gh/timely-deploy/action
