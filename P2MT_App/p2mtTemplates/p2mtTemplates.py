from flask import flash, current_app, send_file
from jinja2 import Template
from P2MT_App import db
from P2MT_App.models import p2mtTemplates
from P2MT_App.main.utilityfunctions import printLogEntry
from datetime import date, time


def add_Template(
    templateTitle,
    emailSubject,
    templateContent,
    interventionType,
    interventionLevel,
    sendToStudent,
    sendToParent,
    sendToTeacher,
):
    # Add new template to the database
    printLogEntry("add_Template() function called")
    print(templateTitle)
    # Set intervention type or intervention level to None if no choice selected (i.e. = 0)
    if interventionType == 0:
        interventionType = None
    if interventionLevel == 0:
        interventionLevel = None
    newTemplate = p2mtTemplates(
        templateTitle=templateTitle,
        emailSubject=emailSubject,
        templateContent=templateContent,
        intervention_id=interventionType,
        interventionLevel=interventionLevel,
        sendToStudent=sendToStudent,
        sendToParent=sendToParent,
        sendToTeacher=sendToTeacher,
    )
    db.session.add(newTemplate)
    return


def update_Template(
    template_id,
    templateTitle,
    emailSubject,
    templateContent,
    interventionType,
    interventionLevel,
    sendToStudent,
    sendToParent,
    sendToTeacher,
):
    # Update information for existing template
    printLogEntry("update_Template() function called")
    templateFromDB = p2mtTemplates.query.get(template_id)
    print(templateTitle)
    # Set intervention type or intervention level to None if no choice selected (i.e. = 0)
    if interventionType == 0:
        interventionType = None
    if interventionLevel == 0:
        interventionLevel = None
    templateFromDB.templateTitle = templateTitle
    templateFromDB.emailSubject = emailSubject
    templateFromDB.templateContent = templateContent
    templateFromDB.intervention_id = interventionType
    templateFromDB.interventionLevel = interventionLevel
    templateFromDB.sendToStudent = sendToStudent
    templateFromDB.sendToParent = sendToParent
    templateFromDB.sendToTeacher = sendToTeacher
    return


def renderEmailTemplate(emailSubject, templateContent, templateParams):
    # Try to render the template but provide a nice message if it fails to render
    # Important to keep these try/except cases since users can easily create
    # mistakes when creating email templates.  Without these try/except cases,
    # users would be unable to fix the mistakes.
    # Improve: provide the error details in the exception message so they user
    # can identify the error
    # print(emailSubject, templateContent, templateParams)
    is_render_error = False
    try:
        jinja2Template_emailSubject = Template(emailSubject)
        jinja2Rendered_emailSubject = jinja2Template_emailSubject.render(templateParams)
    except:
        jinja2Rendered_emailSubject = (
            "Rendering error.  Fix your template and try again."
        )
        is_render_error = True
    try:
        jinja2Template_templateContent = Template(templateContent)
        jinja2Rendered_templateContent = jinja2Template_templateContent.render(
            templateParams
        )
    except:
        jinja2Rendered_templateContent = (
            "Rendering error.  Fix your template and try again."
        )
        is_render_error = True
    # Uncomment these print statements if debugging rendering issues
    # print(jinja2Rendered_emailSubject)
    # print(jinja2Rendered_templateContent)
    return jinja2Rendered_emailSubject, jinja2Rendered_templateContent, is_render_error


