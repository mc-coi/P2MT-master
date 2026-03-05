from flask import render_template, redirect, url_for, flash, Blueprint, request
from flask_login import login_required, current_user
from datetime import date, datetime
from P2MT_App import db
from P2MT_App.models import InterventionLog, ClassSchedule, Student
from P2MT_App.main.utilityfunctions import printLogEntry
from P2MT_App.interventionInfo.interventionInfo import downloadInterventionLog
from P2MT_App.main.referenceData import (
    getTeachers,
    getClassNames,
    getSchoolYear,
    getSemester,
    getStudents,
    getCampusChoices,
    getYearOfGraduation,
    getClassDayChoices,
    getCurrentSchoolYear,
    getCurrentSemester,
    getInterventionId,
    getStartTimeChoices,
    getEndTimeChoices,
    get_start_of_current_school_year,
    get_end_of_current_school_year,
)
from P2MT_App.scheduleAdmin.forms import addSingleClassSchedule
from P2MT_App.learningLab.forms import addLearningLabToSchedule
from P2MT_App.scheduleAdmin.routes import addClassSchedule
from P2MT_App.learningLab.learningLab import (
    addLearningLabTimeAndDays,
    propagateLearningLab,
    updatelearningLabList,
)
from P2MT_App.interventionInfo.interventionInfo import (
    add_InterventionLog,
    sendInterventionEmail,
)


learningLab_bp = Blueprint("learningLab_bp", __name__)


