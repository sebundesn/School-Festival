output "site_url" { value = "https://${aws_cloudfront_distribution.site.domain_name}" }
output "http_api_url" { value = aws_apigatewayv2_api.http.api_endpoint }
output "ws_url" { value = "wss://${aws_apigatewayv2_api.ws.id}.execute-api.${var.region}.amazonaws.com/prod" }
output "site_bucket" { value = aws_s3_bucket.site.bucket }
output "distribution_id" { value = aws_cloudfront_distribution.site.id }
output "github_deploy_role_arn" { value = aws_iam_role.github_deploy.arn }
