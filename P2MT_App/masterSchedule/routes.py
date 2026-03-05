from flask import render_template, redirect, url_for, flash, Blueprint, request
from flask_login import login_required
from datetime import date
from P2MT_App import db
from P2MT_App.main.utilityfunctions import printLogEntry, printFormErrors
from P2MT_App.models import ClassSchedule, ClassAttendanceLog
from P2MT_App.scheduleAdmin.ScheduleAdmin import downloadClassSchedule
from P2MT_App.main.referenceData import (
    getCurrentSchoolYear,
    getSchoolYearForFallSemester,
    getSchoolYearForSpringSemester,
    getCurrentSemester,
    getStudentName,
    getSchoolYear,
    getSemester,
    getTeachers,
    getStemAndChattStateClassNames,
    getCampusChoices,
)
from P2MT_App.masterSchedule.forms import editSingleClassSchedule

masterSchedule_bp = Blueprint("masterSchedule_bp", __name__)


@masterSchedule_bp.route("/masterschedule/download")
@login_required
def download_MasterSchedule():
    printLogEntry("download_MasterSchedule() function called")
    return downloadClassSchedule(getCurrentSchoolYear(), getCurrentSemester())


@masterSchedule_bp.route("/masterschedule", methods=["GET", "POST"])
@login_required
def displayMasterSchedule():
    printLogEntry("Running displayMasterSchedule()")
    if request.method == "POST":
        if request.form["displaySemester"] == "Fall":
            displayYear = getSchoolYearForFallSemester()
            displaySemester = "Fall"
            displayFallSemester = "checked"
            displaySpringSemester = ""
        elif request.form["displaySemester"] == "Spring":
            displayYear = getSchoolYearForSpringSemester()
            displaySemester = "Spring"
            displayFallSemester = ""
            displaySpringSemester = "checked"
    else:
        displayYear = getCurrentSchoolYear()
        displaySemester = getCurrentSemester()
        if displaySemester == "Fall":
            displayFallSemester = "checked"
            displaySpringSemester = ""
        else:
            displayFallSemester = ""
            displaySpringSemester = "checked"

    ClassSchedules = ClassSchedule.query.filter(
        ClassSchedule.learningLab == False,
        ClassSchedule.schoolYear == displayYear,
        ClassSchedule.semester == displaySemester,
    ).order_by(ClassSchedule.chattStateANumber.desc())
    return render_template(
        "masterschedule.html",
        title="Master Schedule",
        ClassSchedules=ClassSchedules,
        displayFallSemester=displayFallSemester,
        displaySpringSemester=displaySpringSemester,
    )


@masterSchedule_bp.route("/masterschedule/<int:log_id>/delete", methods=["POST"])
@login_required
def delete_ClassSchedule(log_id):

    log = ClassSchedule.query.get_or_404(log_id)
    LogDetails = f"{(log_id)} {log.chattStateANumber} {log.className}"
    printLogEntry("Running deleteClassSchedule(" + LogDetails + ")")
    db.session.delete(log)
    db.session.commit()
    flash("Class schedule has been deleted!", "success")
    return redirect(url_for("masterSchedule_bp.displayMasterSchedule"))


