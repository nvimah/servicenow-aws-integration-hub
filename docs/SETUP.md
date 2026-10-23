# Setup guide

Everything here was built by hand in the AWS console and the ServiceNow UI, then the code and policies were exported to this repo. Allow about a day for a first build (the PDI is slow, so give saves and flow runs a minute).

**Names used throughout** (change them if you like, but keep them consistent): region `us-east-1`, EC2 instance `sn-demo-server` tagged `Project = sn-aws-demo`, alarm `sn-demo-server-status-check-failed`, SNS topic `sn-demo-alarms`, secret `servicenow/aws-integration`, API `sn-ec2-api` (stage `prod`), usage plan `sn-ec2-plan`.

## Prerequisites

- A free ServiceNow **Personal Developer Instance** (developer.servicenow.com). Wake it before you start; it hibernates when idle.
- An AWS account with MFA on the root user, an admin IAM user for yourself, and a **budget alert** (for example $5).
- Postman (or curl) and AWS CloudShell.

---

## Part A: ServiceNow integration user

1. **User Administration → Users → New**: user ID `aws.integration`, a strong password, Active ticked.
2. Give it the roles **`rest_service`** and **`itil`** (Roles related list → Edit).
3. Test from Postman: `POST https://<instance>.service-now.com/api/now/table/incident` with Basic Auth and body `{"short_description": "test", "correlation_id": "aws-test-001"}`. Expect **201**.

> Do not send `urgency`/`impact` in the create call on a PDI. See the troubleshooting log in the README.

## Part B: AWS foundations

1. **Secrets Manager** → store a secret `servicenow/aws-integration` with keys `username` and `password`.
2. **EC2** → launch one small instance (for example `t3.micro`, Amazon Linux, no key pair, no inbound rules). Add tags `Name = sn-demo-server` and `Project = sn-aws-demo`.
3. **SNS** → create a Standard topic `sn-demo-alarms`.
4. **CloudWatch → Alarms → Create alarm** on the instance metric **StatusCheckFailed_Instance**: statistic Maximum, period 1 minute, threshold `>= 1`. Add two notifications to `sn-demo-alarms`: **In alarm** and **OK**.

## Part C: Alarm → incident Lambda (`sn-incident-creator`)

1. **Lambda → Create function** `sn-incident-creator` (Python 3). Paste `lambda/sn_incident_creator/lambda_function.py` and **Deploy**.
2. **Configuration**: timeout **5 min**; environment variables `SN_INSTANCE_URL` (no trailing slash) and `SN_SECRET_ID=servicenow/aws-integration`.
3. **Permissions**: add the inline policy `iam/read-servicenow-secret-policy.json` (replace `<ACCOUNT_ID>`) to the execution role.
4. **Add trigger → SNS** → `sn-demo-alarms`.
5. **Test** from CloudShell:
   ```bash
   aws cloudwatch set-alarm-state --alarm-name sn-demo-server-status-check-failed \
     --state-value ALARM --state-reason "Manual test for ServiceNow integration"
   ```
   An incident `AWS alarm: sn-demo-server-status-check-failed` appears. Run it again: the **same** incident gets an "Alarm fired again" work note. Then run it with `--state-value OK` for the recovery note.

## Part D: Control Lambda and API Gateway

1. **Lambda** `ec2-sandbox-control` (Python 3, timeout 30 s). Paste `lambda/ec2_sandbox_control/lambda_function.py`, **Deploy**.
2. Add the inline policy `iam/ec2-sandbox-control-policy.json` to its role.
3. **Test** in the console with `tests/events/ec2-control-stop.json`, then `...-start.json`. Expect `200` and `stop requested` / `start requested`.
4. **API Gateway → REST API** `sn-ec2-api`:
   - Create resource `/ec2` → method **POST** → integration **Lambda function** with **Lambda proxy integration** on.
   - Method request → **API key required: true**.
   - **Deploy API** to a new stage `prod`.
