include ../../scripts/paths.mk

.PHONY: build clean
build: bundle
clean: clean-bundle

.PHONY: clean-bundle
clean-bundle:
	rm -rf bundle

.PHONY: bundle
bundle: dist
	$(NODE_BIN)/cfb -e dist/index.js --source-map --main-field=browser --main-field=module --main-field=main
	touch -c bundle

.PHONY: sentry
sentry:
	$(NODE_BIN)/sentry-cli releases files "$(APP_NAME)@$(RELEASE_VERSION)" upload-sourcemaps bundle

deploy: sentry
