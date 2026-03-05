from flask import render_template, flash, request, Blueprint, redirect, url_for
from flask_login import login_required
from P2MT_App import db
from P2MT_App.main.utilityfunctions import printLogEntry
from P2MT_App.models import (
    Student,
    ClassSchedule,
    ClassAttendanceLog,
    InterventionLog,
    DailyAttendanceLog,
)
from P2MT_App.main.referenceData import getCurrent_Start_End_Tmi_Dates
from datetime import date
from P2MT_App.tmiFinalApproval.tmiFinalApproval import (
    calculateTmi,
    assignTmiForTardy,
    downloadTmiLog,
)

tmiFinalApproval_bp = Blueprint("tmiFinalApproval_bp", __name__)


@tmiFinalApproval_bp.route("/tmifinalapproval", methods=["GET", "POST"])
@login_required
def displayTmiFinalApproval():
    printLogEntry("Running displayTmiFinalApproval()")
    startTmiPeriod, endTmiPeriod, tmiDate = getCurrent_Start_End_Tmi_Dates()

    sendStudentTmiNotification = False
    sendParentTmiNotification = False
    if request.method == "POST":
        print("Send TMI notification form:", request.form)
        if request.form["submit_button"] == "Send Student Notifications":
            sendStudentTmiNotification = True
        elif request.form["submit_button"] == "Send Parent Notifications":
            sendParentTmiNotification = True

    # Update assignTmi for students with tardies
    assignTmiForTardy(startTmiPeriod, endTmiPeriod)
    db.session.commit()

    classAttendanceFixedFields = (
        db.session.query(ClassAttendanceLog, ClassSchedule, DailyAttendanceLog)
        .select_from(ClassAttendanceLog)
        .join(ClassSchedule)
        .join(ClassSchedule.Student)
        .outerjoin(
            DailyAttendanceLog,
            (ClassAttendanceLog.classDate == DailyAttendanceLog.absenceDate)
            & (ClassSchedule.chattStateANumber == DailyAttendanceLog.chattStateANumber),
        )
        .filter(
            ClassAttendanceLog.classDate >= startTmiPeriod,
            ClassAttendanceLog.classDate <= endTmiPeriod,
        )
        .filter(ClassAttendanceLog.assignTmi == True)
        .order_by(
            Student.lastName, ClassAttendanceLog.classDate, ClassSchedule.className
        )
        .all()
    )

    calculateTmi(
        startTmiPeriod,
        endTmiPeriod,
        tmiDate,
        sendStudentTmiNotification,
        sendParentTmiNotification,
    )
    db.session.commit()

    tmiInterventionLog = (
        InterventionLog.query.filter(
            InterventionLog.intervention_id == 3, InterventionLog.startDate == tmiDate
        )
        .join(Student)
        .order_by(Student.lastName)
        .all()
    )
    for log in tmiInterventionLog:
        print("log time=", log.Student.lastName, log.studentNotification)

    return render_template(
        "tmifinalapproval.html",
        title="TMI Final Approval",
        classAttendanceFixedFields=classAttendanceFixedFields,
        tmiInterventionLog=tmiInterventionLog,
        startTmiPeriod=startTmiPeriod,
        endTmiPeriod=endTmiPeriod,
        tmiDay=tmiDate,
    )


@tmiFinalApproval_bp.route(
    "/tmifinalapproval/<int:log_id>/sendtminotification", methods=["POST"]
)
@login_required
def sendTmiNotification(log_id):
    # Process request to email TMI notification for a single student
    # Get the TMI intervention log for the student
    log = InterventionLog.query.get_or_404(log_id)
    LogDetails = f"{(log_id)} {log.chattStateANumber} {log.staffID}"
    printLogEntry("Running sendTmiNotification(" + LogDetails + ")")
    sendStudentTmiNotification = False
    sendParentTmiNotification = False
    # Determine whether the notification goes to the student or parent
    if request.method == "POST":
        print("Send TMI notification form:", request.form)
        if request.form["submit_button"] == "Send Student Notification":
            sendStudentTmiNotification = True
        elif request.form["submit_button"] == "Send Parent Notification":
            sendParentTmiNotification = True
    # Get the start, end, and actual date for this TMI period
    startTmiPeriod, endTmiPeriod, tmiDate = getCurrent_Start_End_Tmi_Dates()
    # Call calculateTmi but include the chattStateANumber as an optional kwarg
    calculateTmi(
        startTmiPeriod,
        endTmiPeriod,
        tmiDate,
        sendStudentTmiNotification,
        sendParentTmiNotification,
        chattStateANumber=log.chattStateANumber,
    )
    db.session.commit()
    return redirect(url_for("tmiFinalApproval_bp.displayTmiFinalApproval"))


@tmiFinalApproval_bp.route("/tmifinalapproval/download")
@login_required
def download_TmiLog():
    printLogEntry("download_TmiLog() function called")
    startTmiPeriod, endTmiPeriod, tmiDate = getCurrent_Start_End_Tmi_Dates()
    return downloadTmiLog(tmiDate)
