variable "db_username" {
  type        = string
  description = "Username for the Postgres database"
}

variable "db_password" {
  type        = string
  description = "Password for the Postgres database"
  sensitive   = true
}

variable "db_security_group_id" {
  type        = string
  description = "Security group for the database"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Subnet IDs for deploying resources"
}
