resource "random_id" "db_snapshot" {
  byte_length = 4
}

resource "aws_db_subnet_group" "postgres" {
  name       = "${local.name_prefix}-db-subnets"
  subnet_ids = values(aws_subnet.private)[*].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-subnets"
  })
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-db"
  description = "Allow Postgres access from ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_service.id]
  }

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.codebuild.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_db_instance" "postgres" {
  identifier                = "${local.name_prefix}-db"
  db_name                   = substr(replace(local.project_slug, "-", ""), 0, 63)
  engine                    = "postgres"
  engine_version            = var.db_engine_version
  instance_class            = var.db_instance_class
  allocated_storage         = var.db_allocated_storage
  db_subnet_group_name      = aws_db_subnet_group.postgres.name
  vpc_security_group_ids    = [aws_security_group.rds.id]
  username                  = var.db_username
  password                  = var.db_password
  publicly_accessible       = false
  multi_az                  = false
  storage_encrypted         = true
  backup_retention_period   = var.db_backup_retention
  skip_final_snapshot       = false
  deletion_protection       = true
  final_snapshot_identifier = "${local.name_prefix}-final-${random_id.db_snapshot.hex}"

  tags = local.common_tags
}

resource "aws_ssm_parameter" "database_url" {
  name        = "/${local.name_prefix}/database_url"
  description = "Connection string for Memorize Vault application"
  type        = "SecureString"
  value       = "postgresql://${var.db_username}:${urlencode(var.db_password)}@${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/${aws_db_instance.postgres.db_name}"
  overwrite   = true

  tags = local.common_tags
}

