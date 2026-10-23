"""
ec2-sandbox-control
-------------------
Invoked by API Gateway (Lambda proxy integration) when ServiceNow calls
POST /ec2 with {"action": "start|stop|reboot", "instance_name": "<Name tag>"}.

Safety rails:
  * only instances tagged Project=sn-aws-demo can ever be touched
  * action is validated against an allow-list
  * IAM policy (iam/ec2-sandbox-control-policy.json) repeats the tag condition,
    so the restriction holds even if this code is changed
"""
import json
import boto3

ec2 = boto3.client("ec2")
TAG_KEY, TAG_VALUE = "Project", "sn-aws-demo"
ACTIONS = ("start", "stop", "reboot")


def respond(code, body):
    return {
        "statusCode": code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
    except ValueError:
        return respond(400, {"error": "Invalid JSON"})

    action = body.get("action")
    name = body.get("instance_name")
    if action not in ACTIONS or not name:
        return respond(400, {"error": "Need action (start|stop|reboot) and instance_name"})

    res = ec2.describe_instances(Filters=[
        {"Name": "tag:Name", "Values": [name]},
        {"Name": f"tag:{TAG_KEY}", "Values": [TAG_VALUE]},
        {"Name": "instance-state-name",
         "Values": ["pending", "running", "stopping", "stopped"]},
    ])
    found = [i for r in res["Reservations"] for i in r["Instances"]]
    if len(found) != 1:
        return respond(404, {"error": f"Expected 1 matching instance, found {len(found)}"})

    instance_id = found[0]["InstanceId"]
    state = found[0]["State"]["Name"]

    if action == "start":
        if state in ("running", "pending"):
            return respond(200, {"result": "no change", "instance_id": instance_id, "state": state})
        ec2.start_instances(InstanceIds=[instance_id])
        return respond(200, {"result": "start requested", "instance_id": instance_id, "previous_state": state})

    if action == "stop":
        if state in ("stopped", "stopping"):
            return respond(200, {"result": "no change", "instance_id": instance_id, "state": state})
        ec2.stop_instances(InstanceIds=[instance_id])
        return respond(200, {"result": "stop requested", "instance_id": instance_id, "previous_state": state})

    # reboot
    if state != "running":
        return respond(409, {"error": f"Cannot reboot: instance is {state}", "instance_id": instance_id})
    ec2.reboot_instances(InstanceIds=[instance_id])
    return respond(200, {"result": "reboot requested", "instance_id": instance_id, "state": state})