def preview_p2mtTemplate(emailSubject, templateContent):
    # Sample template variables
    # Define five examples for TMI message testing
    classAttendanceLogList = []
    tmiClassAttendanceLog_1 = {
        "classDate": date(2020, 8, 25),
        "className": "English IV",
        "attendanceType": "Unexcused Absence",
        "teacherLastName": "Stanley",
    }
    tmiClassAttendanceLog_2 = {
        "classDate": date(2020, 8, 26),
        "className": "Scientific Research",
        "attendanceType": "Excused Absence (But Missing Work)",
        "teacherLastName": "Seigle",
    }
    tmiClassAttendanceLog_3 = {
        "classDate": date(2020, 8, 27),
        "className": "SAILS",
        "attendanceType": "Tardy",
        "teacherLastName": "Christopher",
    }
    tmiClassAttendanceLog_4 = {
        "classDate": date(2020, 8, 28),
        "className": "Multimedia",
        "attendanceType": "Tardy",
        "teacherLastName": "McCoy",
    }
    tmiClassAttendanceLog_5 = {
        "classDate": date(2020, 8, 31),
        "className": "STEM IV",
        "attendanceType": "Tardy",
        "teacherLastName": "Lowry",
    }

    classAttendanceLogList.append(tmiClassAttendanceLog_1)
    classAttendanceLogList.append(tmiClassAttendanceLog_2)
    classAttendanceLogList.append(tmiClassAttendanceLog_3)
    classAttendanceLogList.append(tmiClassAttendanceLog_4)
    classAttendanceLogList.append(tmiClassAttendanceLog_5)
    # Create templateParams dictionary used for rendering email templates
    templateParams = {
        "studentFirstName": "Smarty",
        "studentLastName": "Tester",
        "startDate": date(2020, 9, 1),
        "endDate": date(2020, 9, 8),
        "tmiDate": date(2020, 9, 4),
        "tmiMinutes": 330,
        "classDate": date(2020, 8, 31),
        "className": "English IV",
        "attendanceType": "Unexcused Absence",
        "teacherLastName": "Stanley",
        "classAttendanceLogList": classAttendanceLogList,
        "comment": "random comment for testing",
        "studentScheduleLink": "https://calendar.google.com/calendar/embed?src=hcde.org_u2vkafii5l8uk8u6j6btlkpl28@group.calendar.google.com",
        "learningLabList": [
            {
                "dayNumber": 1,
                "learningLabDay": "Mondays",
                "startTime": time(10, 0),
                "endTime": time(11, 0),
            },
            {
                "dayNumber": 2,
                "learningLabDay": "Tuesdays",
                "startTime": time(14, 0),
                "endTime": time(15, 0),
            },
            {
                "dayNumber": 4,
                "learningLabDay": "Thursdays",
                "startTime": time(15, 30),
                "endTime": time(16, 30),
            },
        ],
        "pblTeamNumber": 12,
        "academicYear": "2020-2021",
        "semester": "Spring",
        "quarter": 3,
        "quarterOrdinal": "3rd",
        "pblName": "Solar Power for Kids",
        "pblId": 10,
        "pblTeamMembers": ["Smarty Tester", "Testy Tester", "Betty Tester"],
        "pblSponsor": "EPB",
        "pblSponsorPersonName": "Thomas Edison",
        "pblComments": "These are PBL comments",
        "kickoffEventDate": date(2021, 1, 12),
        "kickoffStartTime": time(10, 30, 0),
        "kickoffEndTime": time(11, 30, 0),
        "kickoffEventLocation": "EPB Warehouse",
        "kickoffEventStreetAddress": "143 10th Street",
        "kickoffEventCity": "Chattanooga",
        "kickoffEventState": "TN",
        "kickoffEventZip": "37406",
        "kickoffEventComments": "Park next to building",
        "finalEventDate": date(2021, 3, 17),
        "finalStartTime": time(14, 0, 0),
        "finalEndTime": time(15, 0, 0),
        "finalEventLocation": "Edney Center",
        "finalEventStreetAddress": "500 Market St",
        "finalEventCity": "Chattanooga",
        "finalEventState": "TN",
        "finalEventZip": "37406",
        "finalEventComments": "Meet on Floor 5",
    }
    (
        jinja2Rendered_emailSubject,
        jinja2Rendered_templateContent,
        is_render_error,
    ) = renderEmailTemplate(emailSubject, templateContent, templateParams)
    if is_render_error:
        flash("Rendering error.  Fix your template and try again.", "error")
    else:
        flash("Test template rendered!", "success")
    return jinja2Rendered_emailSubject, jinja2Rendered_templateContent

