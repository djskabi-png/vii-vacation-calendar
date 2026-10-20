import boto3, json

REGION = "il-central-1"
ACCOUNT = "551626543793"
ROLE = "arn:aws:iam::551626543793:role/OrganizationAccountAccessRole"

credentials = boto3.client("sts").assume_role(RoleArn=ROLE, RoleSessionName="vii-app-discovery-20261020", DurationSeconds=900)["Credentials"]
session = boto3.Session(
    aws_access_key_id=credentials["AccessKeyId"],
    aws_secret_access_key=credentials["SecretAccessKey"],
    aws_session_token=credentials["SessionToken"],
    region_name=REGION,
)
rds = session.client("rds")
ec2 = session.client("ec2")
cf = session.client("cloudformation")
lambda_client = session.client("lambda")
apigw = session.client("apigatewayv2")

cluster = rds.describe_db_clusters(DBClusterIdentifier="vii-production")["DBClusters"][0]
instances = rds.describe_db_instances(Filters=[{"Name": "db-cluster-id", "Values": ["vii-production"]}])["DBInstances"]
subnet_group = rds.describe_db_subnet_groups(DBSubnetGroupName=cluster["DBSubnetGroup"])["DBSubnetGroups"][0]
vpc_id = subnet_group["VpcId"]
subnets = [subnet["SubnetIdentifier"] for subnet in subnet_group["Subnets"]]
security_groups = [group["VpcSecurityGroupId"] for group in cluster["VpcSecurityGroups"]]
secret_arn = cluster.get("MasterUserSecret", {}).get("SecretArn")

stacks = []
for status in cf.list_stacks()["StackSummaries"]:
    if status["StackStatus"] != "DELETE_COMPLETE" and "vii" in status["StackName"].lower():
        stacks.append({"name": status["StackName"], "status": status["StackStatus"]})

lambdas = [item["FunctionName"] for item in lambda_client.list_functions()["Functions"] if "vii" in item["FunctionName"].lower()]
apis = [{"name": item.get("Name"), "id": item["ApiId"], "endpoint": item.get("ApiEndpoint")} for item in apigw.get_apis()["Items"] if "vii" in item.get("Name", "").lower()]

print(json.dumps({
    "account": ACCOUNT,
    "region": REGION,
    "cluster": cluster["DBClusterIdentifier"],
    "endpoint": cluster["Endpoint"],
    "port": cluster["Port"],
    "database": cluster.get("DatabaseName"),
    "masterUsername": cluster.get("MasterUsername"),
    "secretArn": secret_arn,
    "vpcId": vpc_id,
    "subnets": subnets,
    "dbSecurityGroups": security_groups,
    "instances": [{"id": item["DBInstanceIdentifier"], "az": item["AvailabilityZone"]} for item in instances],
    "stacks": stacks,
    "lambdas": lambdas,
    "apis": apis,
}, default=str))