5. **Usage plan** `sn-ec2-plan`: rate 5 req/s, burst 10, quota 1000/day; attach `sn-ec2-api` / `prod`; create the API key `servicenow-key` and add it to the plan. Store the key value in your password manager.
6. **Postman check**: `POST <invoke-url>/ec2` (the invoke URL already ends in `/prod`). Without `x-api-key` you get `403 Forbidden`; with it and body `{"action": "start", "instance_name": "sn-demo-server"}` you get `200`.

## Part E: ServiceNow catalog item

1. **Service Catalog → Maintain Items → New**: name `Start/Stop my EC2 sandbox`, catalog Service Catalog.
2. Variables (type each name by hand; pasted text can add an invisible leading space that ServiceNow rejects):

   | Question | Name | Type | Notes |
   |---|---|---|---|
   | Action | `ec2_action` | Select Box | Mandatory. Choices: `Start the server` = `start`, `Stop the server` = `stop` |
   | Instance name | `instance_name` | Single Line Text | Default `sn-demo-server` |
   | Business justification | `justification` | Multiple Line Text | Mandatory |

3. Use **Try It** to check the form renders.

## Part F: Custom action `Control EC2 sandbox` (Workflow Studio)

1. **Workflow Studio → New → Action**, name `Control EC2 sandbox`.
2. **Inputs** (String, mandatory): `action`, `instance_name`.
3. Add a **REST step**:
   - Connection: Define connection inline. Base URL: your invoke URL ending in `/prod`.
   - Build request: Manually. Resource path `/ec2`. Method `POST`.
   - Headers: `Content-Type: application/json` and `x-api-key: <your key>`.
   - Request type **Text**. Body: `{"action": "<Action pill>", "instance_name": "<Instance name pill>"}`, where both values are **data pills** dragged from the Data panel (typed text will not work).
4. **Outputs**: `status_code` (String) and `response_body` (String). Click **Exit Edit Mode** and map them to the REST step's **Status Code** and **Response Body** pills.
5. **Test** with `action = start`, `instance_name = sn-demo-server`, then **Publish**.

## Part G: The flow

1. **Workflow Studio → New → Flow** `EC2 sandbox request`. Trigger: **Service Catalog**.
2. Actions: **Get Catalog Variables** (select the item and tick all three variables) → **Ask For Approval** (record = Requested Item, rule = Approve when anyone approves, approver = a fixed user).
3. **If** `Approval State is Approved`:
   - **Update Record** (Requested Item): work note `Approved. Sending request to AWS.`
   - **Control EC2 sandbox** with `ec2_action` and `instance_name` pills.
   - **Update Record**: work note = `AWS response (` + Status code pill + `): ` + Response body pill.
4. **Else**: **Update Record** with a rejection work note.
5. **Activate**, then on the catalog item open **Process Engine → Flow** and select `EC2 sandbox request`.
6. Order **Stop the server**, approve it from **My Approvals**, and confirm the RITM work note and the EC2 state.

## Part H: Remediation button

1. Note the action's internal name (`sys_hub_action_type_definition.list`), normally `global.control_ec2_sandbox`.
2. **System Definition → UI Actions → New** with the fields in the header comment of `servicenow/ui-action-restart-aws-server.js`, and paste the script.
3. Raise an alarm incident (Part C), open it, and click **Restart AWS server**. The work note shows `reboot requested`.

## Part I: CMDB sync

1. **Lambda** `ec2-cmdb-sync` (Python 3, timeout **2 min**). Paste `lambda/ec2_cmdb_sync/lambda_function.py`, set the same two environment variables, attach `iam/cmdb-sync-policy.json`.
2. **Test** with `{}`. Open `cmdb_ci_ec2_instance.list` in ServiceNow: the instance is there with State **On**.
3. Optional: **Add trigger → EventBridge → Schedule expression `rate(1 hour)`**.
4. Re-trigger the alarm (Part C). The incident's **Configuration item** now shows `sn-demo-server`.

---

## Cleanup

- Disable or delete the EventBridge rule, stop or terminate the EC2 instance, and delete the API key if you are finished.
- Rotate the ServiceNow integration password and the API key before sharing screenshots or recordings.
- Keep the AWS budget alert in place.
