.PHONY: deploy destroy format
deploy: tf-deploy
format: tf-format
destroy: tf-destroy

.PHONY: tf-deploy
tf-deploy:
	$(MAKE) tf-init
	$(MAKE) tf-workspace
	$(MAKE) tf-plan
	$(MAKE) tf-apply

.PHONY: tf-destroy
tf-destroy:
	$(MAKE) tf-deploy TF_VARS="$(TF_VARS) -destroy"

.PHONY: tf-init
tf-init:
	cd terraform && terraform init -input=false

.PHONY: tf-workspace
tf-workspace:
	cd terraform && (terraform workspace select $(WORKSPACE) || terraform workspace new $(WORKSPACE))

.PHONY: tf-plan
tf-plan:
	cd terraform && terraform plan $(TF_VARS) -input=false -out terraform.tfplan

.PHONY: tf-apply
tf-apply:
	cd terraform && terraform apply terraform.tfplan

.PHONY: tf-format
tf-format:
	terraform fmt terraform/
