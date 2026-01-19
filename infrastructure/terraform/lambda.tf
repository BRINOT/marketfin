# Lambda Functions for Webhook Processing

# Lambda IAM Role
resource "aws_iam_role" "lambda" {
  name = "marketfin-lambda-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "lambda_sqs" {
  name = "sqs-access"
  role = aws_iam_role.lambda.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.webhooks.arn,
          aws_sqs_queue.webhooks_dlq.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_secrets" {
  name = "secrets-access"
  role = aws_iam_role.lambda.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.webhook_secrets.arn
        ]
      }
    ]
  })
}

# SQS Queues
resource "aws_sqs_queue" "webhooks" {
  name                       = "marketfin-webhooks"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 1209600 # 14 days
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 300
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.webhooks_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue" "webhooks_dlq" {
  name                      = "marketfin-webhooks-dlq"
  message_retention_seconds = 1209600 # 14 days
}

# Webhook Secrets
resource "aws_secretsmanager_secret" "webhook_secrets" {
  name = "marketfin/webhook-secrets"
}

# Lambda Security Group
resource "aws_security_group" "lambda" {
  name        = "marketfin-lambda-sg"
  description = "Security group for Lambda functions"
  vpc_id      = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Lambda Functions
resource "aws_lambda_function" "webhook_mercado_livre" {
  function_name = "marketfin-webhook-mercado-livre"
  role          = aws_iam_role.lambda.arn
  handler       = "handlers/mercado-livre.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256
  
  filename         = "${path.module}/lambda-placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda-placeholder.zip")
  
  vpc_config {
    subnet_ids         = module.vpc.private_subnets
    security_group_ids = [aws_security_group.lambda.id]
  }
  
  environment {
    variables = {
      SQS_QUEUE_URL = aws_sqs_queue.webhooks.url
      NODE_ENV      = "production"
    }
  }
}

resource "aws_lambda_function" "webhook_amazon" {
  function_name = "marketfin-webhook-amazon"
  role          = aws_iam_role.lambda.arn
  handler       = "handlers/amazon.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256
  
  filename         = "${path.module}/lambda-placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda-placeholder.zip")
  
  vpc_config {
    subnet_ids         = module.vpc.private_subnets
    security_group_ids = [aws_security_group.lambda.id]
  }
  
  environment {
    variables = {
      SQS_QUEUE_URL = aws_sqs_queue.webhooks.url
      NODE_ENV      = "production"
    }
  }
}

resource "aws_lambda_function" "webhook_shopee" {
  function_name = "marketfin-webhook-shopee"
  role          = aws_iam_role.lambda.arn
  handler       = "handlers/shopee.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256
  
  filename         = "${path.module}/lambda-placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda-placeholder.zip")
  
  vpc_config {
    subnet_ids         = module.vpc.private_subnets
    security_group_ids = [aws_security_group.lambda.id]
  }
  
  environment {
    variables = {
      SQS_QUEUE_URL = aws_sqs_queue.webhooks.url
      NODE_ENV      = "production"
    }
  }
}

resource "aws_lambda_function" "webhook_processor" {
  function_name = "marketfin-webhook-processor"
  role          = aws_iam_role.lambda.arn
  handler       = "handlers/processor.handler"
  runtime       = "nodejs20.x"
  timeout       = 300
  memory_size   = 512
  
  filename         = "${path.module}/lambda-placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda-placeholder.zip")
  
  vpc_config {
    subnet_ids         = module.vpc.private_subnets
    security_group_ids = [aws_security_group.lambda.id]
  }
  
  environment {
    variables = {
      DATABASE_URL = "placeholder" # Will be set via secrets
      REDIS_URL    = "placeholder"
      NODE_ENV     = "production"
    }
  }
}

# SQS Trigger for Processor Lambda
resource "aws_lambda_event_source_mapping" "webhook_processor" {
  event_source_arn = aws_sqs_queue.webhooks.arn
  function_name    = aws_lambda_function.webhook_processor.arn
  batch_size       = 10
  
  scaling_config {
    maximum_concurrency = 50
  }
}

# API Gateway for Webhooks
resource "aws_apigatewayv2_api" "webhooks" {
  name          = "marketfin-webhooks-api"
  protocol_type = "HTTP"
  
  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["POST"]
    allow_headers = ["*"]
  }
}

resource "aws_apigatewayv2_stage" "webhooks" {
  api_id      = aws_apigatewayv2_api.webhooks.id
  name        = "$default"
  auto_deploy = true
  
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
    })
  }
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/marketfin-webhooks"
  retention_in_days = 14
}

# Lambda Integrations
resource "aws_apigatewayv2_integration" "mercado_livre" {
  api_id                 = aws_apigatewayv2_api.webhooks.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.webhook_mercado_livre.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "amazon" {
  api_id                 = aws_apigatewayv2_api.webhooks.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.webhook_amazon.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "shopee" {
  api_id                 = aws_apigatewayv2_api.webhooks.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.webhook_shopee.invoke_arn
  payload_format_version = "2.0"
}

# Routes
resource "aws_apigatewayv2_route" "mercado_livre" {
  api_id    = aws_apigatewayv2_api.webhooks.id
  route_key = "POST /webhooks/mercado-livre"
  target    = "integrations/${aws_apigatewayv2_integration.mercado_livre.id}"
}

resource "aws_apigatewayv2_route" "amazon" {
  api_id    = aws_apigatewayv2_api.webhooks.id
  route_key = "POST /webhooks/amazon"
  target    = "integrations/${aws_apigatewayv2_integration.amazon.id}"
}

resource "aws_apigatewayv2_route" "shopee" {
  api_id    = aws_apigatewayv2_api.webhooks.id
  route_key = "POST /webhooks/shopee"
  target    = "integrations/${aws_apigatewayv2_integration.shopee.id}"
}

# Lambda Permissions
resource "aws_lambda_permission" "mercado_livre" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.webhook_mercado_livre.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.webhooks.execution_arn}/*/*"
}

resource "aws_lambda_permission" "amazon" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.webhook_amazon.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.webhooks.execution_arn}/*/*"
}

resource "aws_lambda_permission" "shopee" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.webhook_shopee.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.webhooks.execution_arn}/*/*"
}

# Outputs
output "webhook_api_url" {
  description = "Webhook API Gateway URL"
  value       = aws_apigatewayv2_api.webhooks.api_endpoint
}

output "sqs_queue_url" {
  description = "SQS Queue URL for webhooks"
  value       = aws_sqs_queue.webhooks.url
}
