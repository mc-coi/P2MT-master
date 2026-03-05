from P2MT_App import db
from datetime import date, datetime
from sqlalchemy import func
from flask import send_file, current_app, flash
from flask_login import current_user
import os
import csv
from P2MT_App.models import (
    ClassAttendanceLog,
    InterventionLog,
    ClassSchedule,
    Student,
    p2mtTemplates,
    InterventionType,
)
from P2MT_App.main.utilityfunctions import printLogEntry
from P2MT_App.main.referenceData import getParentEmails
from P2MT_App.interventionInfo.interventionInfo import add_InterventionLog
from P2MT_App.p2mtTemplates.p2mtTemplates import renderEmailTemplate
from P2MT_App.googleAPI.googleMail import sendEmail


def findTardyClassesForStudent(startPeriod, endPeriod, chattStateANumber):
    # Return id for all tardy classes for a student in a specificed time period
    tardyClasses = (
        db.session.query(ClassAttendanceLog.id)
        .join(ClassSchedule)
        .filter(
            ClassAttendanceLog.classDate >= startPeriod,
            ClassAttendanceLog.classDate <= endPeriod,
            ClassAttendanceLog.attendanceCode == "T",
            ClassSchedule.chattStateANumber == chattStateANumber,
        )
    ).all()
    return tardyClasses


def updateTmiForClasses(classIds, assignTmi):
    # Update assignTmi for specified class id's
    for classId in classIds:
        log = ClassAttendanceLog.query.get(classId)
        log.assignTmi = assignTmi
        # print("db.session.dirty =", db.session.dirty)
    return


def assignTmiForTardy(startTmiPeriod, endTmiPeriod):
    # Identify all students with tardies during a TMI period
    # If 3 or more tardies, set assignTmi = true
    # If less than 3 tardies, set assignTmi = false

    # Get list of tardy stduents and the number of tardies
    tardyStudents = (
        db.session.query(
            Student.chattStateANumber,
            Student.firstName,
            Student.lastName,
            func.count(Student.chattStateANumber),
        )
        .select_from(Student)
        .join(ClassSchedule)
        .join(ClassSchedule.ClassAttendanceLog)
        .filter(
            ClassAttendanceLog.classDate >= startTmiPeriod,
            ClassAttendanceLog.classDate <= endTmiPeriod,
            ClassAttendanceLog.attendanceCode == "T",
        )
        .group_by(Student.chattStateANumber)
    ).all()

    print(tardyStudents)
    for tardyStudent in tardyStudents:
        chattStateANumber = tardyStudent[0]
        firstName = tardyStudent[1]
        lastName = tardyStudent[2]
        tardyCount = tardyStudent[3]
        tardyClassesIds = findTardyClassesForStudent(
            startTmiPeriod, endTmiPeriod, chattStateANumber
        )
        if tardyCount >= 3:
            print("assign Tardy TMI for", chattStateANumber, firstName, lastName)
            updateTmiForClasses(tardyClassesIds, assignTmi=True)
        else:
            print("remove Tardy TMI for", chattStateANumber, firstName, lastName)
            updateTmiForClasses(tardyClassesIds, assignTmi=False)
    return


def getStudentsWithTmiInterventions(tmiDate):
    tmiInterventionLog = InterventionLog.query.filter(
        InterventionLog.intervention_id == 3,
        InterventionLog.interventionLevel == 1,
        InterventionLog.startDate == tmiDate,
    ).all()
    return tmiInterventionLog


def getStudentsWithAssignTmi(startPeriod, endPeriod, **kwargs):
    # Get list of chattStateAnumbers for students where assignTmi is true
    studentsWithAssignTmi = (
        db.session.query(
            Student.id,
            ClassSchedule.chattStateANumber,
            Student.firstName,
            Student.lastName,
            Student.email,
        )
        .select_from(Student)
        .join(ClassSchedule)
        .join(ClassSchedule.ClassAttendanceLog)
        .filter(
            ClassAttendanceLog.classDate >= startPeriod,
            ClassAttendanceLog.classDate <= endPeriod,
            ClassAttendanceLog.assignTmi == True,
        )
    ).distinct()
    # Check whether a chattStateANumber is passed as an optional kwarg
    # If so, filter the results for a single student instead of all students
    # This case is used to send TMI notifications for an individual student
    if "chattStateANumber" in kwargs:
        chattStateANumber = kwargs["chattStateANumber"]
        studentsWithAssignTmi = studentsWithAssignTmi.filter(
            ClassSchedule.chattStateANumber == chattStateANumber
        )
    results = studentsWithAssignTmi.all()
    # print(str(studentsWithAssignTmi))
    return results


def findTmiClassesForStudent(startPeriod, endPeriod, chattStateANumber):
    # Return logs marked assignTmi=True for a student in a specificed time period
    tmiClasses = (
        db.session.query(ClassAttendanceLog)
        .join(ClassSchedule)
        .filter(
            ClassAttendanceLog.classDate >= startPeriod,
            ClassAttendanceLog.classDate <= endPeriod,
            ClassAttendanceLog.assignTmi == True,
            ClassSchedule.chattStateANumber == chattStateANumber,
        )
    ).all()
    # print(chattStateANumber, tmiClasses)
    return tmiClasses


