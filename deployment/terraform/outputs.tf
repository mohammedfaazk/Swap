output "database_endpoint" {
  value       = module.postgres.endpoint
  description = "Connection endpoint for the Postgres database"
}

output "database_port" {
  value       = module.postgres.port
  description = "Port for the Postgres database"
}
