include ../../scripts/paths.mk

.PHONY: test
test:
	$(NODE_BIN)/ts-scripts test

.PHONY: dist
dist:
	$(NODE_BIN)/ts-scripts build

.PHONY: format
format:
	$(NODE_BIN)/ts-scripts format

.PHONY: lint
lint:
	$(NODE_BIN)/ts-scripts lint
