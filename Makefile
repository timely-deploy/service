include scripts/paths.mk
include scripts/node.mk

ALL_PACKAGES = $(wildcard packages/*)
SUBTARGETS = clean clean-deps lint format test generate
DEP_SUBTARGETS = install dist build deploy deps destroy

# Run all packages when not defined.
PACKAGES ?= $(ALL_PACKAGES)

# Lists dependents affected by a change.
.PHONY: affected
affected:
ifeq ($(PACKAGES),)
	@:
else
	@for package in $(ALL_PACKAGES); do \
		if $(MAKE) deps PACKAGES=$$package | grep -F $(PACKAGES:%=-e %) >/dev/null; then \
			echo $$package; \
		fi \
	done
endif

# Dependencies.
ifneq (,$(findstring $(MAKECMDGOALS),$(DEP_SUBTARGETS)))

endif

# Proxy sub-target commands through `make`.
.PHONY: $(SUBTARGETS) $(DEP_SUBTARGETS) $(ALL_PACKAGES)
$(SUBTARGETS) $(DEP_SUBTARGETS): $(PACKAGES)
$(ALL_PACKAGES):
ifeq ($(MAKECMDGOALS), deps)
	@echo $@
else
	@if $(MAKE) -n -C $@ $(MAKECMDGOALS) 1>/dev/null 2>/dev/null; then \
		echo "make -C $@ $(MAKECMDGOALS)"; \
		$(MAKE) -C $@ $(MAKECMDGOALS); \
	fi
endif
