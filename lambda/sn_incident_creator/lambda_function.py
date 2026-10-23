"""
sn-incident-creator
-------------------
SNS -> Lambda -> ServiceNow Table API.

CloudWatch alarm state changes arrive via SNS. This function:
  * ALARM  : creates an incident, or adds a work note to the open incident that
             already exists for this alarm (de-duplication via correlation_id)
  * OK     : adds a recovery work note to the open incident, if any
  * always : links the incident to the EC2 CI (best effort, never blocks)

Environment variables:
  SN_INSTANCE_URL  e.g. https://devXXXXXX.service-now.com   (no trailing slash)
  SN_SECRET_ID     Secrets Manager secret holding {"username": "...", "password": "..."}
"""
import json, os, base64, time, urllib.request, urllib.parse
import boto3

SN_URL = os.environ["SN_INSTANCE_URL"]
SECRET_ID = os.environ["SN_SECRET_ID"]
CI_TABLE = "cmdb_ci_ec2_instance"

_sm = boto3.client("secretsmanager")
_creds = None  # cached for the lifetime of the execution environment


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
    # The PDI can be slow; ServiceNow itself cancels transactions after ~60 s.
    with urllib.request.urlopen(req, timeout=65) as resp:
        return json.loads(resp.read())["result"]


def find_open_incident(corr_id):
    q = urllib.parse.quote(f"correlation_id={corr_id}^active=true")
    res = sn_request("GET", f"/api/now/table/incident?sysparm_query={q}"
                            "&sysparm_limit=1&sysparm_fields=sys_id,number")
    return res[0] if res else None


def create_incident(corr_id, alarm, reason):
    # NOTE: urgency/impact are deliberately omitted. Setting them on insert
    # triggered a priority/SLA rule chain that exceeded the PDI's transaction
    # limit (HTTP 500), so the instance defaults apply instead.
    try:
        return sn_request("POST", "/api/now/table/incident", {
            "short_description": f"AWS alarm: {alarm}",
            "description": reason,
            "correlation_id": corr_id,
        })
    except Exception as e:
        # ServiceNow can persist the record even when the response times out,
        # so verify before treating this as a failure (prevents duplicates).
        print(f"POST failed ({e}); re-checking for the incident")
        time.sleep(3)
        existing = find_open_incident(corr_id)
        if existing:
            return existing
        raise


def instance_id_from_alarm(msg):
    for d in msg.get("Trigger", {}).get("Dimensions", []):
        if d.get("name") == "InstanceId":
            return d.get("value")
    return None


def link_ci(incident_sys_id, instance_id):
    """Best effort: a CI-link problem must never break incident handling."""
    try:
        if not instance_id:
            print("No InstanceId in alarm payload")
            return False
        q = urllib.parse.quote(f"object_id={instance_id}")
        res = sn_request("GET", f"/api/now/table/{CI_TABLE}?sysparm_query={q}"
                                "&sysparm_limit=1&sysparm_fields=sys_id")
        if not res:
            print(f"No CI found for {instance_id}")
            return False
        sn_request("PATCH", f"/api/now/table/incident/{incident_sys_id}",
                   {"cmdb_ci": res[0]["sys_id"]})
        print(f"Linked incident to CI {res[0]['sys_id']}")
        return True
    except Exception as e:
        print(f"CI link failed: {e}")
        return False


def lambda_handler(event, context):
    msg = json.loads(event["Records"][0]["Sns"]["Message"])
    alarm = msg["AlarmName"]
    state = msg["NewStateValue"]
    reason = msg.get("NewStateReason", "")
    corr_id = f"aws-cw-{alarm}"
    instance_id = instance_id_from_alarm(msg)

    existing = find_open_incident(corr_id)

    if state == "ALARM":
        if existing:
            sn_request("PATCH", f"/api/now/table/incident/{existing['sys_id']}",
                       {"work_notes": f"Alarm fired again: {reason}"})
            link_ci(existing["sys_id"], instance_id)
            print(f"Updated {existing['number']}")
            return {"action": "updated", "number": existing["number"]}
        created = create_incident(corr_id, alarm, reason)
        link_ci(created["sys_id"], instance_id)
        print(f"Created {created['number']}")
        return {"action": "created", "number": created["number"]}

    if state == "OK" and existing:
        sn_request("PATCH", f"/api/now/table/incident/{existing['sys_id']}",
                   {"work_notes": "Alarm returned to OK in CloudWatch."})
        return {"action": "noted recovery", "number": existing["number"]}

    return {"action": "none"}
