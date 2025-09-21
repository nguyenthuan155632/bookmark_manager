locals {
  project_slug = lower(replace(var.project_name, " ", "-"))
  env_slug     = lower(var.environment)

  name_prefix = "${local.project_slug}-${local.env_slug}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
