"""
ec2-cmdb-sync
-------------
Reads the tagged EC2 instance(s) and upserts them into the ServiceNow CMDB
table cmdb_ci_ec2_instance, keyed on object_id (the EC2 instance ID).
Run on demand (Lambda Test tab) or on an EventBridge schedule.

Environment variables:
  SN_INSTANCE_URL  e.g. https://devXXXXXX.service-now.com   (no trailing slash)
  SN_SECRET_ID     Secrets Manager secret holding {"username": "...", "password": "..."}
"""
import json, os, base64, time, urllib.request, urllib.parse
import boto3

SN_URL = os.environ["SN_INSTANCE_URL"]
SECRET_ID = os.environ["SN_SECRET_ID"]
TABLE = "cmdb_ci_ec2_instance"
TAG_KEY, TAG_VALUE = "Project", "sn-aws-demo"

# AWS instance state -> ServiceNow CI `state` choice value
# (choice values for cmdb_ci_vm_instance: on, off, starting, stopping,
#  terminating, terminated, ...). Unknown values are sent empty rather than
#  rejected, so a new AWS state never breaks the sync.
STATE_MAP = {
    "pending": "starting",
    "running": "on",
    "stopping": "stopping",
    "stopped": "off",
    "shutting-down": "terminating",
    "terminated": "terminated",
}

ec2 = boto3.client("ec2")
_sm = boto3.client("secretsmanager")
_creds = None


def get_creds():
    global _creds
    if _creds is None:
        _creds = json.loads(_sm.get_secret_value(SecretId=SECRET_ID)["SecretString"])
    return _creds


def sn_request(method, path, body=None):
    c = get_creds()
    token = base64.b64encode(f"{c['username']}:{c['password']}".encode()).decode()
    req = urllib.request.Request(
        SN_URL + path,
        method=method,
        data=json.dumps(body).encode() if body else None,
        headers={
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=65) as resp:
        return json.loads(resp.read())["result"]


def find_ci(instance_id):
    q = urllib.parse.quote(f"object_id={instance_id}")
    res = sn_request("GET", f"/api/now/table/{TABLE}?sysparm_query={q}"
                            "&sysparm_limit=1&sysparm_fields=sys_id,name")
    return res[0] if res else None


def create_ci(payload):
    try:
        return sn_request("POST", f"/api/now/table/{TABLE}", payload)
    except Exception as e:
        # ServiceNow can save the record even when the response times out
        print(f"POST failed ({e}); re-checking")
        time.sleep(3)
        existing = find_ci(payload["object_id"])
        if existing:
            return existing
        raise


def tag(instance, key):
    for t in instance.get("Tags", []):
        if t["Key"] == key:
            return t["Value"]
    return None


def lambda_handler(event, context):
    res = ec2.describe_instances(Filters=[
        {"Name": f"tag:{TAG_KEY}", "Values": [TAG_VALUE]},
        {"Name": "instance-state-name",
         "Values": ["pending", "running", "stopping", "stopped"]},
    ])
    instances = [i for r in res["Reservations"] for i in r["Instances"]]

    results = []
    for inst in instances:
        iid = inst["InstanceId"]
        aws_state = inst["State"]["Name"]
        payload = {
            "name": tag(inst, "Name") or iid,
            "object_id": iid,
            "state": STATE_MAP.get(aws_state, ""),
            "short_description": f"{inst['InstanceType']} in "
                                 f"{inst['Placement']['AvailabilityZone']}",
        }
        existing = find_ci(iid)
        if existing:
            sn_request("PATCH", f"/api/now/table/{TABLE}/{existing['sys_id']}", payload)
            results.append({"instance_id": iid, "action": "updated",
                            "state": aws_state, "sys_id": existing["sys_id"]})
        else:
            created = create_ci(payload)
            results.append({"instance_id": iid, "action": "created",
                            "state": aws_state, "sys_id": created["sys_id"]})
        print(results[-1])

    return {"synced": len(results), "results": results}
