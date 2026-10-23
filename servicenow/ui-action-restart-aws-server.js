/*
 * UI Action: Restart AWS server
 * ------------------------------------------------------------------
 * Name         : Restart AWS server
 * Table        : Incident [incident]
 * Action name  : restart_aws_server
 * Active       : true
 * Form button  : true      Client : false
 * Condition    : current.correlation_id.toString().indexOf('aws-cw-') == 0 && current.active == true
 *
 * Runs the published Workflow Studio custom action "Control EC2 sandbox"
 * (the same building block the catalog flow uses) with action = reboot,
 * then records the AWS response as a work note.
 *
 * Known simplification: the instance name is hard-coded. In a production
 * version it would be read from the incident's linked CI (cmdb_ci.name).
 */
(function () {
    var note;
    try {
        var result = sn_fd.FlowAPI.getRunner()
            .action('global.control_ec2_sandbox')
            .inForeground()
            .timeout(60000)
            .withInputs({ action: 'reboot', instance_name: 'sn-demo-server' })
            .run();
        var out = result.getOutputs();
        note = 'Remediation requested from ServiceNow. AWS response (' +
               out.status_code + '): ' + out.response_body;
    } catch (e) {
        note = 'Remediation call failed: ' + e.message;
    }
    current.work_notes = note;
    current.update();
    action.setRedirectURL(current);
})();
