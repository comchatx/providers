/**
 * pi's providers that get no package, each with why. The first seven are the product's `LEFT_OUT` (`src/shared/model-makers-generate.ts`),
 * which the proxy cannot carry, `typesafe` among them only because its package is written by hand: it holds Jev's client.
 */
export const NOT_GENERATED = Object.freeze({
  "amazon-bedrock": "SigV4-signed requests across two regional hosts",
  azure: "the endpoint is the tenant's own Azure resource",
  "cloudflare-ai-gateway": "the base URL is templated with the tenant's account and gateway",
  "cloudflare-workers-ai": "the base URL is templated with the tenant's account",
  "google-vertex": "application-default credentials and a location-templated host",
  "openai-codex": "a subscription login, not an API key",
  typesafe: "written by hand in packages/typesafe",
  radius: "its models are the organisation's, from the gateway per sign-in, which a package cannot write: it stays in the image",
});

/** The version of a generated package that no entry below moves on. */
export const VERSION = "0.1.1";

/**
 * What the image's block says of a vendor that pi's list does not, with what the Plugins page reads from a package's `comchatx` field
 * (its mark, card, search words and plans), and the version of each package moved past `VERSION`.
 */
export const SAID = Object.freeze({
  "ant-ling": { version: "0.1.2", comchatx: {"mark": {"logo": "antgroup"}, "aliases": ["蚂蚁", "百灵"]} },
  "anthropic": { version: "0.1.2", comchatx: {"card": {"name": "Claude", "vendor": "Anthropic", "description": {"en": "Claude is Anthropic's model family. Opus 5.5 is intended for demanding work, Sonnet 5 balances capability and cost, and Haiku 4.5 prioritises speed and lower cost. All three can read images and files.\n\nSuitable for long analyses, detailed instructions and work where accuracy matters more than model cost.", "zh": "Claude 是 Anthropic 的模型系列。Opus 5.5 适合要求较高的任务；Sonnet 5 兼顾能力和价格；Haiku 4.5 响应更快、价格更低。三者都能读取图片和文件。\n\n适合长篇分析、详细指令，以及准确性比模型费用更重要的任务。"}}, "mark": {"logo": "anthropic"}, "plans": ["Claude"]} },
  "baseten": { version: "0.1.2", comchatx: {"mark": {"logo": "baseten"}} },
  "cerebras": { version: "0.1.2", comchatx: {"mark": {"logo": "cerebras"}} },
  "deepseek": { version: "0.1.2", comchatx: {"card": {"vendor": "DeepSeek", "description": {"en": "DeepSeek V4 is an open-weights model from DeepSeek with lower pricing than flagship models.\n\nA lower-cost option for bulk work when response time is less important.", "zh": "DeepSeek V4 是 DeepSeek 的开放权重模型，价格低于旗舰模型。\n\n适合对速度要求不高、需要控制成本的批量任务。"}}, "mark": {"logo": "deepseek"}, "aliases": ["深度求索"]} },
  "fireworks": { version: "0.1.2", comchatx: {"mark": {"logo": "fireworks"}} },
  "github-copilot": { version: "0.1.2", comchatx: {"mark": {"logo": "githubcopilot"}, "plans": ["GitHub Copilot"]} },
  "google": { version: "0.1.2", comchatx: {"card": {"name": "Gemini", "vendor": "Google"}, "mark": {"logo": "google"}, "aliases": ["谷歌"]} },
  "groq": { version: "0.1.2", comchatx: {"mark": {"logo": "groq"}} },
  "huggingface": { version: "0.1.2", comchatx: {"mark": {"logo": "huggingface"}} },
  "meta": { version: "0.1.2", comchatx: {"mark": {"logo": "meta"}, "plans": ["Muse"]} },
  "minimax": { version: "0.1.2", comchatx: {"card": {"vendor": "MiniMax", "description": {"en": "MiniMax M3 is MiniMax's open-weights model.\n\nA lower-cost option for short questions and summaries.", "zh": "MiniMax M3 是 MiniMax 的开放权重模型。\n\n适合简短提问和摘要，价格较低。"}}, "mark": {"logo": "minimax"}, "aliases": ["稀宇"]} },
  "mistral": { version: "0.1.2", comchatx: {"card": {"vendor": "Mistral AI"}, "mark": {"logo": "mistral"}} },
  "moonshotai": { version: "0.1.2", comchatx: {"card": {"name": "Kimi", "vendor": "Moonshot AI", "keyName": "Moonshot", "description": {"en": "Kimi K3 is Moonshot AI's open-weights model for long documents and work that takes many steps.\n\nSuitable for long Chinese or English documents and tasks that take several steps in sequence.", "zh": "Kimi K3 是 Moonshot AI 的开放权重模型，适合处理长文档和需要很多步骤的工作。\n\n适合处理中英文长文档，以及需要连续完成多个步骤的任务。"}}, "mark": {"logo": "moonshot"}, "aliases": ["月之暗面"], "plans": ["Kimi Code"]} },
  "nvidia": { version: "0.1.2", comchatx: {"mark": {"logo": "nvidia"}} },
  "openai": { compat: Object.fromEntries(["gpt-6-astra", "gpt-6-luna", "gpt-6-sol", "gpt-6.1-sol"].map(id => [id, { supportsMidConvoEffort: false }])), version: "0.1.2", comchatx: {"card": {"name": "GPT", "vendor": "OpenAI", "description": {"en": "GPT is OpenAI's model family. GPT-6 Sol is designed for reasoning over long documents and tables, while GPT-6 Luna prioritises speed and lower cost. Both can read images and files.\n\nChoose Sol for long reports and multi-step instructions. Choose Luna for everyday questions and summaries.", "zh": "GPT 是 OpenAI 的模型系列。GPT-6 Sol 适合分析长文档和表格；GPT-6 Luna 响应更快、价格更低。两者都能读取图片和文件。\n\n长报告和多步骤任务可选 Sol；日常提问和摘要可选 Luna。"}}, "mark": {"logo": "openai"}, "aliases": ["ChatGPT"], "plans": ["ChatGPT"]} },
  "opencode": { version: "0.1.2", comchatx: {"mark": {"logo": "opencode"}} },
  "opencode-go": { version: "0.1.2", comchatx: {"mark": {"logo": "opencode"}} },
  "openrouter": { version: "0.1.2", comchatx: {"aggregator": true, "mark": {"logo": "openrouter"}} },
  "qwen-token-plan": { version: "0.1.2", comchatx: {"card": {"vendor": "Alibaba", "vendorZh": "阿里云"}, "mark": {"logo": "qwen"}, "aliases": ["阿里", "通义", "千问"]} },
  "together": { version: "0.1.2", comchatx: {"mark": {"logo": "together"}} },
  "vercel-ai-gateway": { version: "0.1.2", comchatx: {"mark": {"logo": "vercel"}} },
  "xai": { version: "0.1.2", comchatx: {"card": {"name": "Grok", "vendor": "xAI"}, "mark": {"logo": "xai"}, "plans": ["SuperGrok", "X Premium"]} },
  "xiaomi": { version: "0.1.2", comchatx: {"card": {"name": "MiMo", "vendor": "Xiaomi", "vendorZh": "小米"}, "mark": {"logo": "xiaomimimo"}, "aliases": ["小米"]} },
  "zai": { version: "0.1.2", comchatx: {"card": {"name": "GLM", "vendor": "Z.ai", "description": {"en": "GLM-5 is Z.ai's open-weights model for Chinese-language and coding tasks.\n\nSuitable for product listings and customer messages on Chinese-language marketplaces.", "zh": "GLM-5 是 Z.ai 的开放权重模型，适合中文和编程任务。\n\n适合中文电商平台的商品信息和客户消息。"}}, "mark": {"logo": "zai"}, "aliases": ["智谱"]} },
});