@masterSchedule_bp.route("/masterschedule/<int:log_id>/edit", methods=["POST"])
@login_required
def edit_ClassSchedule(log_id):
    editSingleClassScheduleDetails = editSingleClassSchedule()
    editSingleClassScheduleDetails.schoolYear.choices = getSchoolYear()
    editSingleClassScheduleDetails.semester.choices = getSemester()
    editSingleClassScheduleDetails.teacherName.choices = getTeachers()
    editSingleClassScheduleDetails.campus.choices = getCampusChoices()
    editSingleClassScheduleDetails.className.choices = getStemAndChattStateClassNames()
    editSingleClassScheduleDetails.classDays.choices = [
        ("M", "M"),
        ("T", "T"),
        ("W", "W"),
        ("R", "R"),
        ("F", "F"),
    ]

    log = ClassSchedule.query.get_or_404(log_id)
    LogDetails = f"{(log_id)} {log.chattStateANumber} {log.className}"
    printLogEntry("Running update_ClassSchedule(" + LogDetails + ")")

    if "submitEditSingleClassSchedule" in request.form:
        print("request.form", request.form)
        if not editSingleClassScheduleDetails.validate_on_submit():
            print("Edit Class Form errors")
            printFormErrors(editSingleClassScheduleDetails)
        if editSingleClassScheduleDetails.validate_on_submit():
            print("submitEditSingleClassSchedule submitted")
            # Get the pre-update class days and times for use in log comment later
            preUpdateClassDays = log.classDays
            preUpdateStartTime = log.startTime
            preUpdateEndTime = log.endTime

            # Update the database with the values submitted in the form
            log.schoolYear = editSingleClassScheduleDetails.schoolYear.data
            log.semester = editSingleClassScheduleDetails.semester.data
            log.campus = editSingleClassScheduleDetails.campus.data
            log.className = editSingleClassScheduleDetails.className.data
            log.teacherLastName = editSingleClassScheduleDetails.teacherName.data
            classDaysList = editSingleClassScheduleDetails.classDays.data
            classDays = ""
            for classDay in classDaysList:
                classDays = classDays + classDay
            print("classDaysList=", classDaysList)
            # Set updatedClassDays to True if the classDays are updated
            # updatedClassDays is used to determine whether to delete attendance logs
            if classDays == preUpdateClassDays:
                updatedClassDays = False
            else:
                updatedClassDays = True
                log.classDays = classDays
            startTime = editSingleClassScheduleDetails.startTime.data
            endTime = editSingleClassScheduleDetails.endTime.data
            updatedTimes = False
            # Set updatedTimes to True if the class times are updated
            # updatedTimes is used to determine whether to append comment to attendance logs
            if startTime != preUpdateStartTime:
                updatedTimes = True
                log.startTime = startTime
            if endTime != preUpdateEndTime:
                updatedTimes = True
                log.endTime = endTime
            log.online = editSingleClassScheduleDetails.online.data
            log.indStudy = editSingleClassScheduleDetails.indStudy.data
            log.comment = editSingleClassScheduleDetails.comment.data
            log.googleCalendarEventID = (
                editSingleClassScheduleDetails.googleCalendarEventID.data
            )
            db.session.commit()

            # If classDays change, delete any class attendance logs that are null
            # If logs have attendance code, append a comment explaining the original class days and times
            # If class days or class times changes, append a comment on logs with an attendance code
            if updatedClassDays or updatedTimes:
                print(
                    "classDays or class times updated -- reviewing associated class attendance logs"
                )
                attendanceLogs = ClassAttendanceLog.query.filter(
                    ClassAttendanceLog.classSchedule_id == log.id
                ).all()
                for attendanceLog in attendanceLogs:
                    # Delete class logs with null attendance codes and new days
                    if attendanceLog.attendanceCode == None and updatedClassDays:
                        db.session.delete(attendanceLog)
                        db.session.commit()
                        print(
                            "Deleting attendance log for ",
                            log.className,
                            "on",
                            attendanceLog.classDate,
                        )
                    # Append comment to logs with attendance codes noting the original class schedule info
                    if attendanceLog.attendanceCode != None and (
                        updatedTimes or updatedClassDays
                    ):
                        scheduleComment = (
                            "[Class schedule changed from: "
                            + preUpdateClassDays
                            + " "
                            + preUpdateStartTime.strftime("%-I:%M")
                            + "-"
                            + preUpdateEndTime.strftime("%-I:%M")
                            + " on "
                            + date.today().strftime("%-m/%-d/%Y")
                            + "] "
                        )
                        if attendanceLog.comment == None:
                            attendanceLog.comment = ""
                        attendanceLog.comment = scheduleComment + attendanceLog.comment
                        db.session.commit()
                        print("Appending attendanceLog.comment:", attendanceLog.comment)

            return redirect(url_for("masterSchedule_bp.displayMasterSchedule"))

    studentName = getStudentName(log.chattStateANumber)
    print("studentName =", studentName)
    if log:
        # editSingleClassScheduleDetails.schoolYear.choices = getSchoolYear()
        # editSingleClassScheduleDetails.semester.choices = getSemester()
        # editSingleClassScheduleDetails.teacherName.choices = getTeachers()
        # editSingleClassScheduleDetails.campus.choices = getCampusChoices()
        # editSingleClassScheduleDetails.className.choices = (
        #     getStemAndChattStateClassNames()
        # )
        # editSingleClassScheduleDetails.classDays.choices = [
        #     ("M", "M"),
        #     ("T", "T"),
        #     ("W", "W"),
        #     ("R", "R"),
        #     ("F", "F"),
        # ]

        editSingleClassScheduleDetails.log_id.data = log.id
        editSingleClassScheduleDetails.schoolYear.data = log.schoolYear
        editSingleClassScheduleDetails.semester.data = log.semester
        editSingleClassScheduleDetails.campus.data = log.campus
        editSingleClassScheduleDetails.className.data = log.className
        editSingleClassScheduleDetails.teacherName.data = log.teacherLastName
        # Set classDays by creating list of days from string (e.g., 'MWF' -> [M, W, F])
        classDaysList = []
        for classDay in log.classDays:
            classDaysList.append(classDay)
        editSingleClassScheduleDetails.classDays.data = classDaysList

        editSingleClassScheduleDetails.startTime.data = log.startTime
        editSingleClassScheduleDetails.endTime.data = log.endTime
        editSingleClassScheduleDetails.online.data = log.online
        editSingleClassScheduleDetails.indStudy.data = log.indStudy
        editSingleClassScheduleDetails.comment.data = log.comment
        editSingleClassScheduleDetails.googleCalendarEventID.data = (
            log.googleCalendarEventID
        )
        print(
            "editSingleClassScheduleDetails=",
            editSingleClassScheduleDetails.log_id.data,
            editSingleClassScheduleDetails.schoolYear.data,
            editSingleClassScheduleDetails.classDays.data,
        )
    return render_template(
        "updatemasterschedule.html",
        title="Update Master Schedule",
        editSingleClassSchedule=editSingleClassScheduleDetails,
        studentName=studentName,
    )