def updateInterventionLogForTmi(
    chattStateANumber,
    tmiDate,
    tmiMinutes,
    interventionStatus,
    studentNotification,
    parentNotification,
):
    # Check if there is existing TMI intervention for the student
    # If one exists, update the intervention status and TMI minutes
    # If one doesn't exist, add a new intervention for the student
    tmiInterventionForStudent = InterventionLog.query.filter(
        InterventionLog.intervention_id == 3,
        InterventionLog.startDate == tmiDate,
        InterventionLog.chattStateANumber == chattStateANumber,
    ).first()
    if tmiInterventionForStudent:
        print("update tmi intervention")
        log = InterventionLog.query.filter(
            InterventionLog.id == tmiInterventionForStudent.id
        ).first()
        # log.comment = interventionStatus
        log.tmiMinutes = tmiMinutes
        if studentNotification:
            log.studentNotification = studentNotification
        if parentNotification:
            log.parentNotification = parentNotification
    else:
        print("add new intervention")
        add_InterventionLog(
            chattStateANumber=chattStateANumber,
            interventionType=3,
            interventionLevel=1,
            startDate=tmiDate,
            endDate=tmiDate,
            comment="",
            tmiMinutes=tmiMinutes,
        )
    return


def calculateTmi(
    startTmiPeriod,
    endTmiPeriod,
    tmiDate,
    sendStudentTmiNotification,
    sendParentTmiNotification,
    **kwargs,
):
    printLogEntry("calculateTMI() function called")
    # Check whether a chattStateANumber is passed as an optional kwarg
    # If so, process the request for a single student instead of all students
    # This case is used to send TMI notifications for an individual student
    if "chattStateANumber" in kwargs:
        chattStateANumber = kwargs["chattStateANumber"]
        studentsWithAssignTmi = getStudentsWithAssignTmi(
            startTmiPeriod, endTmiPeriod, chattStateANumber=chattStateANumber
        )
    else:
        # Remove tmi interventions for students with no classes marked assignTmi=True
        tmiInterventionLogs = getStudentsWithTmiInterventions(tmiDate)
        # Cycle through list of tmi logs
        for tmiLog in tmiInterventionLogs:
            # Search for classes with assignTmi=True
            tmiClassesSearchResult = (
                db.session.query(ClassAttendanceLog)
                .join(ClassSchedule)
                .filter(
                    ClassSchedule.chattStateANumber == tmiLog.chattStateANumber,
                    ClassAttendanceLog.classDate >= startTmiPeriod,
                    ClassAttendanceLog.classDate <= endTmiPeriod,
                    ClassAttendanceLog.assignTmi == True,
                )
                .all()
            )
            # If no classes found, then delete the log from the intervention log
            if len(tmiClassesSearchResult) == 0:
                db.session.delete(tmiLog)
        studentsWithAssignTmi = getStudentsWithAssignTmi(startTmiPeriod, endTmiPeriod)

    for student in studentsWithAssignTmi:
        student_id = student[0]
        chattStateANumber = student[1]
        studentFirstName = student[2]
        studentLastName = student[3]
        studentEmail = student[4]
        tmiClasses = findTmiClassesForStudent(
            startTmiPeriod, endTmiPeriod, chattStateANumber
        )
        tmiMinutes = 0
        tardyFlag = False
        classAttendanceLogList = []

        for log in tmiClasses:
            attendanceCode = log.attendanceCode
            classAttendanceLogID = log.id
            className = log.ClassSchedule.className
            classDate = log.classDate
            teacherLastName = log.ClassSchedule.teacherLastName
            chattStateANumber = log.ClassSchedule.chattStateANumber

            if attendanceCode == "T" and tardyFlag == True:
                classAttendanceArrayItem = {
                    "classDate": classDate,
                    "className": className,
                    "attendanceType": "Tardy",
                    "teacherLastName": teacherLastName,
                }
                classAttendanceLogList.append(classAttendanceArrayItem)

            elif attendanceCode == "T" and tardyFlag == False:
                tmiMinutes = tmiMinutes + 90
                tardyFlag = True
                classAttendanceArrayItem = {
                    "classDate": classDate,
                    "className": className,
                    "attendanceType": "Tardy",
                    "teacherLastName": teacherLastName,
                }
                classAttendanceLogList.append(classAttendanceArrayItem)

            elif attendanceCode == "E":
                tmiMinutes = tmiMinutes + 120
                classAttendanceArrayItem = {
                    "classDate": classDate,
                    "className": className,
                    "attendanceType": "Excused Absence (But Missing Work)",
                    "teacherLastName": teacherLastName,
                }
                classAttendanceLogList.append(classAttendanceArrayItem)

            elif attendanceCode == "U":
                tmiMinutes = tmiMinutes + 120
                classAttendanceArrayItem = {
                    "classDate": classDate,
                    "className": className,
                    "attendanceType": "Unexcused Absence",
                    "teacherLastName": teacherLastName,
                }
                classAttendanceLogList.append(classAttendanceArrayItem)

        maxTmiMinutes = 420
        if tmiMinutes > maxTmiMinutes:
            tmiMinutes = maxTmiMinutes

        interventionStatus = "Pending"
        studentNotification = None
        parentNotification = None
        print(chattStateANumber, classAttendanceLogList, tmiMinutes)
        print("tmiMinutes:", type(tmiMinutes), tmiMinutes)

        # Prepare and send TMI notification emails
        # Ignore cases where tmiMinutes = 0 (e.g., attendanceType is Q for question)
        # If sendStudentNotification == True, then get email recipient and appropriate email template
        if sendStudentTmiNotification and tmiMinutes > 0:
            print(
                "sendStudentTmiNotification is",
                sendStudentTmiNotification,
                "and tmiMinutes =",
                tmiMinutes,
            )
            email_to = studentEmail
            interventionStatus = "Student notification sent"
            studentNotification = datetime.utcnow()
            try:
                template = (
                    p2mtTemplates.query.filter(
                        InterventionType.interventionType == "Attendance",
                        p2mtTemplates.interventionLevel == 1,
                        p2mtTemplates.sendToParent == False,
                        p2mtTemplates.sendToStudent == True,
                    )
                    .join(InterventionType)
                    .first()
                )
                print("Using template:", template.templateTitle)
            except:
                print(
                    "No template exists for attendance intervention, level 1, for student notifications"
                )
        # If sendParentTmiNotification == True, then get email recipient and appropriate email template
        if sendParentTmiNotification and tmiMinutes > 0:
            print(
                "sendParentTmiNotification is",
                sendParentTmiNotification,
                "and tmiMinutes =",
                tmiMinutes,
            )
            email_to = [studentEmail] + getParentEmails(chattStateANumber)
            interventionStatus = "Parent notification sent"
            parentNotification = datetime.utcnow()
            try:
                template = (
                    p2mtTemplates.query.filter(
                        InterventionType.interventionType == "Attendance",
                        p2mtTemplates.interventionLevel == 1,
                        p2mtTemplates.sendToParent == True,
                        p2mtTemplates.sendToStudent == True,
                    )
                    .join(InterventionType)
                    .first()
                )
                print("Using template:", template.templateTitle)
            except:
                print(
                    "No template exists for attendance intervention, level 1, for parent notifications"
                )
        # Render email template with data and send the email
        if (sendStudentTmiNotification or sendParentTmiNotification) and tmiMinutes > 0:
            print(
                "sendStudentTmiNotification is",
                sendStudentTmiNotification,
                "sendParentTmiNotification is",
                sendParentTmiNotification,
                "and tmiMinutes =",
                tmiMinutes,
            )
            templateParams = {
                "chattStateANumber": chattStateANumber,
                "studentFirstName": studentFirstName,
                "studentLastName": studentLastName,
                "tmiDate": tmiDate,
                "tmiMinutes": tmiMinutes,
                "classAttendanceLogList": classAttendanceLogList,
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
            except:
                interventionStatus = "Error sending email"

        # Update intervention log
        updateInterventionLogForTmi(
            chattStateANumber,
            tmiDate,
            tmiMinutes,
            interventionStatus,
            studentNotification,
            parentNotification,
        )
    return


def downloadTmiLog(tmiDate):
    printLogEntry("downloadTmiLog() function called")
    # Create a CSV output file and append with a timestamp
    output_file_path = os.path.join(current_app.root_path, "static/download")
    output_file_path = "/tmp"
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    csvFilename = output_file_path + "/" + "tmilog_" + timestamp + ".csv"
    csvOutputFile = open(csvFilename, "w")
    csvOutputWriter = csv.writer(
        csvOutputFile, delimiter=",", quotechar='"', quoting=csv.QUOTE_MINIMAL
    )
    csvOutputFileRowCount = 0
    # Write header row for CSV file
    csvOutputWriter.writerow(["firstName", "lastName", "tmiMinutes"])
    tmiLogs = (
        db.session.query(
            Student.firstName, Student.lastName, InterventionLog.tmiMinutes
        )
        .select_from(Student)
        .join(InterventionLog)
        .filter(
            InterventionLog.intervention_id == 3,
            InterventionLog.interventionLevel == 1,
            InterventionLog.startDate == tmiDate,
        )
        .all()
    )
    for log in tmiLogs:
        csvOutputWriter.writerow(
            [log.firstName, log.lastName, log.tmiMinutes,]
        )
        # print(
        #     log.firstName, log.lastName, log.tmiMinutes,
        # )
    csvOutputFileRowCount = csvOutputFileRowCount + 1
    csvOutputFile.close()
    return send_file(csvFilename, as_attachment=True, cache_timeout=0)
