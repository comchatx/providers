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

- **A first publish is one run.** npm trusted publishing can be set up only on a package that already exists, so `publish-bootstrap.yml`, pressed by hand under Actions, publishes every package not yet on npm, on the repository's token.
- **After that,** once the section below is done, `release.yml` publishes one package on a tag naming it and its version: `@comchatx/anthropic@0.1.0`.

## After the first publish

This needs npm 11.15 or later: check with `npm --version`, and upgrade with `npm install -g npm@latest`.

Paste this once into a terminal signed in to npm with the account that owns `@comchatx`. At the first package npm asks for 2FA: enable the website's option to skip 2FA for the next 5 minutes, or it will ask again for each package. The loop says each package trusts `release.yml` on this repository, and it stops at the first failure, naming the package.

```sh
for name in \
  @comchatx/providers \
  @comchatx/ant-ling \
  @comchatx/anthropic \
  @comchatx/baseten \
  @comchatx/cerebras \
  @comchatx/deepseek \
  @comchatx/fireworks \
  @comchatx/github-copilot \
  @comchatx/google \
  @comchatx/groq \
  @comchatx/huggingface \
  @comchatx/kimi-coding \
  @comchatx/meta \
  @comchatx/minimax \
  @comchatx/minimax-cn \
  @comchatx/mistral \
  @comchatx/moonshotai \
  @comchatx/moonshotai-cn \
  @comchatx/nvidia \
  @comchatx/openai \
  @comchatx/opencode \
  @comchatx/opencode-go \
  @comchatx/openrouter \
  @comchatx/qwen-token-plan \
  @comchatx/qwen-token-plan-cn \
  @comchatx/qwen-token-plan-individual \
  @comchatx/together \
  @comchatx/typesafe \
  @comchatx/vercel-ai-gateway \
  @comchatx/xai \
  @comchatx/xiaomi \
  @comchatx/xiaomi-token-plan-ams \
  @comchatx/xiaomi-token-plan-cn \
  @comchatx/xiaomi-token-plan-sgp \
  @comchatx/zai \
  @comchatx/zai-coding-cn
do
  npm trust github "$name" --file release.yml --repo comchatx/providers --allow-publish --yes || { echo "failed: $name"; break; }
  sleep 2
done
```

`--file` takes the workflow's file name; npm refuses a path. Once this is done, `publish-bootstrap.yml` is removed, so `release.yml` alone publishes.
