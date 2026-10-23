/*! RESOURCE: /scripts/js_includes_customer.js */
/*! RESOURCE: HermesTopicInspectorUIScript */
var HermesTopicInspectorUIScript = Class.create();
HermesTopicInspectorUIScript.prototype = {
    NA: getMessage("NA"),
    initialize: function() {},
    invalidServerResponsePopUp: function() {
        var gm = new GlideModal('glide_info');
        gm.setTitle(getMessage("Received an invalid response from the server"));
        gm.on('closeconfirm', function() {
            GlideModal.prototype.get('hermes_consumer_viewer').destroy();
        });
        gm.render();
    },
    valueOrNA: function(value) {
        return value ? value : this.NA;
    },
    offsetValueOrNA: function(value) {
        return ((value || value == 0) && value > -1) ? value : this.NA;
    },
    getResponseElements: function(response, tagName) {
        if (!response)
            return;
        var responseXML = response.responseXML;
        if (!response.responseXML)
            return;
        var documentElement = responseXML.documentElement;
        if (!documentElement)
            return;
        var elements = documentElement.getElementsByTagName(tagName);
        if (!elements)
            return;
        return elements;
    },
    groupAndSortPartitions: function(partitionInfoList, nearDC) {
        var partitionInfoArr = [].slice.call(partitionInfoList);
        dcGroupedPartitions = partitionInfoArr.reduce(function(accum, elem) {
            (accum[elem.getAttribute("dc")] = accum[elem.getAttribute("dc")] || []).push(elem);
            return accum;
        }, {});
        var dcs = Object.keys(dcGroupedPartitions);
dcs.sort(function(a, b) {
            if (a == nearDC)
                return 1;
            else if (b == nearDC)
                return -1;
            return 0;
        });
        var result = [];
        for (var i = 0; i < dcs.length; i++) {
            var dcPartitionInfo = dcGroupedPartitions[dcs[i]];
            if (!dcPartitionInfo)
                continue;
dcPartitionInfo.sort(function(a, b) {
                return b.getAttribute("value") - a.getAttribute("value");
            });
            result.push(dcPartitionInfo);
        }
        return result.flatMap(function(partitionInfo) {
            return partitionInfo;
        });
    }
};
/*! RESOURCE: ConnectionUtils */
var ConnectionUtils = {
	getSysConnection: function() {
		var connGR = new GlideRecord("sys_connection");
		connGR.addQuery('active', true);
		connGR.addQuery("connection_alias", g_form.getValue("connection_alias"));
		connGR.addQuery("sys_domain", g_form.getValue("sys_domain"));
		connGR.addQuery("sys_id", "!=", g_form.getUniqueValue());
		connGR.query();
	
		return connGR;
	},
	
	doConnection: function(verb) {
		var currName = g_form.getValue("name");
if (currName.match(/[^A-Za-z0-9_ @./()#&+\-=!*]/)){
			g_form.addErrorMessage(new GwtMessage().getMessage("Invalid connection name"));
			return false;
		}
	
		if (g_form.getValue("active") == "false") {
			gsftSubmit(null, g_form.getFormElement(), verb);
			return;
		}
	
		var connGR;
		var performOverride = function() {
			connGR.active = false;
			connGR.update();
			gsftSubmit(null, g_form.getFormElement(), verb);
		};
	
		var grConnAlias = new GlideRecord("sys_alias");
		if (grConnAlias.get(g_form.getValue("connection_alias"))) {
			if (grConnAlias.multiple_connections == 'true') {
				gsftSubmit(null, g_form.getFormElement(), verb);
			} else {
				connGR = this.getSysConnection();
	
				if (connGR.next()) {
					var escapedCurrName = this.escapeHTML(currName);
					var escapedConnGRName = this.escapeHTML(connGR.name);
					
					if (escapedConnGRName.toUpperCase() == escapedCurrName.toUpperCase()) {
						var uniqueErrMsg = new GwtMessage().getMessage("A connection with {0} name already exists, duplicate connection names are not allowed", escapedCurrName);
						g_form.addErrorMessage(uniqueErrMsg);
						return false;
					}
	
					var title = new GwtMessage().getMessage("Confirm inactivation");
var question = new GwtMessage().getMessage("You already have a {0} connection active, {1}.<br/>By making this one active, {2} will become inactive. <br/>Are you sure you want to make {3} the active connection?", connGR.protocol, escapedConnGRName, escapedConnGRName, escapedCurrName);
	
					this.confirmOverride(title, question, performOverride);
				} else {
					gsftSubmit(null, g_form.getFormElement(), verb);
				}
			}
		}
	},
	
	confirmOverride: function(title, question, onPromptComplete) {
		var dialogClass = (window.GlideModal) ? GlideModal : GlideDialogWindow;
		var dialog = new GlideDialogWindow('glide_confirm_basic');
		dialog.setTitle(title);
		dialog.setSize(400, 325);
		dialog.setPreference('title', question);
		dialog.setPreference('onPromptComplete', onPromptComplete);
		dialog.render();
	},
	
	escapeHTML: function(str) {
return str.replace(/[&<>"'\u00AD]/g, function (c) {
			switch (c) {
				case '&': return '&amp;';
				case '<': return '&lt;';
				case '>': return '&gt;';
				case '"': return '&quot;';
				case "'": return '&#039;';
				case '\u00AD': return '&shy;';
				default: return c;
			}
		});
	}
	
	};
/*! RESOURCE: Validate Client Script Functions */
function validateFunctionDeclaration(fieldName, functionName) {
    var code = g_form.getValue(fieldName);
    if (code == "")
       return true;
    code = removeCommentsFromClientScript(code);
    var patternString = "function(\\s+)" + functionName + "((\\s+)|\\(|\\[\r\n])";
    var validatePattern = new RegExp(patternString);
    
    if (!validatePattern.test(code)) {
       var msg = new GwtMessage().getMessage('Missing function declaration for') + ' ' + functionName;
       g_form.showErrorBox(fieldName, msg);
       return false;
    }
    return true;
}
function validateNoServerObjectsInClientScript(fieldName) {
    var code = g_form.getValue(fieldName);
    if (code == "")
       return true;
    code = removeCommentsFromClientScript(code);
    
var doubleQuotePattern = /"[^"\r\n]*"/g;
    code = code.replace(doubleQuotePattern,""); 
var singleQuotePattern = /'[^'\r\n]*'/g;
    code = code.replace(singleQuotePattern,"");
    var rc = true;
var gsPattern = /(\s|\W)gs\./;
    if (gsPattern.test(code)) {
       var msg = new GwtMessage().getMessage('The object "gs" should not be used in client scripts.');
       g_form.showErrorBox(fieldName, msg);
       rc = false;
    }
var currentPattern = /(\s|\W)current\./;
    if (currentPattern.test(code)) {
       var msg = new GwtMessage().getMessage('The object "current" should not be used in client scripts.');
       g_form.showErrorBox(fieldName, msg);
       rc = false;
    }
    return rc;    
}
function validateUIScriptIIFEPattern(fieldName, scopeName, scriptName) {
	var code = g_form.getValue(fieldName);
	var rc = true;
	if("global" == scopeName)
		return rc;
	
	code = removeCommentsFromClientScript(code);
	code = removeSpacesFromClientScript(code);
	code = removeNewlinesFromClientScript(code);
	
	var requiredStart =  "var"+scopeName+"="+scopeName+"||{};"+scopeName+"."+scriptName+"=(function(){\"usestrict\";";
	var requiredEnd = "})();";
	
	if(!code.startsWith(requiredStart)) {
		var msg = new GwtMessage().getMessage("Missing closure assignment.");
		g_form.showErrorBox(fieldName,msg);
		rc = false;
	}
	
	if(!code.endsWith(requiredEnd)) {
		var msg = new GwtMessage().getMessage("Missing immediately-invoked function declaration end.");
		g_form.showErrorBox(fieldName,msg);
		rc = false;
	}
	return rc;
}
function validateNotCallingFunction (fieldName, functionName) {
	var code = g_form.getValue(fieldName);
	var rc = true;
	var reg = new RegExp(functionName, "g");
	var matches;
	
	code = removeCommentsFromClientScript(code);
	
	if (code == '')
		return rc;
	
	matches = code.match(reg);
	rc = (matches && (matches.length == 1));
	
	if(!rc) {
		var msg = "Do not explicitly call the " + functionName + " function in your business rule. It will be called automatically at execution time.";
		msg = new GwtMessage().getMessage(msg);
		g_form.showErrorBox(fieldName,msg);
	}
	
	return rc;
}
function removeCommentsFromClientScript(code) {
var pattern1 = /\/\*(.|[\r\n])*?\*\//g;
    code = code.replace(pattern1,""); 
var pattern2 = /\/\/.*/g;
    code = code.replace(pattern2,"");
    return code;
}
function removeSpacesFromClientScript(code) {
var pattern = /\s*/g;
	return code.replace(pattern,"");
}
function removeNewlinesFromClientScript(code) {
var pattern = /[\r\n]*/g;
	return code.replace(pattern,"");
}
/*! RESOURCE: AssetSetDomainParameters */
function assetSetDomainParameters(gDialog) {
	var ga = new GlideAjax('global.AssetUtilsAJAX');
	ga.addParam('sysparm_name', 'isDomainDataSeparationEnabled');
	ga.getXMLWait();
	if (ga.getAnswer() === 'true') {
		gDialog.setPreference('sysparm_domain', g_form.getValue('sysparm_domain'));
		gDialog.setPreference('sysparm_domain_scope', g_form.getValue('sysparm_domain_scope'));
	}
}
/*! RESOURCE: populate_scope_editor_slushbucket */
function populateLeftAndRightScopeEditor(dataLeft, dataRight) {
	slushbucketPopulateHelper(gel('scope_slush_left'), dataLeft);
	slushbucketPopulateHelper(gel('scope_slush_right'), dataRight);
}
function slushbucketPopulateHelper(select, data) {
	select.options.length = 0;
	if(data) {
		var list = data.split('^');
		for (var i = 0; i != list.length; i++) {
			var t = list[i].split(':');
			var label = atob(t[0]);
			var value = atob(t[1]);
			var o = new Option(label, value);
			select.options[select.options.length] = o;
		}
	}
}
function cancel() {
	g_form.fieldChanged('scope_slush', false);
	setTimeout(function() {reloadWindow(self);}, 1);
}
function editScopes() {
	g_form.fieldChanged('scope_slush', false);
	var jsonScopes = {
		"additionalScopes": scope_slush.getValues(scope_slush.getRightSelect()) || [],
		"removedScopes": scope_slush.getValues(scope_slush.getLeftSelect()) || []
	};
	var stringScopes = JSON.stringify(jsonScopes);
	
	var ga = new GlideAjax('AJAXAddScopes');
	ga.addParam('sysparm_name', 'updateScopes');
	ga.addParam('sysparm_scopes', stringScopes);
	ga.addParam('sysparm_oauthEntityId', g_form.getUniqueValue());
	ga.getXML(function(result) {
		g_navigation.reloadWindow();
	});
}
/*! RESOURCE: UpgradePlanProgressViewerUtil */
var UpgradePlanProgressViewerUtil = Class.create();
UpgradePlanProgressViewerUtil.prototype = {
	initialize: function() {
	},
	renderProgressViewer: function(title, progressId) {
		var self = this;
		var dialogClass = window.GlideModal ? GlideModal : GlideDialogWindow;
		var modal = new dialogClass('hierarchical_progress_viewer', false, '40em', '10.5em');
	
		modal.setTitle(title);
		modal.setPreference('sysparm_renderer_execution_id', progressId);
		modal.setPreference('sysparm_button_close', new GwtMessage().getMessage('Close'));
		modal.setPreference('sysparm_renderer_hide_drill_down', true);
	
		modal.on('bodyrendered', function() {
			self.disableModalCloseButton();
		});
	
		modal.on('renderStatus', function(statusObject) {
			self.addResultButtonIfApplicable(statusObject);
			self.addViewDetailsButtonIfApplicable(statusObject, progressId, modal);
		});
	
		modal.on('executionComplete', function() {
			self.updateModalButtons(modal);
		});
	
		modal.render();
	},
	addResultButtonIfApplicable: function(statusObject) {
		if (!this.isUpgradePlanComplete(statusObject))
			return;
		addButtonToProgressFooter(this.createResultButton(statusObject.result.upgradePlanSysId));
	},
	addViewDetailsButtonIfApplicable: function(statusObject, progressId, modal) {
		if (statusObject && statusObject.result && statusObject.result.succeedWithWarning && !$('sysparm_button_view_details') && !modal.title.includes(' - Execution Details'))
			addButtonToProgressFooter(this.createViewDetailsButton(progressId, modal));
	},
	disableModalCloseButton: function() {
		var closeBtn = $('sysparm_button_close');
		if (closeBtn)
			closeBtn.disable();
	},
	isUpgradePlanComplete: function(statusObject) {
		return statusObject && statusObject.result && statusObject.result.upgradePlanSysId && !$('sysparm_button_result_page');
	},
	createResultButton: function(upgradePlanSysId) {
		var resultButton = new Element('button', {
			'id': 'sysparm_button_result_page',
			'type': 'button',
			'class': 'btn btn-default',
			'style': 'margin-left: 5px;'
		}).update(new GwtMessage().getMessage('Go to Upgrade Plan'));
		resultButton.onclick = function() {
			window.location = 'sys_upgrade_plan.do?sys_id=' + upgradePlanSysId;
		};
		return resultButton;
	},
	createViewDetailsButton: function(progressId, modal) {
		var viewDetailsButton = new Element('button', {
			'id': 'sysparm_button_view_details',
			'type': 'button',
			'class': 'btn btn-default',
			'style': 'margin-left: 5px;'
		}).update(new GwtMessage().getMessage('View Details'));
		viewDetailsButton.onclick = function() {
			modal.setPreference('sysparm_renderer_hide_drill_down', false);
			modal.setTitle(modal.title + ' - Execution Details');
			modal.render();
		};
		return viewDetailsButton;
	},
	updateModalButtons: function(modal) {
		var closeBtn = $('sysparm_button_close');
		if (closeBtn) {
			closeBtn.onclick = function() {
				modal.destroy();
				reloadWindow(window);
			};
		}
		var resultBtn = $('sysparm_button_result_page');
		if (resultBtn)
			resultBtn.className += ' btn-primary';
		var viewDetailsBtn = $('sysparm_button_view_details');
		if (viewDetailsBtn)
			viewDetailsBtn.className += ' btn-secondary';
	},
	type: 'UpgradePlanProgressViewerUtil'
};
/*! RESOURCE: UI Action Context Menu */
function showUIActionContext(event) {
   if (!g_user.hasRole("ui_action_admin"))
      return;
   var element = Event.element(event);
   if (element.tagName.toLowerCase() == "span")
      element = element.parentNode;
   var id = element.getAttribute("gsft_id");
   var mcm = new GwtContextMenu('context_menu_action_' + id);
   mcm.clear();
   mcm.addURL(getMessage('Edit UI Action'), "sys_ui_action.do?sys_id=" + id, "gsft_main");
   contextShow(event, mcm.getID(), 500, 0, 0);
   Event.stop(event);
}
addLoadEvent(function() {
   document.on('contextmenu', '.action_context', function (evt, element) {
      showUIActionContext(evt);
   });
});
/*! RESOURCE: ValidateStartEndDates */
function validateStartEndDate(startDateField, endDateField, processErrorMsg){
	var startDate = g_form.getValue(startDateField);
	var endDate = g_form.getValue(endDateField);
	var format = g_user_date_format;
	if (startDate === "" || endDate === "")
		return true;
	var startDateFormat = getDateFromFormat(startDate, format);
	var endDateFormat = getDateFromFormat(endDate, format);
	
	if (startDateFormat < endDateFormat)
		return true;
	
	if (startDateFormat === 0 || endDateFormat === 0){
		processErrorMsg(new GwtMessage().getMessage("{0} is invalid", g_form.getLabelOf(startDate === 0? startDateField : endDateField)));
		return false;
	}
	if (startDateFormat > endDateFormat){
		processErrorMsg(new GwtMessage().getMessage("{0} must be after {1}", g_form.getLabelOf(endDateField), g_form.getLabelOf(startDateField)));
		return false;
	}
	
	return true;
}
/*! RESOURCE: AppointmentBookingConfigHelper */
var APP_BOOKING_CONSTANTS = {};
APP_BOOKING_CONSTANTS.MESSAGES = {};
APP_BOOKING_CONSTANTS.MESSAGES.ERROR = {};
APP_BOOKING_CONSTANTS.MESSAGES.ERROR.ONSUBMIT = "";
APP_BOOKING_CONSTANTS.MESSAGES.ERROR.DAILYSCHEDULE = "";
APP_BOOKING_CONSTANTS.MESSAGES.ERROR.BREAKTIME = "";
APP_BOOKING_CONSTANTS.MESSAGES.ERROR.DURATION = "";
APP_BOOKING_CONSTANTS.MESSAGES.AVAILABLE = "";
APP_BOOKING_CONSTANTS.MESSAGES.BREAK = "";
APP_BOOKING_CONSTANTS.MESSAGES.INSUFFICIENT_TIME = "";
APP_BOOKING_CONSTANTS.MESSAGES.FETCHED = false;
			
