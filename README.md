# ComChatX providers

Packages for the model cards on ComChatX's Plugins page, of two kinds:

- **A provider's package**, one per pi provider, named by pi's provider id: `@comchatx/anthropic`, `@comchatx/openrouter`. It brings a model vendor into a ComChatX box.
- **A card's package**, one per model card no provider's package serves, named `card-` and the card's id: `@comchatx/card-cohere`. It holds the card's words and mark for the Plugins page, and nothing else.

## What a package is

A manifest and one call. Its extension calls `redirect` from `@comchatx/providers`, which points pi's provider at the box's loopback proxy with a placeholder key. Keys never enter the box, and the proxy chooses who pays.

- pi's models stay pi's. Each keeps its own path, and a vendor whose models sit on more than one path registers pi's own list with those paths.
- Turning a package off or removing it takes the vendor away at the next reload.
- No package carries the `pi-package` keyword, so none is listed in pi's gallery or on ComChatX's Plugins page: a seller adds a vendor by its key or sign-in on its maker card, and ComChatX installs the package by name.

`@comchatx/typesafe` is the one written by hand: it also holds `askJev`, the client for TypeSafe's classifier, for other packages to depend on.

Radius has no package: its models are the organisation's, from the gateway per sign-in, and stay in the image.

A card's package is a manifest, its `comchatx` field and the notice: `"pi": {}`, no extension and no dependency. Its card's models come through the balance at OpenRouter, so pi registers no provider for it, and no computer installs it. The Plugins page reads it on npm as it reads a provider's: the card's words, its downloads, its update and its links.

## How one is generated

`npm run generate` writes `packages/<provider>/` from `template/`, for every provider of the pinned pi's registry except those `scripts/vendors.mjs` names with why, and `packages/card-<id>/` from `template-card/`, for every card `scripts/cards.json` names, with its words from `CARD_SAID` in `scripts/vendors.mjs`. CI fails if the packages differ from what it writes. Never edit a generated package by hand.

`scripts/cards.json` is copied from the product: `npm run copy-cards -- <path to the comchatx checkout>` writes the cards its `src/shared/model-makers.json` lists with no provider, each with its name. Never edit it by hand.

## Publishing

Packages are published by `release.yml` through npm trusted publishing: one package on a tag naming its directory under `packages/` and its version, joined by `-`: `anthropic-0.1.0`, `xiaomi-token-plan-sgp-0.1.1`. The package is published from its own directory.

A package npm has never held cannot come through `release.yml`: trusted publishing is set on a package that exists. Its first version goes out by `publish-bootstrap.yml`, pressed by hand under Actions with the `NPM_TOKEN` secret, which publishes every package not yet on npm at its version and skips the rest. No trust follows it: a package's trust is set in the same sitting as its first tag for `release.yml`, because npm expires a trust that publishes nothing within 2 days (below). `publish-bootstrap.yml` stays: once its token lapses it publishes nothing, and a new card's first version needs it again.

`NPM_TOKEN` publishes only if it is a granular access token, on npmjs.com under Access Tokens, that has all three of:

- **Packages and scopes**: **Read and write (publish and stage)**, for the scope `@comchatx`;
- **Expiration**: a date still ahead;
- **Bypass two-factor authentication**: checked. npm leaves it unchecked by default, and without it a publish from the workflow asks for a second factor nobody can give.

If any of the three is not so, or cannot be read, make a fresh one with exactly those three, **Organizations** left at **No access**, and the shortest expiry that covers the run, and put it in with `gh secret set NPM_TOKEN --repo comchatx/providers`.

### A new card

A card the product gains with no provider's package costs, as the tests stand today:

1. **Here, a pull request.** `npm run copy-cards -- <path to the comchatx checkout>` from a checkout of the product's `main`, then `npm run generate`. Tests then fail until they are changed in the same pull request: the count of 27 card packages in `test/generate.test.ts`, `test/redirect.test.ts` and `test/publish.test.ts`, the count of 63 tarballs in `test/publish.test.ts`, and, where the card has words, the equality of `CARD_SAID` with `test/fixtures/maker-cards.json`. That fixture is the product's file as the 18 cards' words left it; a new card's words are signed apart, so the test changes to hold the 18 as they were and the new card beside them, never the fixture rewritten as if the product had held them.
2. **The product, a pull request.** The card joins `src/shared/maker-cards.json`'s `packaged`, whose test fails until it does, and `provider-packages.test.ts`'s count of 27 moves with it.
3. **Jack's steps.** The merge sentences; the token check above; a press of Run workflow on `publish-bootstrap.yml`.
4. **At the card's first later release.** Its `npm trust` line, below, in the same sitting as its tag.

Nothing checks that the two repositories agree: each repository's tests hold its own copy, so a card can be named in the product and never published here, or published and never trusted, while both test runs pass. Its later versions go out by a tag, as every package's do.

## Trust, at a package's first tag

npm's page (https://docs.npmjs.com/trusted-publishers): "A newly created trusted publisher configuration must complete its first successful publish within 2 days." One left unused expires, can no longer be used or edited, and is deleted and made again. So a package's trust is set in the same sitting as its first tag for `release.yml`: the trust line, then the tag.

This needs npm 11.15 or later: check with `npm --version`, and upgrade with `npm install -g npm@latest`. Run it in a terminal signed in to npm with the account that owns `@comchatx`; npm asks for 2FA.

The line for one package is the loop's body with its name: `npm trust github @comchatx/<directory> --file release.yml --repo comchatx/providers --allow-publish --yes`. The loop runs it for every card's package, for a sitting that tags them all; at its first package, enable the website's option to skip 2FA for the next 5 minutes, or it asks again for each. It stops at the first failure, naming the package.

```sh
for name in \
  @comchatx/card-aion-labs \
  @comchatx/card-amazon \
  @comchatx/card-bytedance-seed \
  @comchatx/card-cohere \
  @comchatx/card-dots-studio \
  @comchatx/card-elorian \
  @comchatx/card-fireworks \
  @comchatx/card-ibm-granite \
  @comchatx/card-inception \
  @comchatx/card-liquid \
  @comchatx/card-meituan \
  @comchatx/card-nex-agi \
  @comchatx/card-nvidia \
  @comchatx/card-particle-ai \
  @comchatx/card-perceptron \
  @comchatx/card-prism-ml \
  @comchatx/card-recursive \
  @comchatx/card-reflection \
  @comchatx/card-rekaai \
  @comchatx/card-relace \
  @comchatx/card-sakana \
  @comchatx/card-stepfun \
  @comchatx/card-tencent \
  @comchatx/card-thinkingmachines \
  @comchatx/card-unbiased \
  @comchatx/card-upstage \
  @comchatx/card-xingchen-agi
do
  npm trust github "$name" --file release.yml --repo comchatx/providers --allow-publish --yes || { echo "failed: $name"; break; }
  sleep 2
done
```
