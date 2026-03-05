from flask import render_template, flash, request, Blueprint
from flask_login import login_required
from P2MT_App import db
from P2MT_App.main.utilityfunctions import printLogEntry
from P2MT_App.models import (
    Student,
    ClassSchedule,
    ClassAttendanceLog,
    DailyAttendanceLog,
)
from P2MT_App.classAttendance.forms import (
    updateClassAttendanceForm,
    updateStudentAttendanceForm,
)
from P2MT_App.main.referenceData import getTeachers, getClassNames
from datetime import date

classAttendance_bp = Blueprint("classAttendance_bp", __name__)


@classAttendance_bp.route("/classattendancelog", methods=["GET", "POST"])
@login_required
def displayClassAttendanceLog():
    printLogEntry("Running displayClassAttendanceLog()")
    classAttendanceForm = updateClassAttendanceForm()
    classAttendanceForm.teacherName.choices = getTeachers()
    # Update class choices to remove blank choice and include "All Classes" as default
    classNameChoices = list(getClassNames())
    classNameChoices.remove(("", ""))
    classNameChoices.insert(0, ("All Classes", "All Classes"))
    classAttendanceForm.className.choices = tuple(classNameChoices)

    classDateTime = date.today()
    # classDateTime = datetime(
    #     datetime.today().year, datetime.today().month, datetime.today().day, 0, 0, 0, 0
    # )
    # print(
    #     "\nclassAttendanceForm.identifier.data = ", classAttendanceForm.identifier.data
    # )
    print(
        "classAttendanceForm.updateFiltersFlag.data =",
        classAttendanceForm.updateFiltersFlag.data,
    )

    print("request.method =", request.method)

    if classAttendanceForm.validate_on_submit():
        print(
            "classAttendanceForm.validate_on_submit() =",
            classAttendanceForm.validate_on_submit(),
        )
    print("classAttendanceForm.errors =", classAttendanceForm.errors)

    # if classAttendanceForm.identifier.data is None:
    if request.method == "GET":

        if classAttendanceForm.classDate.data:
            classDateTime = classAttendanceForm.classDate.data
            classAttendanceForm.classDate.default = classDateTime
        else:
            classDateTime = date.today()
            # classDateTime = datetime.now()
            # classDateTime = classDateTime.replace(
            #     hour=0, minute=0, second=0, microsecond=0
            # )
            classAttendanceForm.classDate.data = classDateTime
            # classAttendanceForm.classDate.data = classDateTime.date()

        classAttendanceForm.className.default = classAttendanceForm.className.data
        classAttendanceForm.teacherName.default = classAttendanceForm.teacherName.data
        classAttendanceForm.updateFiltersFlag.data = ""

    if classAttendanceForm.validate_on_submit():

        # Update default values for teacher name and class name
        classAttendanceForm.className.default = classAttendanceForm.className.data
        classAttendanceForm.teacherName.default = classAttendanceForm.teacherName.data

        # Format class date for compatibility with database
        classDate = classAttendanceForm.classDate.data
        classDateTime = classDate
        print(classDate, classDateTime)
        # classDateTime = datetime(
        #     classDate.year, classDate.month, classDate.day, 0, 0, 0, 0
        # )
        print(
            "classAttendanceForm.updateFiltersFlag.data =",
            classAttendanceForm.updateFiltersFlag.data,
        )

        # Update database with attendance updates
        if (
            classAttendanceForm.classMembers
            and classAttendanceForm.updateFiltersFlag.data != "updated"
        ):
            print("Class attendance submitted")
            print(len(classAttendanceForm.classMembers.data))
            for studentForm in classAttendanceForm.classMembers.data:
                if studentForm["updateFlag"] == "updated":
                    # Record updated attendance for student
                    log_id = studentForm["log_id"]
                    print("log_id = ", log_id)
                    classAttendanceLog = ClassAttendanceLog.query.get_or_404(log_id)
                    classAttendanceLog.attendanceCode = studentForm["attendanceCode"]
                    classAttendanceLog.comment = studentForm["comment"]

                    # Don't mark assignTmi for missed learning labs
                    learningLab = classAttendanceLog.ClassSchedule.learningLab
                    if classAttendanceLog.attendanceCode == "P" and not learningLab:
                        classAttendanceLog.assignTmi = False
                    if classAttendanceLog.attendanceCode == "E" and not learningLab:
                        classAttendanceLog.assignTmi = False
                    # if classAttendanceLog.attendanceCode == "T":
                    #     classAttendanceLog.assignTmi = False
                    if classAttendanceLog.attendanceCode == "U" and not learningLab:
                        classAttendanceLog.assignTmi = True
                    if classAttendanceLog.attendanceCode == "Q" and not learningLab:
                        classAttendanceLog.assignTmi = True
                    db.session.commit()

        # Need to run the next statement [classAttendanceForm.process()]
        # or the updated values for the studentAttendanceForm won't display
        classAttendanceForm.process()

    # Retrive updated fixed-value attendance fields from database

    # If "All Classes" is selected, display all clases
    # Otherwise, only display classes for selecetd class
    if classAttendanceForm.className.default == "All Classes":
        print("All classes selected")
        classAttendanceFixedFields = (
            db.session.query(ClassAttendanceLog, ClassSchedule, DailyAttendanceLog)
            .select_from(ClassAttendanceLog)
            .join(ClassSchedule)
            .join(ClassSchedule.Student)
            .outerjoin(
                DailyAttendanceLog,
                (ClassAttendanceLog.classDate == DailyAttendanceLog.absenceDate)
                & (
                    ClassSchedule.chattStateANumber
                    == DailyAttendanceLog.chattStateANumber
                ),
            )
            .filter(
                ClassAttendanceLog.classDate == classDateTime,
                ClassSchedule.teacherLastName
                == classAttendanceForm.teacherName.default,
            )
            .order_by(
                ClassSchedule.startTime, ClassSchedule.className, Student.lastName
            )
            .all()
        )
    else:
        classAttendanceFixedFields = (
            db.session.query(ClassAttendanceLog, ClassSchedule, DailyAttendanceLog)
            .select_from(ClassAttendanceLog)
            .join(ClassSchedule)
            .join(ClassSchedule.Student)
            .outerjoin(
                DailyAttendanceLog,
                (ClassAttendanceLog.classDate == DailyAttendanceLog.absenceDate)
                & (
                    ClassSchedule.chattStateANumber
                    == DailyAttendanceLog.chattStateANumber
                ),
            )
            .filter(
                ClassAttendanceLog.classDate == classDateTime,
                ClassSchedule.teacherLastName
                == classAttendanceForm.teacherName.default,
                ClassSchedule.className == classAttendanceForm.className.default,
            )
            .order_by(
                ClassSchedule.startTime, ClassSchedule.className, Student.lastName
            )
            .all()
        )

    # Retrieve updated student attendance fields from database
    for studentAttendance in classAttendanceFixedFields:
        print(studentAttendance)
        studentAttendanceForm = updateStudentAttendanceForm()
        studentAttendanceForm.log_id = studentAttendance.ClassAttendanceLog.id
        studentAttendanceForm.attendanceCode = (
            studentAttendance.ClassAttendanceLog.attendanceCode
        )
        studentAttendanceForm.comment = studentAttendance.ClassAttendanceLog.comment
        studentAttendanceForm.updateFlag = ""
        print(
            "ROSTER ",
            studentAttendanceForm.log_id,
            studentAttendance.ClassSchedule.className,
            studentAttendance.ClassSchedule.startTime,
            studentAttendance.ClassSchedule.endTime,
            studentAttendance.ClassSchedule.Student.firstName,
            studentAttendance.ClassSchedule.Student.lastName,
            studentAttendanceForm.attendanceCode,
            studentAttendanceForm.comment,
        )
        classAttendanceForm.classMembers.append_entry(studentAttendanceForm)

    # Reset the updateFiltersFlag before rendering page
    classAttendanceForm.updateFiltersFlag.data = ""

    print("Final before render_template")
    print(
        "classAttendanceForm.classDate.default =",
        classAttendanceForm.classDate.default,
    )
    print(
        "classAttendanceForm.classDate.data =", classAttendanceForm.classDate.data,
    )
    return render_template(
        "classattendancelog.html",
        title="Attendance Log",
        classAttendanceForm=classAttendanceForm,
        classAttendanceFixedFields=classAttendanceFixedFields,
    )