var AppointmentBookingConfigHelper = Class.create();
AppointmentBookingConfigHelper.prototype = {
	initialize : function () {
		this.htmlTemplate = '';
	},
	clearTimespans : function () {
		var macroElem = $j("#appointmentBookingTimeSlotContainer")[0];
		if (macroElem) {
			macroElem.innerHTML = '';
		}
	},
	setBookableTime : function (bookableTime) {
		g_form.setValue("bookable_time", bookableTime);
	},
	initEventHandlers : function() {
		var breakStartElem = $j("#break-start");
		var breakEndElem = $j("#break-end");
		if (breakStartElem && breakEndElem) {
			breakStartElem.change(function() {
				var configHelper = new AppointmentBookingConfigHelper();
				if(configHelper.validateBreakTimes()){
					configHelper.refreshTimeSlots();
				}
			});
			breakEndElem.change(function() {
				var configHelper = new AppointmentBookingConfigHelper();
				if(configHelper.validateBreakTimes()){
					configHelper.refreshTimeSlots();
				}
			});
		}
	},
	validateDailySchedule : function () {
		var dailyStartTime = g_form.getValue("daily_start_time");
		var dailyEndTime = g_form.getValue("daily_end_time");
		g_form.hideFieldMsg('daily_start_time', true);
		g_form.hideFieldMsg('daily_end_time', true);
		if (!this.compareTime(dailyStartTime,dailyEndTime)) {
			g_form.showFieldMsg('daily_start_time',APP_BOOKING_CONSTANTS.MESSAGES.ERROR.DAILYSCHEDULE,'error');
			return false;
		}
		return true;
	},
	validateBreakTimes : function () {
		var considerBreak = g_form.getValue("include_daily_break");
		var breakStartElem = $j("#break-start");
		var breakEndElem = $j("#break-end");
		g_form.hideFieldMsg('include_daily_break', true);
		if (breakStartElem && breakEndElem) {
			if(breakStartElem[0].value == "" || breakEndElem[0].value == "")
				return true;
			if (!this.compareTime(breakStartElem[0].value, breakEndElem[0].value)) {
				g_form.showFieldMsg('include_daily_break',getMessage("Break start time cannot be after break end time"),'error');
				return false;
			}
		}
		return true;
	},
	validateDurations : function(){
		var appointmentDuration = g_form.getValue("appointment_duration");
		var workDuration = g_form.getValue("work_duration");
		var avgTravelDuration = g_form.getValue("average_travel_duration");
		g_form.hideFieldMsg('appointment_duration', true);
		var table = g_form.getTableName();
		var useEndTimeAs, useSchedule;
		if(table == "sn_apptmnt_booking_service_config") {
			useEndTimeAs = g_form.getValue("use_slot_end_time_as");
			useSchedule = g_form.getValue("use_appointment_schedule");
		}
		else 
			useEndTimeAs = g_scratchpad.use_slot_end_time_as;
		
		if(useEndTimeAs == "arrive_by" || (useSchedule == "true" || useSchedule == true))
			return true;
		
		if(appointmentDuration != "") {
			g_form.hideFieldMsg('appointment_duration', true);
			if((Number(workDuration) + Number(avgTravelDuration)) > Number(appointmentDuration)){
				g_form.showFieldMsg('appointment_duration',APP_BOOKING_CONSTANTS.MESSAGES.ERROR.DURATION,'error');
				return false;
			}
		} else 
			return false;
		return true;
	},
	validateOnSubmit : function() {
		var shouldSubmit = true;
		g_form.clearMessages();
		if (!this.validateDailySchedule()) {
			g_form.addErrorMessage(APP_BOOKING_CONSTANTS.MESSAGES.ERROR.ONSUBMIT);
			g_form.addErrorMessage(APP_BOOKING_CONSTANTS.MESSAGES.ERROR.DAILYSCHEDULE);
			shouldSubmit = false;
		}
		if (!this.validateBreakTimes()) {
			if (shouldSubmit)
				g_form.addErrorMessage(APP_BOOKING_CONSTANTS.MESSAGES.ERROR.ONSUBMIT);
			g_form.addErrorMessage(APP_BOOKING_CONSTANTS.MESSAGES.ERROR.BREAKTIME);
			shouldSubmit = false;
		}
		if (!this.validateDurations()) {
			if (shouldSubmit)
				g_form.addErrorMessage(APP_BOOKING_CONSTANTS.MESSAGES.ERROR.ONSUBMIT);
			g_form.addErrorMessage(APP_BOOKING_CONSTANTS.MESSAGES.ERROR.DURATION);
			shouldSubmit = false;
		}
		return shouldSubmit;
	},
	compareTime : function(start, end) {
		if (start && end) {
			var startComponentsArr = start.split(":");
			var endComponentsArr = end.split(":");
			var len = Math.min(startComponentsArr.length, endComponentsArr.length);
			var startNumeric = 0;
			var endNumeric = 0;
			try {
				for (var i = len-1;i>=0;i--){
startNumeric = startNumeric/60.0 + parseInt(startComponentsArr[i]);
endNumeric = endNumeric/60.0 + parseInt(endComponentsArr[i]);
				}
				return startNumeric <= endNumeric;
			} catch(err) {
				return false;
			}
		}
	},
	
	refreshTimeSlots : function() {
		if (!APP_BOOKING_CONSTANTS.MESSAGES.FETCHED) {
            var appointmentBookingAjax = new GlideAjax('sn_apptmnt_booking.AppointmentBookingAjaxUtil');
            appointmentBookingAjax.addParam('sysparm_name','getTranslatedMessagesForAppBookingConfig');
            appointmentBookingAjax.getXML(this.processAppBookingTranslationMessagesResponse.bind(this));
                    
		} else
			this._refreshTimeSlots();
	},
    
    processAppBookingTranslationMessagesResponse : function(response, args) {
        translatedMessages = response.responseXML.documentElement.getAttribute("answer");
        if (translatedMessages) {
            APP_BOOKING_CONSTANTS = JSON.parse(translatedMessages);
            APP_BOOKING_CONSTANTS.MESSAGES.FETCHED = true;
            this._refreshTimeSlots();
        }
    },
	
	_refreshTimeSlots : function() {
		var timeSlots = this.processTimeSpans();
		var bookableTime = [];
		for (var i = 0; i < timeSlots.length; i++) {
			var slot = timeSlots[i];
			if (slot) {
				var slotClassName = "time-slot";
				if (!slot.available)
					slotClassName += "-disable";
				this.htmlTemplate += '<div class="'+slotClassName+'">';
				if (slot.available)
this.htmlTemplate += '<div class="time-slot-label"><span data-index='+i+' action-value='+i+' class="icon-check"></span></div>';
				else
this.htmlTemplate += '<div class="time-slot-label"></div>';
this.htmlTemplate += '<div class="time-slot-value"> <span class="m-l-xs m-r-xs"> '+slot.start+' </span>';
this.htmlTemplate += '<span class="m-l-xs m-r-xs"> - </span>';
this.htmlTemplate += '<span class="m-l-xs m-r-xs"> '+slot.end+' </span> </div>';
				if (slot.available)
					bookableTime.push(slot.start + "-" + slot.end);
				if (!slot.available)
this.htmlTemplate += '<div class="time-slot-reason"> <span class="m-l-xs m-r-xs"> - '+slot.reason+' </span> </div>';
this.htmlTemplate += '</div>';
			}
		}
		this.setBookableTime(bookableTime.join()+"");
		this.updateTimeSlots();
	},
	processTimeSpans : function () {
		var windowDuration = g_form.getValue("appointment_duration");
		var dailyStartTime = g_form.getValue("daily_start_time");
		var dailyEndTime = g_form.getValue("daily_end_time");
		if (this.isNil(windowDuration) || this.isNil(dailyStartTime) || this.isNil(dailyEndTime))
			return [];
		var considerBreak = g_form.getValue("include_daily_break");
		var breakStartElem = $j("#break-start")[0];
		var breakEndElem = $j("#break-end")[0];
		var breakStartTime = "0:00", breakEndTime = "0:00";
		if ((considerBreak == true || considerBreak == "true") && breakStartElem && breakEndElem) {
			breakStartTime = breakStartElem.value+"";
			breakEndTime = breakEndElem.value+"";
			considerBreak = true;
			var breakString = breakStartTime + "-" + breakEndTime;
			g_form.setValue("break_time",breakString);
		}
		return this.buildTimeSpans(dailyStartTime, dailyEndTime, breakStartTime, breakEndTime, windowDuration, considerBreak);
	},
	isNil : function(value) {
		return (value == "" || value == null || value == undefined || value == "null" || value == "undefined");
	},
	updateTimeSlots : function() {
		var macroElem = $j("#appointmentBookingTimeSlotContainer")[0];
		if (macroElem) {
			macroElem.innerHTML = this.htmlTemplate;
		}
	},
	setHourMin: function(now, hourMin){
var arr = hourMin.split(/[-: ]/);
		var hour = Number(arr[0]);
		var min = Number(arr[1]);
		now.setHours(hour);
		now.setMinutes(min);
		now.setSeconds(0);
		return now;
	},
	buildTimeSpans : function (dailyStartTime, dailyEndTime, breakStartTime, breakEndTime, windowDuration, considerBreak) {
		var timeSpans = [], now = new Date();
		var CONSTANTS = {};
		CONSTANTS.AVAILABLE = APP_BOOKING_CONSTANTS.MESSAGES.AVAILABLE;
		CONSTANTS.BREAK = APP_BOOKING_CONSTANTS.MESSAGES.BREAK;
		CONSTANTS.INSUFFICIENT_TIME = APP_BOOKING_CONSTANTS.MESSAGES.INSUFFICIENT_TIME;
		CONSTANTS.MAX_MINUTES_IN_A_DAY = 1440;
		var start = this.setHourMin(new Date(), dailyStartTime);
		var end = this.setHourMin(new Date(), dailyEndTime);
		if (start.getTimezoneOffset() != end.getTimezoneOffset()) {
			start.setDate(start.getDate() + 1);
			end.setDate(end.getDate() + 1);
		}
		var currNumVal = start.getTime(), dailyEndNumVal = end.getTime();
		var endNumVal = dailyEndNumVal;
		var startTimeStamp = dailyStartTime;
		if (currNumVal >= dailyEndNumVal) {
			console.error("daily start time cannot be on or after daily end time");
			return timeSpans;
		}
		var breakStart = this.setHourMin(new Date(), breakStartTime);
		var breakEnd = this.setHourMin(new Date(), breakEndTime);
		var breakStartNumVal = breakStart.getTime(), breakEndNumVal = breakEnd.getTime();
		var breakStartTimeStamp = -1, breakEndTimeStamp = -1;
		if (considerBreak)
			considerBreak = this.shouldConsiderBreak(currNumVal, endNumVal, breakStartNumVal,breakEndNumVal);
		if (considerBreak) {
			breakStartTimeStamp = this.getTimestamp(breakStart);
			breakEndTimeStamp = this.getTimestamp(breakEnd);
		}
		if (considerBreak && breakStartNumVal < currNumVal) {
			currNumVal = breakStartNumVal;
			start = breakStart;
			startTimeStamp = this.getTimestamp(breakStart);
		}
		var maxCounter = 0;
		while (currNumVal < dailyEndNumVal || maxCounter > CONSTANTS.MAX_MINUTES_IN_A_DAY) {
			var nextWindow = this.addMinutes(start, parseInt(windowDuration));
			endNumVal = nextWindow.getTime();
if (endNumVal > dailyEndNumVal)
				break;
			var breakOverlapStartTime = this.doBreakOverlapStartTime(currNumVal, endNumVal, breakStartNumVal,breakEndNumVal);
			var breakOverlapEndTime = this.doBreakOverlapEndTime(currNumVal, endNumVal, breakStartNumVal,breakEndNumVal);
			if (considerBreak && (breakOverlapStartTime || breakOverlapEndTime)) {
				if (breakOverlapEndTime && startTimeStamp != breakStartTimeStamp) {
					timeSpans.push(this.getWindowSpan(startTimeStamp, breakStartTimeStamp, false, CONSTANTS.INSUFFICIENT_TIME));
				}
				timeSpans.push(this.getWindowSpan(breakStartTimeStamp, breakEndTimeStamp, false, CONSTANTS.BREAK));
				currNumVal = breakEnd.getTime();
				start = breakEnd;
				startTimeStamp = breakEndTimeStamp;
			} else {
				var endTimeStamp = this.getTimestamp(nextWindow);
				timeSpans.push(this.getWindowSpan(startTimeStamp, endTimeStamp, true, CONSTANTS.AVAILABLE));
				startTimeStamp = endTimeStamp;
				start = nextWindow;
				currNumVal = start.getTime();
			}
			maxCounter++;
		}
		return timeSpans;
	},
	getWindowSpan : function (start, end, available, reason) {
		var windowSpan = {};
		windowSpan.start = start;
		windowSpan.end = end;
		windowSpan.window = start + "-" + end;
		windowSpan.available = available;
		windowSpan.reason = reason;
		return windowSpan;
	},
	shouldConsiderBreak : function (windowStart, windowEnd, breakStart, breakEnd) {
		var considerBreak = false;
		if (!breakStart || !breakEnd || breakStart == breakEnd)
			return false;
		if (breakStart > breakEnd) {
			return false;
		}
		if (breakStart < windowStart && breakEnd <= windowStart) {
			return false;
		}
		if (breakStart >= windowEnd && breakEnd > windowEnd) {
			return false;
		}
		return true;
	},
	doBreakOverlapStartTime : function (windowStart, windowEnd, breakStart, breakEnd) {
		return (breakStart <= windowStart && breakEnd > windowStart);
	},
	doBreakOverlapEndTime : function (windowStart, windowEnd, breakStart, breakEnd) {
		return (breakStart > windowStart && breakStart < windowEnd);
	},
	dateTimeInyyyymmdd : function (dt, time) {
		var dateVal = this._getDateInyyyymmdd(dt);
		var dateTimeVal = dateVal + " " + time;
		return dateTimeVal;
	},
	_getDateInyyyymmdd : function (dateVal) {
		if (dateVal) {
			var d = new Date(dateVal), month = '' + (d.getMonth() + 1), day = ''
			+ d.getDate(), year = d.getFullYear();
			if (month.length < 2)
				month = '0' + month;
			if (day.length < 2)
				day = '0' + day;
			return [ year, month, day ].join('-');
		}
		return null;
	},
	addMinutes : function (dt, minutes) {
		return new Date(dt.getTime() + minutes * 60000);
	},
	getTimestamp : function (dt) {
		if (dt && dt instanceof Date) {
			var hours = dt.getHours(), minutes = dt.getMinutes(), seconds = dt
			.getSeconds();
			if (hours < 10) {
				hours = "0" + hours;
			}
			if (minutes < 10) {
				minutes = "0" + minutes;
			}
			if (seconds < 10) {
				seconds = "0" + seconds;
			}
			return hours + ":" + minutes;
		}
		return null;
	},
	hideBreakTime : function(){
		document.getElementById("break-container").style.visibility="hidden";
	},
	showBreakTime : function(){
		document.getElementById("break-container").style.visibility="visible";
	},
	setBreakStart : function(startTime){
		document.getElementById("break-start").value = startTime;
	},
	setBreakEnd : function(endTime){
		document.getElementById("break-end").value = endTime;
	}
};
/*! RESOURCE: pdb_HighchartsConfigBuilder */
var HighchartsBuilder = {
	getChartConfig: function(chartOptions, tzOffset) {
		var chartTitle = chartOptions.title.text,
			xAxisTitle = chartOptions.xAxis.title.text,
			xAxisCategories = chartOptions.xAxis.categories,
			yAxisTitle = chartOptions.yAxis.title.text,
			series = chartOptions.series;
		this.convertEpochtoMs(xAxisCategories);
		this.formatDataSeries(xAxisCategories, series);
		var config = {
			chart: {
				type: 'area',
				zoomType: 'x'
			},
			credits: {
				enabled: false
			},
			title: {
				text: chartTitle
			},
			xAxis: {
				type: 'datetime',
				title: {
					text: xAxisTitle,
					style: {textTransform: 'capitalize'}
				}
			},
			yAxis: {
				reversedStacks: false,
				title: {
					text: yAxisTitle,
					style: {textTransform: 'capitalize'}
				}
			},
			plotOptions: {
				area: {
					stacking: 'normal'
				},
				series: {
					marker: {
						enabled: true,
						symbol: 'circle',
						radius: 2
					},
					step: 'center'
				}
			},
			tooltip: {
				valueDecimals: 2,
				style: {
					whiteSpace: "wrap",
					width: "200px"
				}
			},
			series: series
		};
var convertedOffset = -1 * (tzOffset/60);
		Highcharts.setOptions({
			lang: {
				thousandsSep: ','
			},
			global: {
				timezoneOffset: convertedOffset
			}
		});
		return config;
	},
    convertEpochtoMs: function(categories) {
		categories.forEach(function(point, index, arr) {
			arr[index] *= 1000;
		});
	},
	formatDataSeries: function(categories, series) {
		series.forEach(function(row, index, arr) {
			arr[index].data.forEach(function(innerRow, innerIndex, innerArr) {
				var value = innerRow;
				if (value == "NaN") {
					value = 0;
				}
			    var xValue = categories[innerIndex];
				innerArr[innerIndex] = [xValue, value];
			});
		});
	}
};
/*! RESOURCE: ActionLayoutItemColorHelper */
var ActionLayoutItemColorHelper = Class.create();
var gwt = new GwtMessage();
var COLOR_CHOICE_LABELS = ["AI primary", "AI secondary", "AI tertiary", "Primary", "Primary positive", "Primary negative", "Primary selection", "Secondary", "Secondary positive", "Secondary negative", "Secondary selection", "Tertiary", "Tertiary selection"];
var COLOR_CHOICE_TRANSLATIONS = gwt.getMessages(COLOR_CHOICE_LABELS);
ActionLayoutItemColorHelper.prototype = {
    GROUP_TYPE_SPLIT_BUTTON: "1",
    COLUMN_NAME_COLOR: "color",
    COLUMN_NAME_VARIANT: "variant",
    BUTTON_OPTIONS: [{
            "value": "primary",
            "displayValue": "Primary"
        },
        {
            "value": "primary-positive",
            "displayValue": "Primary positive"
        },
        {
            "value": "primary-negative",
            "displayValue": "Primary negative"
        },
        {
            "value": "secondary",
            "displayValue": "Secondary"
        },
        {
            "value": "secondary-positive",
            "displayValue": "Secondary positive"
        },
        {
            "value": "secondary-negative",
            "displayValue": "Secondary negative"
        },
        {
            "value": "tertiary",
            "displayValue": "Tertiary"
        },
        {
            "value": "primary-ai",
            "displayValue": "AI primary"
        }, {
            "value": "secondary-ai",
            "displayValue": "AI secondary"
        }, {
            "value": "tertiary-ai",
            "displayValue": "AI tertiary"
        }
    ],
    MENU_OPTIONS: [{
            "value": "primary",
            "displayValue": "Primary"
        },
        {
            "value": "primary-selection",
            "displayValue": "Primary selection"
        },
        {
            "value": "secondary",
            "displayValue": "Secondary"
        },
        {
            "value": "secondary-selection",
            "displayValue": "Secondary selection"
        },
        {
            "value": "tertiary",
            "displayValue": "Tertiary"
        },
        {
            "value": "tertiary-selection",
            "displayValue": "Tertiary selection"
        },
        {
            "value": "primary-ai",
            "displayValue": "AI primary"
        }, {
            "value": "secondary-ai",
            "displayValue": "AI secondary"
        }, {
            "value": "tertiary-ai",
            "displayValue": "AI tertiary"
        }
    ],
    initialize: function() {},
    setButtonOptions: function(fieldName, initialValue) {
        g_form.clearOptions(fieldName);
        this.BUTTON_OPTIONS.forEach(option => {
            g_form.addOption(fieldName, option.value, COLOR_CHOICE_TRANSLATIONS[option.displayValue]);
        });
        if (initialValue && this.BUTTON_OPTIONS.find(option => option.value === initialValue)) {
            g_form.setValue(fieldName, initialValue);
        }
    },
    setDropdownOptions: function(fieldName, initialValue) {
        g_form.clearOptions(fieldName);
        this.MENU_OPTIONS.forEach(option => {
            g_form.addOption(fieldName, option.value, COLOR_CHOICE_TRANSLATIONS[option.displayValue]);
        });
        if (initialValue && this.MENU_OPTIONS.find(option => option.value === initialValue)) {
            g_form.setValue(fieldName, initialValue);
        }
    },
    loadVariantOptions: function(layoutItemSysId, initialValue) {
        var layoutItem = new GlideRecord("sys_ux_form_action_layout_item");
        layoutItem.get(layoutItemSysId);
        if (layoutItem.getValue("item_type") === "action") {
            this.setButtonOptions(this.COLUMN_NAME_VARIANT, initialValue);
        } else {
            var layoutGroup = new GlideRecord('sys_ux_form_action_layout_group');
            layoutGroup.get(layoutItem.getValue("layout_group"));
            if (layoutGroup.getValue("type") === this.GROUP_TYPE_SPLIT_BUTTON) {
                this.setButtonOptions(this.COLUMN_NAME_VARIANT, initialValue);
            } else {
                this.setDropdownOptions(this.COLUMN_NAME_VARIANT, initialValue);
            }
        }
    },
    loadColorOptions: function(initialValue) {
        if (g_form.getValue("item_type") === "action") {
            this.setButtonOptions(this.COLUMN_NAME_COLOR, initialValue);
        } else {
            var gr = new GlideRecord('sys_ux_form_action_layout_group');
            gr.get(g_form.getValue("layout_group"));
            if (gr.getValue("type") === this.GROUP_TYPE_SPLIT_BUTTON) {
                this.setButtonOptions(this.COLUMN_NAME_COLOR, initialValue);
            } else {
                this.setDropdownOptions(this.COLUMN_NAME_COLOR, initialValue);
            }
        }
    },
    handleActionItemTypeChange: function(itemType) {
        if (itemType === "action") {
            this.setButtonOptions(this.COLUMN_NAME_COLOR);
        }
        if (itemType === "group") {
            g_form.clearOptions(this.COLUMN_NAME_COLOR);
        }
    },
    handleActionItemGroupChange: function(layoutGroupSysId) {
        var gr = new GlideRecord('sys_ux_form_action_layout_group');
        gr.get(layoutGroupSysId);
        if (gr.getValue("type") === this.GROUP_TYPE_SPLIT_BUTTON) {
            this.setButtonOptions(this.COLUMN_NAME_COLOR);
        } else {
            this.setDropdownOptions(this.COLUMN_NAME_COLOR);
        }
    },
    type: "ActionLayoutItemColorHelper"
};
/*! RESOURCE: /scripts/lib/jquery/jquery_clean.js */
(function() {
	if (!window.jQuery)
		return;
	if (!window.$j_glide)
		window.$j = jQuery.noConflict();
	if (window.$j_glide && jQuery != window.$j_glide) {
		if (window.$j_glide)
		jQuery.noConflict(true);
		window.$j = window.$j_glide;
	}
})();
;
;
