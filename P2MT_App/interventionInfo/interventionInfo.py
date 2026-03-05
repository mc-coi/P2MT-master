from flask import flash, current_app, send_file
from flask_login import current_user
from P2MT_App import db
from P2MT_App.models import (
    InterventionLog,
    Student,
    FacultyAndStaff,
    InterventionType,
    p2mtTemplates,
)
from P2MT_App.main.utilityfunctions import printLogEntry
from P2MT_App.main.referenceData import (
    getStudentFirstNameAndLastName,
    getStudentEmail,
    getParentEmails,
    getInterventionType,
    getStudentScheduleLink,
    get_start_of_current_school_year,
    get_end_of_current_school_year,
)
from P2MT_App.p2mtTemplates.p2mtTemplates import renderEmailTemplate
from P2MT_App.googleAPI.googleMail import sendEmail
import os
import csv
from datetime import datetime


def add_InterventionLog(
    chattStateANumber,
    interventionType,
    interventionLevel,
    startDate,
    endDate,
    comment,
    tmiMinutes=None,
    **kwargs,
):
    printLogEntry("add_InterventionLog() function called")
    print(chattStateANumber, interventionType, interventionLevel, startDate, endDate)
    if "parentNotification" in kwargs:
        parentNotification = kwargs["parentNotification"]
        interventionLog = InterventionLog(
            intervention_id=interventionType,
            interventionLevel=interventionLevel,
            startDate=startDate,
            endDate=endDate,
            comment=comment,
            staffID=current_user.id,
            chattStateANumber=chattStateANumber,
            tmiMinutes=tmiMinutes,
            parentNotification=parentNotification,
        )
    else:
        interventionLog = InterventionLog(
            intervention_id=interventionType,
            interventionLevel=interventionLevel,
            startDate=startDate,
            endDate=endDate,
            comment=comment,
            staffID=current_user.id,
            chattStateANumber=chattStateANumber,
            tmiMinutes=tmiMinutes,
        )
    db.session.add(interventionLog)
    return interventionLog


def sendInterventionEmail(
    chattStateANumber,
    intervention_id,
    interventionLevel,
    startDate,
    endDate,
    comment,
    **kwargs,
):
    # Prepare and send intervention notification emails
    interventionType = getInterventionType(intervention_id)
    try:
        template = (
            p2mtTemplates.query.filter(
                InterventionType.interventionType == interventionType,
                p2mtTemplates.interventionLevel == interventionLevel,
            )
            .join(InterventionType)
            .first()
        )
        print("Using template:", template.templateTitle)
    except:
        print(
            "No template exists for interventionType =",
            interventionType,
            "and interventionLevel =",
            interventionLevel,
        )
        return

    studentFirstName, studentLastName = getStudentFirstNameAndLastName(
        chattStateANumber
    )
    studentScheduleLink = getStudentScheduleLink(chattStateANumber)

    # Set email_to based on template parameters
    studentEmail = getStudentEmail(chattStateANumber)
    parentEmailList = getParentEmails(chattStateANumber)
    if template.sendToStudent and not template.sendToParent:
        email_to = studentEmail
    if template.sendToStudent and template.sendToParent:
        email_to = [studentEmail] + parentEmailList
    if not template.sendToStudent and template.sendToParent:
        email_to = parentEmailList
    if not template.sendToStudent and not template.sendToParent:
        email_to = current_user.email

    # Use templateParams if they were passed to the function; otherwise use the default params
    if "templateParams" in kwargs:
        templateParams = kwargs["templateParams"]
        templateParams["chattStateANumber"] = chattStateANumber
        templateParams["studentFirstName"] = studentFirstName
        templateParams["studentLastName"] = studentLastName
        templateParams["startDate"] = startDate
        templateParams["endDate"] = endDate
        templateParams["comment"] = comment
        templateParams["studentScheduleLink"] = studentScheduleLink
    else:
        templateParams = {
            "chattStateANumber": chattStateANumber,
            "studentFirstName": studentFirstName,
            "studentLastName": studentLastName,
            "startDate": startDate,
            "endDate": endDate,
            "comment": comment,
            "studentScheduleLink": studentScheduleLink,
        }
    emailSubject, emailContent, is_render_error = renderEmailTemplate(
        template.emailSubject, template.templateContent, templateParams
    )
    if is_render_error:
        flash(
            """Unable to render email content.  Correct the email template and try again.<br>  
                    Note: some template variables may not be available for this intervention type.""",
            "error",
        )
        return
    try:
        email_cc = current_user.email
    except:
        email_cc = ""
    try:
        sendEmail(email_to, email_cc, emailSubject, emailContent)
        interventionStatus = "Intervention notification sent"
    except:
        interventionStatus = "Error sending email"
    return interventionStatus


def downloadInterventionLog():
    printLogEntry("downloadDailyAttendanceLog() function called")
    # Create a CSV output file and append with a timestamp
    output_file_path = os.path.join(current_app.root_path, "static/download")
    output_file_path = "/tmp"
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    csvFilename = output_file_path + "/" + "intervention_log_" + timestamp + ".csv"
    csvOutputFile = open(csvFilename, "w")
    csvOutputWriter = csv.writer(
        csvOutputFile, delimiter=",", quotechar='"', quoting=csv.QUOTE_MINIMAL
    )
    # Write header row for CSV file
    csvOutputWriter.writerow(
        [
            "chattStateANumber",
            "firstName",
            "lastName",
            "interventionType",
            "interventionLevel",
            "logEntryDate",
            "startDate",
            "endDate",
            "staffLastName",
            "comment",
        ]
    )
    csvOutputFileRowCount = 0
    # Query for information
    start_of_current_school_year = get_start_of_current_school_year()
    end_of_current_school_year = get_end_of_current_school_year()
    interventionLogs = (
        InterventionLog.query.join(InterventionType)
        .join(Student)
        .join(FacultyAndStaff)
        .filter(
            InterventionLog.createDate >= start_of_current_school_year,
            InterventionLog.createDate <= end_of_current_school_year,
        )
        .order_by(Student.lastName)
        .all()
    )
    # Process each record in the query and write to the output file
    for log in interventionLogs:
        csvOutputWriter.writerow(
            [
                log.Student.chattStateANumber,
                log.Student.firstName,
                log.Student.lastName,
                log.InterventionType.interventionType,
                log.interventionLevel,
                log.createDate,
                log.startDate,
                log.endDate,
                log.FacultyAndStaff.lastName,
                log.comment,
            ]
        )
        csvOutputFileRowCount = csvOutputFileRowCount + 1
    csvOutputFile.close()
    return send_file(csvFilename, as_attachment=True, cache_timeout=0)
