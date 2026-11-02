| Severidad | Control | Descripción | Recursos |
|---|---|---|--:|
| Critical | iam_aws_attached_policy_no_administrative_privileges | Attached AWS-managed IAM policy does not allow '*:*' administrative privileges | 1 |
| Critical | iam_user_administrator_access_policy | IAM user does not have AdministratorAccess policy attached | 2 |
| Critical | kms_cmk_not_deleted_unintentionally | AWS KMS customer managed key is not scheduled for deletion | 2 |
| High | cloudfront_distributions_default_root_object | CloudFront distribution has a default root object configured | 1 |
| High | config_delegated_admin_and_org_aggregator_all_regions | AWS Config has a delegated administrator and an organization aggregator covering all AWS regions | 1 |
| High | ec2_ebs_volume_snapshots_exists | EBS volume has at least one snapshot | 1 |
| High | ec2_instance_internet_facing_with_instance_profile | EC2 instance is not internet-facing with an instance profile attached | 1 |
| High | ec2_networkacl_allow_ingress_any_port | Network ACL does not allow ingress from 0.0.0.0/0 to any port | 2 |
| High | iam_avoid_root_usage | AWS account root user has not been used in the last day | 1 |
| High | iam_role_cross_service_confused_deputy_prevention | IAM service role prevents cross-service confused deputy attack | 3 |
| High | iam_user_hardware_mfa_enabled | IAM user has hardware MFA enabled | 3 |
| High | iam_user_mfa_enabled_console_access | IAM user has MFA enabled for console access or no console password is set | 3 |
| High | iam_user_with_temporary_credentials | IAM user does not use long-lived credentials to access services other than IAM or STS | 2 |
| High | organizations_scp_check_deny_regions | AWS Organization restricts operations to only the configured AWS Regions with SCP policies | 1 |
| High | rds_instance_protected_by_backup_plan | RDS instance is protected by an AWS Backup plan | 1 |