@learningLab_bp.route("/learninglab", methods=["GET", "POST"])
@login_required
def displayLearningLab():
    printLogEntry("Running displayLearningLab()")
    # Learning lab uses the same form as adding a single class schedule
    # This form includes several fields which can be pre-set rather
    # than including the fields on the form
    # Pre-setting the fields will avoid form validation errors later
    addLearningLabDetails = addLearningLabToSchedule()
    # Pre-set campus equal to STEM School
    addLearningLabDetails.campus.choices = getCampusChoices()
    addLearningLabDetails.campus.data = "STEM School"
    # Pre-set school year to current school year
    addLearningLabDetails.schoolYear.choices = getSchoolYear()
    addLearningLabDetails.schoolYear.data = getCurrentSchoolYear()
    # Pre-set semester to current semester
    addLearningLabDetails.semester.choices = getSemester()
    addLearningLabDetails.semester.data = getCurrentSemester()
    addLearningLabDetails.teacherName.choices = getTeachers(use_staff_list=True)
    addLearningLabDetails.studentName.choices = getStudents()
    addLearningLabDetails.className.choices = getClassNames(campus="All")
    addLearningLabDetails.classDays.choices = getClassDayChoices()
    addLearningLabDetails.classDays2.choices = getClassDayChoices()
    addLearningLabDetails.classDays3.choices = getClassDayChoices()
    addLearningLabDetails.classDays4.choices = getClassDayChoices()
    addLearningLabDetails.classDays5.choices = getClassDayChoices()
    addLearningLabDetails.submitAddSingleClassSchedule.label.text = (
        "Submit New Learning Lab"
    )
    print(request.form)
    # Handle form submission for adding new learning lab
    if "submitAddSingleClassSchedule" in request.form:
        if addLearningLabDetails.validate_on_submit():
            printLogEntry("Add Learning Lab submitted")

            schoolYear = addLearningLabDetails.schoolYear.data
            semester = addLearningLabDetails.semester.data
            chattStateANumber = addLearningLabDetails.studentName.data
            teacherLastName = addLearningLabDetails.teacherName.data
            className = addLearningLabDetails.className.data
            startDate = addLearningLabDetails.startDate.data
            endDate = addLearningLabDetails.endDate.data
            online = addLearningLabDetails.online.data
            indStudy = addLearningLabDetails.indStudy.data
            comment = addLearningLabDetails.comment.data
            googleCalendarEventID = addLearningLabDetails.googleCalendarEventID.data
            campus = "STEM School"
            staffID = current_user.id
            learningLab = True

            print(
                schoolYear,
                semester,
                chattStateANumber,
                teacherLastName,
                className,
                online,
                indStudy,
                comment,
                googleCalendarEventID,
                learningLab,
            )

            printLogEntry("Adding intervention")
            interventionType = 2
            interventionLevel = 1
            interventionLog = add_InterventionLog(
                chattStateANumber,
                interventionType,
                interventionLevel,
                startDate,
                endDate,
                comment,
                parentNotification=datetime.utcnow(),
            )
            db.session.commit()
            print("new intervention log ID:", interventionLog.id)
            # Store all of the common fields in a single variable for later use
            learningLabCommonFields = [
                schoolYear,
                semester,
                chattStateANumber,
                campus,
                className,
                teacherLastName,
                staffID,
                online,
                indStudy,
                comment,
                googleCalendarEventID,
                interventionLog.id,
                learningLab,
                startDate,
                endDate,
            ]
            # Initialize a list to store details of learning labs for email notifications
            learningLabList = []
            # Process each of the five possible entries of learning lab days/time
            if addLearningLabDetails.addTimeAndDays.data:
                print("Adding learning lab time 1")
                # Format time values from string objects to time objects
                startTime = datetime.strptime(
                    addLearningLabDetails.startTime.data, "%H:%M"
                ).time()
                endTime = datetime.strptime(
                    addLearningLabDetails.endTime.data, "%H:%M"
                ).time()
                learningLabClassSchedule = addLearningLabTimeAndDays(
                    learningLabCommonFields,
                    addLearningLabDetails.classDays.data,
                    startTime,
                    endTime,
                )
                propagateLearningLab(
                    learningLabClassSchedule.id,
                    startDate,
                    endDate,
                    schoolYear,
                    semester,
                )
                learningLabList = updatelearningLabList(
                    learningLabList,
                    addLearningLabDetails.classDays.data,
                    startTime,
                    endTime,
                )
            if addLearningLabDetails.addTimeAndDays2.data:
                print("Adding learning lab time 2")
                # Format time values from string objects to time objects
                startTime2 = datetime.strptime(
                    addLearningLabDetails.startTime2.data, "%H:%M"
                ).time()
                endTime2 = datetime.strptime(
                    addLearningLabDetails.endTime2.data, "%H:%M"
                ).time()

                learningLabClassSchedule = addLearningLabTimeAndDays(
                    learningLabCommonFields,
                    addLearningLabDetails.classDays2.data,
                    startTime2,
                    endTime2,
                )
                propagateLearningLab(
                    learningLabClassSchedule.id,
                    startDate,
                    endDate,
                    schoolYear,
                    semester,
                )
                learningLabList = updatelearningLabList(
                    learningLabList,
                    addLearningLabDetails.classDays2.data,
                    startTime2,
                    endTime2,
                )
            if addLearningLabDetails.addTimeAndDays3.data:
                print("Adding learning lab time 3")
                # Format time values from string objects to time objects
                startTime3 = datetime.strptime(
                    addLearningLabDetails.startTime3.data, "%H:%M"
                ).time()
                endTime3 = datetime.strptime(
                    addLearningLabDetails.endTime3.data, "%H:%M"
                ).time()
                learningLabClassSchedule = addLearningLabTimeAndDays(
                    learningLabCommonFields,
                    addLearningLabDetails.classDays3.data,
                    startTime3,
                    endTime3,
                )
                propagateLearningLab(
                    learningLabClassSchedule.id,
                    startDate,
                    endDate,
                    schoolYear,
                    semester,
                )
                learningLabList = updatelearningLabList(
                    learningLabList,
                    addLearningLabDetails.classDays3.data,
                    startTime3,
                    endTime3,
                )
            if addLearningLabDetails.addTimeAndDays4.data:
                print("Adding learning lab time 4")
                # Format time values from string objects to time objects
                startTime4 = datetime.strptime(
                    addLearningLabDetails.startTime4.data, "%H:%M"
                ).time()
                endTime4 = datetime.strptime(
                    addLearningLabDetails.endTime4.data, "%H:%M"
                ).time()
                learningLabClassSchedule = addLearningLabTimeAndDays(
                    learningLabCommonFields,
                    addLearningLabDetails.classDays4.data,
                    startTime4,
                    endTime4,
                )
                propagateLearningLab(
                    learningLabClassSchedule.id,
                    startDate,
                    endDate,
                    schoolYear,
                    semester,
                )
                learningLabList = updatelearningLabList(
                    learningLabList,
                    addLearningLabDetails.classDays4.data,
                    startTime4,
                    endTime4,
                )
            if addLearningLabDetails.addTimeAndDays5.data:
                print("Adding learning lab time 5")
                # Format time values from string objects to time objects
                startTime5 = datetime.strptime(
                    addLearningLabDetails.startTime5.data, "%H:%M"
                ).time()
                endTime5 = datetime.strptime(
                    addLearningLabDetails.endTime5.data, "%H:%M"
                ).time()
                learningLabClassSchedule = addLearningLabTimeAndDays(
                    learningLabCommonFields,
                    addLearningLabDetails.classDays5.data,
                    startTime5,
                    endTime5,
                )
                propagateLearningLab(
                    learningLabClassSchedule.id,
                    startDate,
                    endDate,
                    schoolYear,
                    semester,
                )
                learningLabList = updatelearningLabList(
                    learningLabList,
                    addLearningLabDetails.classDays5.data,
                    startTime5,
                    endTime5,
                )
            print("learningLabList =", learningLabList)
            # Define learning lab parameters for intervention email
            intervention_id = getInterventionId("Academic Behavior")
            interventionLevel = 1
            templateParams = {
                "learningLabList": learningLabList,
                "className": className,
                "teacherLastName": teacherLastName,
            }
            sendInterventionEmail(
                chattStateANumber,
                intervention_id,
                interventionLevel,
                startDate,
                endDate,
                comment,
                templateParams=templateParams,
            )
            return redirect(url_for("learningLab_bp.displayLearningLab"))
    print("addLearningLabDetails.errors: ", addLearningLabDetails.errors)

    # Get list of learning labs to display on learning lab manager
    start_of_current_school_year = get_start_of_current_school_year()
    end_of_current_school_year = get_end_of_current_school_year()
    LearningLabSchedules = (
        db.session.query(ClassSchedule)
        .join(InterventionLog)
        .join(Student)
        .filter(
            ClassSchedule.learningLab == True,
            InterventionLog.endDate >= start_of_current_school_year,
            InterventionLog.endDate <= end_of_current_school_year,
        )
        .order_by(InterventionLog.endDate.desc(), Student.lastName.asc())
    ).all()

    return render_template(
        "learninglabmanager.html",
        title="Learning Lab",
        addSingleClassSchedule=addLearningLabDetails,
        ClassSchedules=LearningLabSchedules,
    )
