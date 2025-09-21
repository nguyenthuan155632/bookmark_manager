# Memorize Vault Terraform Stack

Infrastructure as code for deploying the Memorize Vault application on AWS. The stack provisions networking, container orchestration with ECS Fargate, a managed Postgres database (RDS), and a CodeBuild project to build and publish Docker images to ECR and trigger rolling deployments.

## What Gets Created

- Networking: VPC with public/private subnets, NAT gateway, and routing
- Compute: ECS cluster, Fargate service, IAM task roles, and CloudWatch log groups
- Load balancing: Application Load Balancer, target group, listeners, and security groups
- Data: RDS Postgres instance in private subnets with automated backups
- Secrets: SecureString SSM parameter holding the database connection string
- CI build: ECR repository (optional), CodeBuild project, and buildspec for image pushes

## Prerequisites

- Terraform 1.5+
- AWS account with credentials configured (via environment variables or profile)
- At least two availability zones in the region (public/private subnets and RDS must span distinct AZs)
- An ACM certificate in the target region when `enable_https = true`
- GitHub OAuth token (or appropriate source credentials) if CodeBuild pulls from a private repo
- The application container image must expose port `4001` by default; update `container_port` if needed

## Directory Layout

```
infra/
├─ terraform/
│  ├─ *.tf                  # Terraform configuration files
│  ├─ README.md             # This guide
│  ├─ terraform.tfvars.example
│  └─ backend.hcl.example   # Remote state config template
└─ buildspec.yml            # CodeBuild container pipeline
```

## Getting Started

1. Copy the example variable file and customize values:

   ```bash
   cd infra/terraform
   cp terraform.tfvars.example terraform.tfvars
   # edit terraform.tfvars with environment-specific values
   ```

   Ensure `availability_zones`, `public_subnet_cidrs`, and `private_subnet_cidrs` describe at least two distinct AZs (required by the load balancer and RDS).

2. (Recommended) Enable remote state by copying the backend template and supplying your S3 bucket details. If you want Terraform to enforce state locking, create a DynamoDB table (hash key `LockID`) and uncomment `dynamodb_table` in `backend.hcl`.

   ```bash
   cp backend.hcl.example backend.hcl
   # edit backend.hcl with bucket, key, region, and (optionally) lock table values
   ```

3. Initialize and review the plan (pass the backend config if you created it):

   ```bash
   terraform init -backend-config=backend.hcl
   terraform plan
   ```

   If you are testing locally without remote state, you can omit the `-backend-config` flag.

4. Apply when ready:

   ```bash
   terraform apply
   ```

5. After the initial deployment, ensure that your CI workflow (CodeBuild) has access to the repository source. Trigger a build to publish the first image or push a commit to the tracked branch.

## Important Variables

Key inputs are defined in `variables.tf`. Notable settings:

- `project_name`, `environment`: influence resource names and tagging
- `container_port`, `container_cpu`, `container_memory`, `desired_count`: ECS service sizing
- `db_engine_version`, `db_username`, `db_password`: database configuration (Terraform also writes a SecureString `DATABASE_URL` parameter)
- `codebuild_source_location`, `codebuild_source_type`, `codebuild_buildspec`: configure CodeBuild source and script
- `enable_https`, `acm_certificate_arn`: enable TLS for the load balancer
- `enable_create_ecr` / `existing_ecr_repository`: reuse an existing ECR repo if desired

Refer to `variables.tf` for defaults and descriptions of every input.

## Outputs

Running `terraform apply` emits outputs with useful connection values:

- `alb_dns_name`: public endpoint for the application
- `db_endpoint`: host for the Postgres instance
- `ecs_cluster_name`, `ecs_service_name`: ECS identifiers used by CI/CD
- `codebuild_project_name`: link to your build project
- `database_url_parameter_name`: location of the DATABASE_URL SecureString

## Post-Deployment Notes

- The ECS task definition pins the container image tag via the `ecr_image_tag` variable (defaults to `latest`). CodeBuild pushes both a unique commit tag and `latest`, then forces a new ECS deployment.
- Database deletion protection is enabled by default. To destroy the database you must disable `deletion_protection` and decide whether to keep the final snapshot.
- Terraform writes the primary `DATABASE_URL` to AWS Systems Manager Parameter Store. Rotate credentials by updating the parameter (and rerun `terraform apply` if you want Terraform to own the value).
- If you need additional secrets, prefer AWS Secrets Manager or SSM Parameter Store and inject them via task definition updates or AWS AppConfig.

## Cleaning Up

Destroy the stack (after disabling any safeguards like `deletion_protection`) with:

```bash
terraform destroy
```

Be sure to empty any S3 buckets or ECR images if you later add them outside this Terraform configuration.
