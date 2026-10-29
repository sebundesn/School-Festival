variable "region" {
  type    = string
  default = "ap-northeast-1"
}

variable "staff_token" {
  type      = string
  sensitive = true
}

variable "alert_email" {
  type = string
}

variable "budget_usd" {
  type    = number
  default = 10
}

variable "protect_data" {
  description = "true の間は DynamoDB の削除保護とPITRを有効にする。片付け時に false にして apply → destroy"
  type        = bool
  default     = true
}

variable "github_repo" {
  description = "画面を自動デプロイする GitHub リポジトリ（owner/name）。main ブランチからだけ許可する"
  type        = string
  default     = "sebundesn/School-Festival"
}

variable "github_repo_with_ids" {
  description = "github_repo の ID 付き表記（owner@オーナーID/name@リポジトリID）。GitHub OIDC トークンの sub はこの形式で届く"
  type        = string
  default     = "sebundesn@192684360/School-Festival@1368442922"
}
