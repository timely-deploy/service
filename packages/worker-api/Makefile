include ../../scripts/paths.mk
include ../../scripts/node.mk
include ../../scripts/ts.mk
include ../../scripts/tf.mk
include ../../scripts/cf-worker.mk

APP_NAME = worker-api

export TF_VAR_api_hostname = $(API_HOSTNAME)
export TF_VAR_app_name = $(APP_NAME)
export TF_VAR_cloudflare_zone = $(CLOUDFLARE_ZONE)
export TF_VAR_github_app_id = $(GITHUB_APP_ID)
export TF_VAR_github_app_private_key = $(GITHUB_APP_PRIVATE_KEY)
export TF_VAR_github_webhook_secret = $(GITHUB_WEBHOOK_SECRET)
export TF_VAR_logflare_api_key = $(LOGFLARE_API_KEY)
export TF_VAR_release_version = $(RELEASE_VERSION)
export TF_VAR_sentry_dsn = $(SENTRY_DSN)
