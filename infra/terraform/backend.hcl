bucket         = "vensera-infra"
key            = "memorize-vault/prod/terraform.tfstate"
region         = "ap-northeast-1"
encrypt        = true

# Uncomment to enable DynamoDB-based state locking (recommended for shared envs)
# dynamodb_table = "your-tf-lock-table"

# Optional profile if you use named AWS credentials
profile = "vensera"
