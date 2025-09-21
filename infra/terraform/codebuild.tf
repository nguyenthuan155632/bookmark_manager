resource "aws_cloudwatch_log_group" "codebuild" {
  name              = "/aws/codebuild/${local.name_prefix}"
  retention_in_days = var.logs_retention_days
  tags              = local.common_tags
}

resource "aws_iam_role" "codebuild" {
  count = var.codebuild_service_role_arn == "" ? 1 : 0

  name = "${local.name_prefix}-codebuild"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "codebuild.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "codebuild" {
  count = var.codebuild_service_role_arn == "" ? 1 : 0

  name = "${local.name_prefix}-codebuild"
  role = aws_iam_role.codebuild[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:RegisterTaskDefinition",
          "ecs:DeregisterTaskDefinition",
          "ecs:UpdateService"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = [
          aws_iam_role.ecs_task_execution.arn,
          aws_iam_role.ecs_task.arn
        ]
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "ecs-tasks.amazonaws.com"
          }
        }
      }
    ]
  })
}

locals {
  codebuild_role_arn = var.codebuild_service_role_arn != "" ? var.codebuild_service_role_arn : aws_iam_role.codebuild[0].arn
}

resource "aws_codebuild_project" "this" {
  name          = "${local.name_prefix}-build"
  description   = "Builds and deploys ${var.project_name} container image"
  service_role  = local.codebuild_role_arn
  build_timeout = 60

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type                = var.codebuild_compute_type
    image                       = var.codebuild_environment_image
    type                        = "LINUX_CONTAINER"
    privileged_mode             = var.codebuild_privileged_mode
    image_pull_credentials_type = "CODEBUILD"

    environment_variable {
      name  = "AWS_REGION"
      value = var.aws_region
    }

    environment_variable {
      name  = "ECR_REPOSITORY_URL"
      value = local.ecr_repository_url
    }

    environment_variable {
      name  = "ECS_CLUSTER_NAME"
      value = aws_ecs_cluster.this.name
    }

    environment_variable {
      name  = "ECS_SERVICE_NAME"
      value = aws_ecs_service.app.name
    }
  }

  logs_config {
    cloudwatch_logs {
      group_name  = aws_cloudwatch_log_group.codebuild.name
      stream_name = local.name_prefix
      status      = "ENABLED"
    }
  }

  source {
    type            = var.codebuild_source_type
    location        = var.codebuild_source_location
    git_clone_depth = 1
    buildspec       = var.codebuild_buildspec

    dynamic "auth" {
      for_each = lower(var.codebuild_source_type) == "github" && var.github_oauth_token != "" ? [1] : []
      content {
        type     = "OAUTH"
        resource = var.github_oauth_token
      }
    }
  }

  tags = local.common_tags
}
