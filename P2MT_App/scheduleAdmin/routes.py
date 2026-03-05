from flask import (
    render_template,
    redirect,
    url_for,
    flash,
    request,
    Blueprint,
    send_file,
)
from flask_login import login_required
from P2MT_App import db
from sqlalchemy import func, literal, union
from P2MT_App.models import ClassSchedule
from P2MT_App.scheduleAdmin.forms import (
    uploadClassScheduleForm,
    propagateClassAttendanceLogsForm,
    deleteClassScheduleForm,
    downloadClassScheduleForm,
    downloadClassAttendanceForm,
    addSingleClassSchedule,
)
from P2MT_App.main.referenceData import (
    getTeachers,
    getClassNames,
    getSchoolYear,
    getSemester,
    getStudents,
    getCampusChoices,
    getYearOfGraduation,
    get_protected_schedules,
    getCurrentSchoolYear,
    getCurrentSemester,
)
from P2MT_App.scheduleAdmin.ScheduleAdmin import (
    propagateClassSchedule,
    uploadSchedules,
    deleteClassSchedule,
    downloadClassSchedule,
    downloadClassAttendanceLog,
    addClassSchedule,
    getDuplicateSchedule,
)
from P2MT_App.main.utilityfunctions import save_File
from P2MT_App.main.utilityfunctions import printLogEntry, printFormErrors
from P2MT_App.main.setupFunctions import extendSchoolCalendarIfNecessary

from datetime import time

scheduleAdmin_bp = Blueprint("scheduleAdmin_bp", __name__)

# Route for direct download from templates folder
@scheduleAdmin_bp.route("/templates/class_schedule_template")
@login_required
def downloadClassScheduleTemplate():
    try:
        return send_file(
            "static/templates/class_schedule_template.csv",
            attachment_filename="class_schedule_template.csv",
            as_attachment=True,
            cache_timeout=0,
        )
    except Exception as e:
        return str(e)


