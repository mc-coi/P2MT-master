from flask_login import current_user
import re
from operator import itemgetter
from P2MT_App import db
from P2MT_App.scheduleAdmin.ScheduleAdmin import addClassSchedule
from P2MT_App.models import SchoolCalendar, ClassSchedule, Student
from P2MT_App.main.utilityfunctions import printLogEntry, createListOfDates
from P2MT_App.main.referenceData import getStudentGoogleCalendar
from P2MT_App.scheduleAdmin.ScheduleAdmin import (
    addClassAttendanceLog,
    getDuplicateSchedule,
)
from P2MT_App.googleAPI.googleCalendar import addCalendarEvent, deleteCalendarEvent


def addLearningLabTimeAndDays(
    learningLabCommonFields, classDays, startTime, endTime,
):

    schoolYear = learningLabCommonFields[0]
    semester = learningLabCommonFields[1]
    chattStateANumber = learningLabCommonFields[2]
    campus = learningLabCommonFields[3]
    className = learningLabCommonFields[4]
    teacherLastName = learningLabCommonFields[5]
    staffID = current_user.id
    online = False
    indStudy = False
    comment = learningLabCommonFields[9]
    interventionLog_id = learningLabCommonFields[11]
    learningLab = learningLabCommonFields[12]
    startDate = learningLabCommonFields[13]
    endDate = learningLabCommonFields[14]

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
        return duplicateSchedule

    classDaysList = classDays
    classDays = ""
    for classDay in classDaysList:
        classDays = classDays + classDay

    # Add learning lab to student schedule in Google Calendar
    eventName = className + " Learning Lab"
    location = "STEM School (" + teacherLastName + ")"
    recurrence = "weekly_recurrence_placeholder"
    googleCalendarID = getStudentGoogleCalendar(chattStateANumber)
    googleCalendarEventID = addCalendarEvent(
        googleCalendarID,
        eventName,
        location,
        classDays,
        startDate,
        endDate,
        startTime,
        endTime,
        recurrence,
    )

    classSchedule = addClassSchedule(
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
    return classSchedule


def propagateLearningLab(classSchedule_id, startDate, endDate, schoolYear, semester):
    printLogEntry("propagateClassSchedule() function called")
    # Create lists of days to use for propagating class schedule
    schoolCalendar = db.session.query(SchoolCalendar)
    phaseIIDays = schoolCalendar.filter(SchoolCalendar.phaseIISchoolDay)
    dateRange = phaseIIDays.filter(
        SchoolCalendar.classDate >= startDate, SchoolCalendar.classDate <= endDate
    )
    list_of_mondays = createListOfDates(
        dateRange.filter(SchoolCalendar.day == "M").all()
    )
    # print(list_of_mondays)
    list_of_tuesdays = createListOfDates(
        dateRange.filter(SchoolCalendar.day == "T").all()
    )
    # print(list_of_tuesdays)
    list_of_wednesdays = createListOfDates(
        dateRange.filter(SchoolCalendar.day == "W").all()
    )
    list_of_thursdays = createListOfDates(
        dateRange.filter(SchoolCalendar.day == "R").all()
    )
    list_of_fridays = createListOfDates(
        dateRange.filter(SchoolCalendar.day == "F").all()
    )
    # Extract details from class schedule
    learningLabClassSchedule = ClassSchedule.query.get(classSchedule_id)
    print("Propagating learningLabClassSchedule:", learningLabClassSchedule)
    classSchedule_id = learningLabClassSchedule.id
    online = learningLabClassSchedule.online
    indStudy = learningLabClassSchedule.indStudy
    classDays = learningLabClassSchedule.classDays
    meetsOnMonday = re.search("[M]", classDays)
    meetsOnTuesday = re.search("[T]", classDays)
    meetsOnWednesday = re.search("[W]", classDays)
    meetsOnThursday = re.search("[R]", classDays)
    meetsOnFriday = re.search("[F]", classDays)
    if meetsOnMonday and not online and not indStudy:
        # print("Monday:", classSchedule_id, classDays)
        addClassAttendanceLog(classSchedule_id, list_of_mondays)
    if meetsOnTuesday and not online and not indStudy:
        # print("Tuesday:", classSchedule_id, classDays)
        addClassAttendanceLog(classSchedule_id, list_of_tuesdays)
    if meetsOnWednesday and not online and not indStudy:
        # print("Wednesday:", classSchedule_id, classDays)
        addClassAttendanceLog(classSchedule_id, list_of_wednesdays)
    if meetsOnThursday and not online and not indStudy:
        # print("Thursday:", classSchedule_id, classDays)
        addClassAttendanceLog(classSchedule_id, list_of_thursdays)
    if meetsOnFriday and not online and not indStudy:
        # print("Friday:", classSchedule_id, classDays)
        addClassAttendanceLog(classSchedule_id, list_of_fridays)
    return


def updatelearningLabList(learningLabList, classDays, startTime, endTime):
    # Create a dictionary for each learning lab day/time and append to a list
    # For use in sending learning lab emails
    for day in classDays:
        # Note: dayNumber is used to sort learning lab days in order of weekday
        if day == "M":
            dayNumber = 1
            dayName = "Mondays"
        elif day == "T":
            dayNumber = 2
            dayName = "Tuesdays"
        elif day == "W":
            dayNumber = 3
            dayName = "Wednesdays"
        elif day == "R":
            dayNumber = 4
            dayName = "Thursdays"
        elif day == "F":
            dayNumber = 5
            dayName = "Fridays"
        learningLabListItem = {
            "dayNumber": dayNumber,
            "learningLabDay": dayName,
            "startTime": startTime,
            "endTime": endTime,
        }
        learningLabList.append(learningLabListItem)
    # Use nifty itemgetter function (from operator import itemgetter) to sort learning labs by day and time
    learningLabListSorted = sorted(
        learningLabList, key=itemgetter("dayNumber", "startTime")
    )
    return learningLabListSorted


def deleteLearningLabFromGoogleCalendar(interventionLog_id):
    learningLabClassSchedule = (
        db.session.query(ClassSchedule)
        .filter(ClassSchedule.interventionLog_id == interventionLog_id)
        .all()
    )
    for learningLab in learningLabClassSchedule:
        googleCalendarID = getStudentGoogleCalendar(learningLab.chattStateANumber)
        googleCalendarEventID = learningLab.googleCalendarEventID
        deleteCalendarEvent(googleCalendarID, googleCalendarEventID)
        learningLab.googleCalendarEventID = ""
    return
