import { compose } from "throwback";
import { post } from "@borderless/fetch-router";
import { App } from "@octokit/app";
import { Octokit } from "@octokit/core";
import { WebhookEvent } from "@octokit/webhooks-types";
import { background, withValue, Context } from "@borderless/context";
import * as zod from "zod";

declare const GITHUB_APP_ID: string;
declare const GITHUB_APP_PRIVATE_KEY: string;
declare const GITHUB_WEBHOOK_SECRET: string;
declare const LOGFLARE_API_KEY: string;

interface LoggerOptions {
  apiKey: string;
  source: string;
}

function createLogger(event: FetchEvent, { apiKey, source }: LoggerOptions) {
  return function log(message: string, metadata?: Record<string, unknown>) {
    event.waitUntil(
      fetch("https://api.logflare.app/logs", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
          "User-Agent": "Cloudflare Worker",
        },
        body: JSON.stringify({
          source: source,
          log_entry: message,
          metadata: metadata,
        }),
      }).then(() => undefined)
    );
  };
}

interface ContextValue {
  logger: (message: string, metadata?: Record<string, unknown>) => void;
}

const CONTEXT_KEY = Symbol("context");

interface RequestContext extends Request {
  [CONTEXT_KEY]: Context<ContextValue>;
}

async function handler(event: FetchEvent): Promise<Response> {
  const logger = createLogger(event, {
    apiKey: LOGFLARE_API_KEY,
    source: "7a535e6a-9286-4c44-90d8-7d1150bbdb37",
  });

  const context = withValue(background, "logger", logger);

  try {
    const res = await router(
      Object.assign(event.request, { [CONTEXT_KEY]: context }),
      () => new Response(null, { status: 404 })
    );

    return res;
  } catch (err) {
    return new Response(null, { status: 500 });
  }
}

const app = new App({
  appId: GITHUB_APP_ID,
  privateKey: GITHUB_APP_PRIVATE_KEY,
  webhooks: {
    secret: GITHUB_WEBHOOK_SECRET,
  },
});

interface DeploymentOptions {
  owner: string;
  repo: string;
  sha: string;
  environment: string;
}

/**
 * Trigger a deployment.
 */
async function triggerDeployment(
  context: Context<ContextValue>,
  options: DeploymentOptions
) {
  // Get the installation kit to trigger a deployment.
  const installation = await app.octokit.request(
    "GET /repos/{owner}/{repo}/installation",
    {
      owner: options.owner,
      repo: options.repo,
    }
  );

  context.value("logger")(`Github deploy installation`, {
    installation,
  });

  const kit = await app.getInstallationOctokit(installation.data.id);

  // Trigger deployment as the GitHub App.
  const deployment = await kit.request(
    "POST /repos/{owner}/{repo}/deployments",
    {
      owner: options.owner,
      repo: options.repo,
      environment: options.environment,
      ref: options.sha,
      required_contexts: [],
      mediaType: {
        previews: ["flash-preview", "ant-man-preview"],
      },
    }
  );

  context.value("logger")(`Github repo deployment`, {
    deployment,
  });
}

const deploySchema = zod.object({
  repository: zod.string(),
  ref: zod.string(),
  environment: zod.string(),
  token: zod.string(),
});

const router = compose([
  post("/_/github/webhook", async (req: RequestContext): Promise<Response> => {
    const eventName = req.headers.get("x-github-event") ?? "";
    const deliveryId = req.headers.get("x-github-delivery") ?? "";
    const signatureSha256 = req.headers.get("x-hub-signature-256") ?? "";
    const payload = await req.text();

    const verify = await app.webhooks.verify(
      payload,
      signatureSha256.replace(/^sha256=/, "")
    );
    if (!verify) {
      return new Response(null, { status: 401 });
    }

    const body = JSON.parse(payload) as WebhookEvent;

    req[CONTEXT_KEY].value("logger")(
      `Github webhook event: ${eventName} | ${deliveryId}`,
      {
        body,
      }
    );

    return new Response(null, { status: 200 });
  }),
  post("/github/deploy", async (req: RequestContext) => {
    const body = await req.json();
    const { repository, ref, environment, token } = deploySchema.parse(body);
    const [owner, repo] = repository.split("/");
    const tokenKit = new Octokit({ auth: token });

    // Verify access to commit before creating a deployment.
    const commit = await tokenKit.request(
      "GET /repos/{owner}/{repo}/commits/{ref}",
      {
        owner,
        repo,
        ref,
      }
    );

    req[CONTEXT_KEY].value("logger")(`Github repo commit`, {
      commit,
    });

    await triggerDeployment(req[CONTEXT_KEY], {
      owner,
      repo,
      environment,
      sha: commit.data.sha,
    });

    return new Response(null, { status: 201 });
  }),
]);

addEventListener("fetch", (event) => {
  event.respondWith(handler(event));
});