@scheduleAdmin_bp.route("/scheduleadmin", methods=["GET", "POST"])
@login_required
def displayScheduleAdmin():
    printLogEntry("Running displayScheduleAdmin()")
    extendSchoolCalendarIfNecessary()
    uploadClassScheduleFormDetails = uploadClassScheduleForm()
    propagateClassAttendanceLogsFormDetails = propagateClassAttendanceLogsForm()
    propagateClassAttendanceLogsFormDetails.schoolYear.choices = getSchoolYear()
    propagateClassAttendanceLogsFormDetails.semester.choices = getSemester()
    deleteClassScheduleFormDetails = deleteClassScheduleForm()
    deleteClassScheduleFormDetails.schoolYear.choices = getSchoolYear()
    deleteClassScheduleFormDetails.semester.choices = getSemester()
    deleteClassScheduleFormDetails.yearOfGraduation.choices = getYearOfGraduation()
    downloadClassScheduleFormDetails = downloadClassScheduleForm()
    downloadClassScheduleFormDetails.schoolYear.choices = getSchoolYear()
    downloadClassScheduleFormDetails.semester.choices = getSemester()
    downloadClassAttendanceFormDetails = downloadClassAttendanceForm()
    downloadClassAttendanceFormDetails.schoolYear.choices = getSchoolYear()
    downloadClassAttendanceFormDetails.semester.choices = getSemester()
    downloadClassAttendanceFormDetails.teacherName.choices = getTeachers()
    addSingleClassScheduleDetails = addSingleClassSchedule()
    addSingleClassScheduleDetails.schoolYear.choices = getSchoolYear()
    addSingleClassScheduleDetails.semester.choices = getSemester()
    addSingleClassScheduleDetails.teacherName.choices = getTeachers()
    addSingleClassScheduleDetails.studentName.choices = getStudents()
    addSingleClassScheduleDetails.campus.choices = getCampusChoices()
    addSingleClassScheduleDetails.className.choices = getClassNames()
    addSingleClassScheduleDetails.classDays.choices = [
        ("M", "M"),
        ("T", "T"),
        ("W", "W"),
        ("R", "R"),
        ("F", "F"),
    ]
    if request.method == "POST":
        printLogEntry("form= " + str(request.form))

    if "submitUploadClassSchedule" in request.form:
        if uploadClassScheduleFormDetails.validate_on_submit():
            printLogEntry("Upload Form Submitted")
            if uploadClassScheduleFormDetails.csvClassScheduleFile.data:
                uploadedScheduleFile = save_File(
                    uploadClassScheduleFormDetails.csvClassScheduleFile.data,
                    "Uploaded_Schedule_File.csv",
                )
                uploadSchedules(uploadedScheduleFile)
                return redirect(url_for("scheduleAdmin_bp.displayScheduleAdmin"))
    printFormErrors(uploadClassScheduleFormDetails)
    if "submitPropagatelassAttendanceLogs" in request.form:
        if propagateClassAttendanceLogsFormDetails.validate_on_submit():
            printLogEntry("Propagate Form Submitted")
            schoolYear = int(propagateClassAttendanceLogsFormDetails.schoolYear.data)
            semester = propagateClassAttendanceLogsFormDetails.semester.data
            startDate = propagateClassAttendanceLogsFormDetails.startDate.data
            endDate = propagateClassAttendanceLogsFormDetails.endDate.data
            print(
                "schoolYear=",
                schoolYear,
                "semester=",
                semester,
                "startDate=",
                startDate,
                "endDate=",
                endDate,
            )
            number_of_class_schedules = propagateClassSchedule(
                startDate, endDate, schoolYear, semester
            )
            flash(
                f"Schedules propagated for {number_of_class_schedules} classes.",
                "success",
            )
            return redirect(url_for("scheduleAdmin_bp.displayScheduleAdmin"))
    printFormErrors(propagateClassAttendanceLogsFormDetails)
    if "submitDeleteClassScheduleForm" in request.form:
        if deleteClassScheduleFormDetails.validate_on_submit():
            if (
                deleteClassScheduleFormDetails.confirmDeleteClassSchedule.data
                == "DELETE"
            ):
                printLogEntry("Delete Class Schedule Form Submitted")
                schoolYear = deleteClassScheduleFormDetails.schoolYear.data
                semester = deleteClassScheduleFormDetails.semester.data
                yearOfGraduation = deleteClassScheduleFormDetails.yearOfGraduation.data
                protected_schedule_list = get_protected_schedules()

                print(
                    "SchoolYear =",
                    schoolYear,
                    " Semester =",
                    semester,
                    "yearOfGraduation =",
                    yearOfGraduation,
                )
                year_semester = " ".join([str(schoolYear), semester])
                if year_semester in protected_schedule_list:
                    print(
                        f"The {year_semester} semester schedule is protected and may not be deleted"
                    )
                    flash(
                        f"The {year_semester} semester schedule is protected and may not be deleted",
                        "error",
                    )
                    return redirect(url_for("scheduleAdmin_bp.displayScheduleAdmin"))
                deleteClassSchedule(schoolYear, semester, yearOfGraduation)
                deleteClassScheduleFormDetails.confirmDeleteClassSchedule.data = ""
                deleteClassScheduleFormDetails.process()
                flash(
                    f"Schedule deleted for {schoolYear} {semester} semester for Class of {yearOfGraduation}",
                    "success",
                )
                return redirect(url_for("scheduleAdmin_bp.displayScheduleAdmin"))
            else:
                deleteClassScheduleFormDetails.confirmDeleteClassSchedule.data = ""
                printLogEntry("Type DELETE in the text box to confirm delete")
    if "submitAddSingleClassSchedule" in request.form:
        if addSingleClassScheduleDetails.validate_on_submit():
            printLogEntry("Add Single Class Schedule submitted")
            schoolYear = addSingleClassScheduleDetails.schoolYear.data
            semester = addSingleClassScheduleDetails.semester.data
            chattStateANumber = addSingleClassScheduleDetails.studentName.data
            teacherLastName = addSingleClassScheduleDetails.teacherName.data
            className = addSingleClassScheduleDetails.className.data
            classDaysList = addSingleClassScheduleDetails.classDays.data
            classDays = ""
            for classDay in classDaysList:
                classDays = classDays + classDay
            startTime = addSingleClassScheduleDetails.startTime.data
            endTime = addSingleClassScheduleDetails.endTime.data
            online = addSingleClassScheduleDetails.online.data
            indStudy = addSingleClassScheduleDetails.indStudy.data
            comment = addSingleClassScheduleDetails.comment.data
            googleCalendarEventID = (
                addSingleClassScheduleDetails.googleCalendarEventID.data
            )
            campus = "STEM School"
            staffID = None
            interventionLog_id = None
            learningLab = False

            print(
                schoolYear,
                semester,
                chattStateANumber,
                teacherLastName,
                className,
                classDays,
                startTime,
                endTime,
                online,
                indStudy,
                comment,
                googleCalendarEventID,
                interventionLog_id,
                learningLab,
            )
            duplicateSchedule = getDuplicateSchedule(
                schoolYear,
                semester,
                chattStateANumber,
                campus,
                className,
                teacherLastName,
                staffID,
                online,
                indStudy,
                "".join(classDays),
                startTime,
                endTime,
                learningLab,
            )
            if duplicateSchedule:
                print("duplicate learning lab submitted", locals())
                flash("Schedule already exists", "error")
                return redirect(url_for("scheduleAdmin_bp.displayScheduleAdmin"))
            addClassSchedule(
                schoolYear,
                semester,
                chattStateANumber,
                campus,
                className,
                teacherLastName,
                staffID,
                online,
                indStudy,
                classDays,
                startTime,
                endTime,
                comment,
                googleCalendarEventID,
                interventionLog_id,
                learningLab,
            )
            db.session.commit()
            flash("New schedule added for student", "success")
            return redirect(url_for("scheduleAdmin_bp.displayScheduleAdmin"))

    if "submitDownloadClassScheduleForm" in request.form:
        if downloadClassScheduleFormDetails.validate_on_submit():
            schoolYear = downloadClassScheduleFormDetails.schoolYear.data
            semester = downloadClassScheduleFormDetails.semester.data
            printLogEntry("Download Class Schedule Form Submitted")
            print(
                "SchoolYear=", schoolYear, " Semester=", semester,
            )
            return downloadClassSchedule(schoolYear, semester)
    if "submitDownloadClassAttendanceForm" in request.form:
        if downloadClassAttendanceFormDetails.validate_on_submit():
            schoolYear = downloadClassAttendanceFormDetails.schoolYear.data
            semester = downloadClassAttendanceFormDetails.semester.data
            teacherName = downloadClassAttendanceFormDetails.teacherName.data
            startDate = downloadClassAttendanceFormDetails.startDate.data
            endDate = downloadClassAttendanceFormDetails.endDate.data
            printLogEntry("Download Class Attendance Form Submitted")
            print(
                "SchoolYear=",
                schoolYear,
                " Semester=",
                semester,
                " teacherName=",
                teacherName,
                " startDate=",
                startDate,
                " endDate=",
                endDate,
            )
            return downloadClassAttendanceLog(
                schoolYear, semester, teacherName, startDate, endDate
            )
    return render_template(
        "scheduleadmin.html",
        title="Schedule Admin",
        propagateClassAttendanceLogsForm=propagateClassAttendanceLogsFormDetails,
        uploadClassScheduleForm=uploadClassScheduleFormDetails,
        deleteClassScheduleForm=deleteClassScheduleFormDetails,
        downloadClassScheduleForm=downloadClassScheduleFormDetails,
        downloadClassAttendanceForm=downloadClassAttendanceFormDetails,
        addSingleClassSchedule=addSingleClassScheduleDetails,
    )


