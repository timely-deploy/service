import { compose } from "throwback";
import { post } from "@borderless/fetch-router";
import { App } from "@octokit/app";
import { Octokit } from "@octokit/core";
import {
  WebhookEvent,
  WebhookEventMap,
  WebhookEventName,
} from "@octokit/webhooks-types";
import { background, withValue, Context } from "@borderless/context";
import * as zod from "zod";

declare const GITHUB_APP_ID: string;
declare const GITHUB_APP_PRIVATE_KEY: string;
declare const GITHUB_WEBHOOK_SECRET: string;
declare const LOGFLARE_API_KEY: string;

const DEPLOY_PREFIX = "@timely-deploy ";

/**
 * The comment webhook contains the association: https://docs.github.com/en/graphql/reference/enums#commentauthorassociation
 *
 * TODO(blakeembrey): Make configurable when "workflows" are supported.
 */
const VALID_USER_ASSOCIATION = new Set(["COLLABORATOR", "OWNER", "MEMBER"]);

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
      })
    );
  };
}

type AppContext = Context<{
  logger: (message: string, metadata?: Record<string, unknown>) => void;
}>;

const CONTEXT_KEY = Symbol("context");

interface RequestContext extends Request {
  [CONTEXT_KEY]: AppContext;
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
    return new Response(err.stack, { status: 500 });
  }
}

const app = new App({
  appId: GITHUB_APP_ID,
  privateKey: GITHUB_APP_PRIVATE_KEY,
  webhooks: {
    secret: GITHUB_WEBHOOK_SECRET,
  },
});

/**
 * Handle commit comments to automatically deploy.
 */
async function handleCommitComment(
  context: AppContext,
  event: WebhookEventMap["commit_comment"]
) {
  if (!VALID_USER_ASSOCIATION.has(event.comment.author_association)) {
    context.value("logger")(
      `Commit skipped: ${event.comment.id} | invalid_user_association | ${event.comment.author_association}`
    );

    return;
  }

  const [owner, repo] = event.repository.full_name.split("/");
  const sha = event.comment.commit_id;
  const body = event.comment.body;
  const firstLine = body.split(/\r?\n/, 1)[0].trim();
  if (!firstLine.startsWith(DEPLOY_PREFIX)) {
    context.value("logger")(
      `Commit skipped: ${event.comment.id} | invalid_prefix | ${firstLine}`
    );

    return;
  }

  const environment = firstLine.slice(DEPLOY_PREFIX.length);
  if (environment.includes(" ")) {
    context.value("logger")(
      `Commit skipped: ${event.comment.id} | invalid_environment | ${environment}`
    );

    return;
  }

  await triggerDeployment(context, { owner, repo, sha, environment });

  // React to show that the app saw the command.
  if (event.installation) {
    const kit = await app.getInstallationOctokit(event.installation.id);

    await kit.request(
      "POST /repos/{owner}/{repo}/comments/{comment_id}/reactions",
      {
        owner,
        repo,
        comment_id: event.comment.id,
        content: "rocket",
        mediaType: {
          previews: ["squirrel-girl"],
        },
      }
    );
  }
}

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
  context: AppContext,
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
  post(
    "/_/github/webhook",
    async (req: RequestContext): Promise<Response> => {
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

      const event = eventName as WebhookEventName;
      const body = JSON.parse(payload) as WebhookEvent;

      req[CONTEXT_KEY].value("logger")(
        `Github webhook event: ${eventName} | ${deliveryId}`,
        {
          body,
        }
      );

      if (event === "commit_comment") {
        await handleCommitComment(
          req[CONTEXT_KEY],
          body as WebhookEventMap["commit_comment"]
        );
      }

      return new Response(null, { status: 200 });
    }
  ),
  post("/api/github/deploy", async (req: RequestContext) => {
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
