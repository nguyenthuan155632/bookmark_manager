output "vpc_id" {
  value       = aws_vpc.main.id
  description = "ID of the provisioned VPC"
}

output "public_subnet_ids" {
  value       = values(aws_subnet.public)[*].id
  description = "Public subnet IDs"
}

output "private_subnet_ids" {
  value       = values(aws_subnet.private)[*].id
  description = "Private subnet IDs"
}

output "alb_dns_name" {
  value       = aws_lb.app.dns_name
  description = "Public DNS name for the Application Load Balancer"
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.this.name
  description = "Name of the ECS cluster"
}

output "ecs_service_name" {
  value       = aws_ecs_service.app.name
  description = "Name of the ECS service"
}

output "ecr_repository_url" {
  value       = local.ecr_repository_url
  description = "Repository URL used for container images"
}

output "db_endpoint" {
  value       = aws_db_instance.postgres.endpoint
  description = "Postgres endpoint hostname"
}

output "db_secret_values" {
  value = {
    username = var.db_username
    password = var.db_password
  }
  sensitive   = true
  description = "Database credentials supplied to Terraform"
}

output "codebuild_project_name" {
  value       = aws_codebuild_project.this.name
  description = "Name of the CodeBuild project"
}

output "database_url_parameter_name" {
  value       = aws_ssm_parameter.database_url.name
  description = "SSM parameter storing the DATABASE_URL connection string"
}