@scheduleAdmin_bp.route("/weekly-class-schedules", methods=["GET", "POST"])
@login_required
def displayWeeklyClassSchedules():
    printLogEntry("Running displayWeeklyClassSchedules()")

    current_year = getCurrentSchoolYear()
    current_semester = getCurrentSemester()

    teacherLastNames = list(getTeachers())
    teachers = [teacher[0] for teacher in teacherLastNames if teacher[0] != ""]

    normal_start_of_day = time(9, 30)
    no_earlier_than_time = time(8, 0)

    days = ["M", "T", "W", "R", "F"]

    db_class_sections_teacher = {}
    for teacher in teachers:
        earliest_class_time = time(16, 30)
        show_early_times = False
        schedule_warning = ""
        db_class_sections = {}
        for day in days:
            db_class_sections_day = (
                db.session.query(
                    ClassSchedule.className,
                    ClassSchedule.startTime,
                    ClassSchedule.endTime,
                    literal(day).label("day"),
                    func.count(ClassSchedule.chattStateANumber).label("totalStudents"),
                )
                .filter(
                    ClassSchedule.online == False,
                    ClassSchedule.indStudy == False,
                    ClassSchedule.teacherLastName == teacher,
                    ClassSchedule.schoolYear == current_year,
                    ClassSchedule.semester == current_semester,
                    ClassSchedule.classDays.contains(day),
                )
                .group_by(
                    ClassSchedule.className,
                    ClassSchedule.startTime,
                    ClassSchedule.endTime,
                )
            )

            for classSection in db_class_sections_day:
                if classSection.startTime < no_earlier_than_time:
                    if classSection.startTime < earliest_class_time:
                        earliest_class_time = classSection.startTime
                        schedule_warning = f"Review master schedule for possible error: a class section (not shown below) starts at {earliest_class_time.strftime('%-I:%M %p')}"

            teacher_has_early_classes = db_class_sections_day.filter(
                ClassSchedule.startTime < normal_start_of_day,
                ClassSchedule.startTime >= no_earlier_than_time,
            ).first()
            if teacher_has_early_classes:
                show_early_times = True
            db_class_sections[day] = db_class_sections_day
        db_class_sections_teacher[teacher] = db_class_sections
        db_class_sections_teacher[teacher]["show_early_times"] = show_early_times
        db_class_sections_teacher[teacher]["schedule_warning"] = schedule_warning

    hours = [
        ("8:00", time(8, 0), time(8, 30)),
        ("8:30", time(8, 30), time(9, 0)),
        ("9:00", time(9, 0), time(9, 30)),
        ("9:30", time(9, 30), time(10, 0)),
        ("10:00", time(10, 0), time(10, 30)),
        ("10:30", time(10, 30), time(11, 0)),
        ("11:00", time(11, 0), time(11, 30)),
        ("11:30", time(11, 30), time(12, 0)),
        ("12:00", time(12, 0), time(12, 30)),
        ("12:30", time(12, 30), time(13, 0)),
        ("1:00", time(13, 0), time(13, 30)),
        ("1:30", time(13, 30), time(14, 0)),
        ("2:00", time(14, 0), time(14, 30)),
        ("2:30", time(14, 30), time(15, 0)),
        ("3:00", time(15, 0), time(15, 30)),
        ("3:30", time(15, 30), time(16, 0)),
        ("4:00", time(16, 0), time(16, 30)),
    ]
    return render_template(
        "weekly-class-schedules.html",
        title="Weekly Class Schedules",
        teachers=teachers,
        db_class_sections=db_class_sections_teacher,
        year=current_year,
        semester=current_semester,
        days=days,
        hours=hours,
    )

