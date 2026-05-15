output "ec2_public_ip" {
  description = "Public IP address of the DevOps EC2 server."
  value       = aws_instance.devops.public_ip
}

output "jenkins_url" {
  description = "Jenkins URL."
  value       = "http://${aws_instance.devops.public_ip}:8080"
}

output "sonarqube_url" {
  description = "SonarQube URL."
  value       = "http://${aws_instance.devops.public_ip}:9000"
}

output "ssh_command" {
  description = "SSH command for the Ubuntu EC2 user."
  value       = "ssh ubuntu@${aws_instance.devops.public_ip}"
}

output "bootstrap_log_command" {
  description = "Command to inspect the bootstrap log."
  value       = "ssh ubuntu@${aws_instance.devops.public_ip} 'sudo tail -n 200 /var/log/docvault-devops-bootstrap.log'"
}

output "compose_ps_command" {
  description = "Command to inspect Docker Compose container status."
  value       = "ssh ubuntu@${aws_instance.devops.public_ip} 'cd /opt/docvault && docker compose -f docker-compose.devops.yml ps'"
}

output "jenkins_initial_password_command" {
  description = "Command to read the Jenkins initial admin password after Jenkins starts."
  value       = "ssh ubuntu@${aws_instance.devops.public_ip} 'sudo docker exec docvault-jenkins cat /var/jenkins_home/secrets/initialAdminPassword'"
}
