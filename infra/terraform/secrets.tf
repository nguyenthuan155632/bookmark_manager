resource "aws_ssm_parameter" "app_secret_env" {
  for_each = var.app_secret_environment

  name        = "/${local.name_prefix}/${each.key}"
  description = "${each.key} value for ${var.project_name}"
  type        = "SecureString"
  value       = each.value
  overwrite   = true

  tags = local.common_tags
}
