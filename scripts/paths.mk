SCRIPTS_DIR = $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
ROOT_DIR = $(shell dirname $(SCRIPTS_DIR))
NODE_BIN = "$(ROOT_DIR)/node_modules/.bin"
PACKAGES_DIR = "$(ROOT_DIR)/packages"
