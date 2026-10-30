# ComChatX providers

pi packages that bring a model vendor into a ComChatX box. There is one package per pi provider, named by pi's provider id: `@comchatx/anthropic`, `@comchatx/openrouter`.

## What a package is

A manifest and one call. Its extension calls `redirect` from `@comchatx/providers`, which points pi's provider at the box's loopback proxy with a placeholder key. Keys never enter the box, and the proxy chooses who pays.

- pi's models stay pi's. Each keeps its own path, and a vendor whose models sit on more than one path registers pi's own list with those paths.
- Turning a package off or removing it takes the vendor away at the next reload.

`@comchatx/typesafe` is the one written by hand: it also holds `askJev`, the client for TypeSafe's classifier, for other packages to depend on.

Radius has no package: its models are the organisation's, from the gateway per sign-in, and stay in the image.

## How one is generated

`npm run generate` writes `packages/<provider>/` from `template/`, for every provider of the pinned pi's registry except those `scripts/vendors.mjs` names with why. CI fails if the packages differ from what it writes. Never edit a generated package by hand.

## Publishing

- **A first publish is by hand.** npm trusted publishing can be set up only on a package that already exists.
- **After that,** `release.yml` publishes one package on a tag naming it and its version: `@comchatx/anthropic@0.1.0`.
