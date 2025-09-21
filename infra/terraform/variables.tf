variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
}

variable "project_name" {
  description = "Base name used for tagging and resource name prefixes"
  type        = string
  default     = "memorize-vault"
}

variable "environment" {
  description = "Deployment environment identifier (e.g. dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "availability_zones" {
  description = "List of availability zones to spread subnets across"
  type        = list(string)
  default     = []

  validation {
    condition     = length(var.availability_zones) == 0 || length(distinct(var.availability_zones)) >= 2
    error_message = "Provide at least two unique availability zones or leave the list empty to let Terraform choose."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default = [
    "10.20.0.0/24",
    "10.20.1.0/24"
  ]

  validation {
    condition     = length(var.public_subnet_cidrs) >= 2
    error_message = "Provide at least two public subnet CIDRs so the load balancer can span multiple AZs."
  }
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default = [
    "10.20.10.0/24",
    "10.20.11.0/24"
  ]

  validation {
    condition     = length(var.private_subnet_cidrs) >= 2
    error_message = "Provide at least two private subnet CIDRs so the database spans multiple AZs."
  }
}

variable "container_port" {
  description = "Port exposed by the container and load balancer"
  type        = number
  default     = 4001
}

variable "container_cpu" {
  description = "Fargate task CPU units"
  type        = number
  default     = 512
}

variable "container_memory" {
  description = "Fargate task memory in MiB"
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Desired number of ECS service tasks"
  type        = number
  default     = 2
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  description = "Postgres engine version to run on RDS"
  type        = string
  default     = "17.6"
}

variable "db_allocated_storage" {
  description = "Initial storage size for the database in GiB"
  type        = number
  default     = 20
}

variable "db_username" {
  description = "Username for the Postgres database"
  type        = string
}


variable "app_secret_environment" {
  description = "Map of additional application secrets to store in SSM Parameter Store"
  type        = map(string)
  default     = {}
}

variable "db_password" {
  description = "Password for the Postgres database"
  type        = string
  sensitive   = true
}

variable "db_backup_retention" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 7
}

variable "allowed_http_cidr_blocks" {
  description = "CIDR blocks allowed to reach the load balancer"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "enable_https" {
  description = "Toggle for creating HTTPS listener (requires ACM cert ARN)"
  type        = bool
  default     = false
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN used for HTTPS listener"
  type        = string
  default     = ""
}

variable "enable_auto_scaling" {
  description = "Toggle for ECS service auto scaling"
  type        = bool
  default     = true
}

variable "ecs_max_capacity" {
  description = "Maximum capacity for ECS auto scaling"
  type        = number
  default     = 4
}

variable "ecs_cpu_target" {
  description = "Target CPU utilization percentage for auto scaling"
  type        = number
  default     = 60
}

variable "codebuild_source_type" {
  description = "Type of CodeBuild source (e.g. GITHUB, CODEPIPELINE)"
  type        = string
  default     = "GITHUB"
}

variable "codebuild_source_location" {
  description = "CodeBuild source location (clone URL or ARN depending on type)"
  type        = string
}

variable "codebuild_buildspec" {
  description = "Path to the buildspec file within the repository"
  type        = string
  default     = "infra/buildspec.yml"
}

variable "codebuild_environment_image" {
  description = "Docker image for CodeBuild environment"
  type        = string
  default     = "aws/codebuild/standard:7.0"
}

variable "codebuild_compute_type" {
  description = "Compute type for CodeBuild (e.g. BUILD_GENERAL1_SMALL)"
  type        = string
  default     = "BUILD_GENERAL1_SMALL"
}

variable "codebuild_privileged_mode" {
  description = "Enable Docker daemon inside CodeBuild to build container images"
  type        = bool
  default     = true
}

variable "codebuild_service_role_arn" {
  description = "Optional IAM role ARN for CodeBuild (leave empty to create one)"
  type        = string
  default     = ""
}

variable "github_oauth_token" {
  description = "OAuth token used by CodeBuild to access GitHub (only when using GitHub source)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "ecr_image_tag" {
  description = "Default image tag deployed by ECS (typically provided by CodeBuild output)"
  type        = string
  default     = "latest"
}

variable "logs_retention_days" {
  description = "CloudWatch Logs retention in days"
  type        = number
  default     = 30
}

variable "enable_create_ecr" {
  description = "Set to false if you manage the ECR repository outside Terraform"
  type        = bool
  default     = true
}

variable "existing_ecr_repository" {
  description = "Existing ECR repository name to reuse when enable_create_ecr is false"
  type        = string
  default     = ""
}

variable "health_check_path" {
  description = "Path used by the load balancer health check"
  type        = string
  default     = "/"
}
