import boto3, hashlib, json, time
from pathlib import Path

REGION="il-central-1"; ACCOUNT="551626543793"; CLUSTER_ID="vii-production"
FUNCTION="vii-production-database-bridge"; ROLE_NAME=f"{FUNCTION}-role"; API_NAME=FUNCTION
ROLE_ARN=f"arn:aws:iam::{ACCOUNT}:role/OrganizationAccountAccessRole"
creds=boto3.client("sts").assume_role(RoleArn=ROLE_ARN,RoleSessionName="vii-app-vpc-deploy-20261020",DurationSeconds=900)["Credentials"]
session=boto3.Session(aws_access_key_id=creds["AccessKeyId"],aws_secret_access_key=creds["SecretAccessKey"],aws_session_token=creds["SessionToken"],region_name=REGION)
rds,iam,functions,apis,ec2=(session.client(name) for name in ("rds","iam","lambda","apigatewayv2","ec2"))
cluster=rds.describe_db_clusters(DBClusterIdentifier=CLUSTER_ID)["DBClusters"][0]
subnet_group=rds.describe_db_subnet_groups(DBSubnetGroupName=cluster["DBSubnetGroup"])["DBSubnetGroups"][0]
vpc_id=subnet_group["VpcId"]; subnets=[item["SubnetIdentifier"] for item in subnet_group["Subnets"]]
db_sg=cluster["VpcSecurityGroups"][0]["VpcSecurityGroupId"]

def security_group(name,description):
    found=ec2.describe_security_groups(Filters=[{"Name":"group-name","Values":[name]},{"Name":"vpc-id","Values":[vpc_id]}])["SecurityGroups"]
    return found[0]["GroupId"] if found else ec2.create_security_group(GroupName=name,Description=description,VpcId=vpc_id)["GroupId"]

lambda_sg=security_group("vii-production-database-bridge","VII production Lambda to Aurora and Secrets Manager only")
endpoint_sg=security_group("vii-production-secrets-endpoint","VII production Secrets Manager endpoint")
try: ec2.revoke_security_group_egress(GroupId=lambda_sg,IpPermissions=[{"IpProtocol":"-1","IpRanges":[{"CidrIp":"0.0.0.0/0"}]}])
except Exception: pass
for port,target in ((5432,db_sg),(443,endpoint_sg)):
    try: ec2.authorize_security_group_egress(GroupId=lambda_sg,IpPermissions=[{"IpProtocol":"tcp","FromPort":port,"ToPort":port,"UserIdGroupPairs":[{"GroupId":target,"Description":"VII private application path"}]}])
    except ec2.exceptions.ClientError as error:
        if error.response["Error"]["Code"]!="InvalidPermission.Duplicate": raise
for group,port,source in ((db_sg,5432,lambda_sg),(endpoint_sg,443,lambda_sg)):
    try: ec2.authorize_security_group_ingress(GroupId=group,IpPermissions=[{"IpProtocol":"tcp","FromPort":port,"ToPort":port,"UserIdGroupPairs":[{"GroupId":source,"Description":"VII private application path"}]}])
    except ec2.exceptions.ClientError as error:
        if error.response["Error"]["Code"]!="InvalidPermission.Duplicate": raise

service=f"com.amazonaws.{REGION}.secretsmanager"
endpoints=ec2.describe_vpc_endpoints(Filters=[{"Name":"vpc-id","Values":[vpc_id]},{"Name":"service-name","Values":[service]}])["VpcEndpoints"]
endpoint=endpoints[0] if endpoints else ec2.create_vpc_endpoint(VpcId=vpc_id,ServiceName=service,VpcEndpointType="Interface",SubnetIds=subnets,SecurityGroupIds=[endpoint_sg],PrivateDnsEnabled=True)
trust={"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}
try: role=iam.get_role(RoleName=ROLE_NAME)["Role"]
except iam.exceptions.NoSuchEntityException:
    role=iam.create_role(RoleName=ROLE_NAME,AssumeRolePolicyDocument=json.dumps(trust),Description="VII production private Aurora bridge")["Role"]; time.sleep(10)
for arn in ("arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole","arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"):
    iam.attach_role_policy(RoleName=ROLE_NAME,PolicyArn=arn)
secret_arn=cluster["MasterUserSecret"]["SecretArn"]
iam.put_role_policy(RoleName=ROLE_NAME,PolicyName="vii-production-secret-read",PolicyDocument=json.dumps({"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["secretsmanager:GetSecretValue","secretsmanager:DescribeSecret"],"Resource":secret_arn}]}))
code=Path.home().joinpath("vii-bridge-pg-20261020-0618.zip").read_bytes()
token_hash=hashlib.sha256(Path("/tmp/vii-bridge-token").read_bytes()).hexdigest()
environment={"Variables":{"DB_HOST":cluster["Endpoint"],"DB_PORT":str(cluster["Port"]),"DB_NAME":cluster.get("DatabaseName") or "vii","DB_SECRET_ARN":secret_arn,"BRIDGE_TOKEN_SHA256":token_hash}}
vpc={"SubnetIds":subnets,"SecurityGroupIds":[lambda_sg]}
try:
    functions.get_function(FunctionName=FUNCTION); functions.update_function_code(FunctionName=FUNCTION,ZipFile=code,Publish=True); functions.get_waiter("function_updated_v2").wait(FunctionName=FUNCTION)
    functions.update_function_configuration(FunctionName=FUNCTION,Runtime="nodejs22.x",Handler="index.handler",Role=role["Arn"],Timeout=29,MemorySize=512,Environment=environment,VpcConfig=vpc)
except functions.exceptions.ResourceNotFoundException:
    functions.create_function(FunctionName=FUNCTION,Runtime="nodejs22.x",Role=role["Arn"],Handler="index.handler",Code={"ZipFile":code},Timeout=29,MemorySize=512,Publish=True,Environment=environment,VpcConfig=vpc,Architectures=["arm64"])
functions.get_waiter("function_active_v2").wait(FunctionName=FUNCTION)
existing=next((item for item in apis.get_apis()["Items"] if item.get("Name")==API_NAME),None)
if existing: api_id,endpoint_url=existing["ApiId"],existing["ApiEndpoint"]
else:
    created=apis.create_api(Name=API_NAME,ProtocolType="HTTP",Target=functions.get_function(FunctionName=FUNCTION)["Configuration"]["FunctionArn"]); api_id,endpoint_url=created["ApiId"],created["ApiEndpoint"]
try: functions.add_permission(FunctionName=FUNCTION,StatementId="AllowApiGatewayInvoke",Action="lambda:InvokeFunction",Principal="apigateway.amazonaws.com",SourceArn=f"arn:aws:execute-api:{REGION}:{ACCOUNT}:{api_id}/*/*")
except functions.exceptions.ResourceConflictException: pass
print(json.dumps({"ok":True,"account":ACCOUNT,"region":REGION,"cluster":CLUSTER_ID,"path":"api-gateway-lambda-private-vpc-aurora","function":FUNCTION,"apiId":api_id,"endpoint":endpoint_url,"lambdaSecurityGroup":lambda_sg,"secretsEndpoint":endpoint["VpcEndpointId"],"subnetCount":len(subnets),"secretRead":False,"bridgeTokenPrinted":False}))
