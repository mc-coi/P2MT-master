from re import T
from P2MT_App.models import (
    InterventionType,
    FacultyAndStaff,
    ClassSchedule,
    Student,
    SchoolCalendar,
    p2mtTemplates,
    Parents,
    adminSettings,
    apiKeys,
    PblEvents,
    Pbls,
)
from P2MT_App import db
from sqlalchemy import distinct, or_, and_
from datetime import date, timedelta
from P2MT_App.main.utilityfunctions import printLogEntry, createListOfDates


def getInterventionTypes():
    interventionValueLabelTupleList = db.session.query(
        InterventionType.id, InterventionType.interventionType
    ).all()
    # Update intervention types to include blank choice as default
    interventionChoices = list(interventionValueLabelTupleList)
    interventionChoices.insert(0, (0, ""))
    return tuple(interventionChoices)


def getInterventionType(intervention_id):
    interventionType = (
        db.session.query(InterventionType.interventionType)
        .filter(InterventionType.id == intervention_id)
        .first()
    )
    return interventionType[0]


def getInterventionId(interventionType):
    interventionId = (
        db.session.query(InterventionType.id)
        .filter(InterventionType.interventionType == interventionType)
        .first()
    )
    return interventionId[0]


def getStaffFromFacultyAndStaff():
    # Get list of staff to display as dropdown choices but exclude system account
    teacherTupleList = (
        db.session.query(
            FacultyAndStaff.id, FacultyAndStaff.firstName, FacultyAndStaff.lastName
        )
        .filter(FacultyAndStaff.lastName != "System")
        .distinct()
        .order_by(FacultyAndStaff.lastName)
        .all()
    )
    teacherValueLabelTupleList = [
        (item[0], item[1] + " " + item[2]) for item in teacherTupleList
    ]
    return teacherValueLabelTupleList


def getSystemAccountEmail():
    systemAccountEmail = (
        db.session.query(FacultyAndStaff.email)
        .filter(FacultyAndStaff.lastName == "System")
        .first()
    )
    return systemAccountEmail[0]


def setEmailModeStatus(emailModeStatus):
    # Set email mode statue to enableLiveEmail=True or enableLiveEmail=False
    newAdminSettings = adminSettings(enableLiveEmail=emailModeStatus)
    db.session.add(newAdminSettings)
    return


def getEmailModeStatus():
    emailModeStatus = (
        db.session.query(adminSettings.enableLiveEmail)
        .order_by(adminSettings.id.desc())
        .first()
    )
    return emailModeStatus[0]


def getTeachers(campus="STEM School", use_staff_list=False):
    """Returns list of tuples of teacher last names.  By default, the teacher names are for teachers of STEM School classes.  
    
    Use the optional "use_staff_list" parameter as follows:

    use_staff_list=True returns a list of all persons in the P2MT Staff Member list and ignores the optional 'campus' parameter.

    Use the optional "campus" parameter as follows:

    campus="STEM School" returns a lits of teachers for STEM School classes.

    campus="Chattanooga State" returns a list of teachers for Chattanooga State classes.

    campus="All" returns a list of teachers for all classes regardless of campus.
    """
    if use_staff_list:
        teacherValueLabelTupleList = (
            db.session.query(FacultyAndStaff.lastName, FacultyAndStaff.lastName)
            .filter(FacultyAndStaff.lastName != "System")
            .distinct()
            .order_by(FacultyAndStaff.lastName)
        )
    else:
        teacherValueLabelTupleList = (
            db.session.query(
                ClassSchedule.teacherLastName, ClassSchedule.teacherLastName
            )
            .filter(
                or_(
                    and_(
                        ClassSchedule.schoolYear == getSchoolYearForFallSemester(),
                        ClassSchedule.semester == "Fall",
                    ),
                    and_(
                        ClassSchedule.schoolYear == getSchoolYearForSpringSemester(),
                        ClassSchedule.semester == "Spring",
                    ),
                )
            )
            .distinct()
            .order_by(ClassSchedule.teacherLastName)
        )
        if campus == "STEM School" or campus == "Chattanooga State":
            teacherValueLabelTupleList = teacherValueLabelTupleList.filter(
                ClassSchedule.campus == campus
            )
        elif campus == "All":
            pass

    # insert a blank option into the list as the default choice
    # Note: need to convert the tuple to a list and then back to a tuple
    teacherList = list(teacherValueLabelTupleList)
    teacherList.insert(0, ("", ""))
    teacherValueLabelTupleList = tuple(teacherList)
    return teacherValueLabelTupleList


def getClassNames(campus="STEM School"):
    """Returns list of class names.  By default, the class names are for STEM School classes.  
    
    Use the optional "campus" parameter as follows:

    campus="STEM School" returns a list of STEM School classes.

    campus="Chattanooga State" returns a list of Chattanooga State classes.

    campus="All" returns a list of all classes regardless of campus.
    """
    classNameValueLabelTupleList = (
        db.session.query(ClassSchedule.className, ClassSchedule.className)
        .distinct()
        .order_by(ClassSchedule.className)
    )
    if campus == "STEM School" or campus == "Chattanooga State":
        classNameValueLabelTupleList = classNameValueLabelTupleList.filter(
            ClassSchedule.campus == campus
        )
    elif campus == "All":
        pass

    # classNameValueLabelTupleList = 'classes'
    # insert a blank option into the list as the default choice
    # Note: need to convert the tuple to a list and then back to a tuple
    classList = list(classNameValueLabelTupleList)
    classList.insert(0, ("", ""))
    classNameValueLabelTupleList = tuple(classList)
    return classNameValueLabelTupleList


def getStemAndChattStateClassNames():
    classNameValueLabelTupleList = (
        db.session.query(ClassSchedule.className, ClassSchedule.className)
        .distinct()
        .order_by(ClassSchedule.className)
        .all()
    )
    # insert a blank option into the list as the default choice
    # Note: need to convert the tuple to a list and then back to a tuple
    classList = list(classNameValueLabelTupleList)
    classList.insert(0, ("", ""))
    classNameValueLabelTupleList = tuple(classList)
    return classNameValueLabelTupleList


def getCampusChoices():
    campusValueLabelTupleList = (
        db.session.query(ClassSchedule.campus, ClassSchedule.campus)
        .distinct()
        .order_by(ClassSchedule.campus.desc())
        .all()
    )
    return campusValueLabelTupleList


def isValidChattStateANumber(chattStateANumber):
    """Validate that the Chatt State A Number is valid. """
    student = Student.query.filter(
        Student.chattStateANumber == chattStateANumber
    ).first()
    if student:
        return True
    else:
        return False


def getStudentName(chattStateANumber):
    studentTupleList = (
        db.session.query(Student.firstName, Student.lastName)
        .filter(Student.chattStateANumber == chattStateANumber)
        .first()
    )
    studentName = studentTupleList[0] + " " + studentTupleList[1]
    return studentName


def getStudentFirstNameAndLastName(chattStateANumber):
    studentTupleList = (
        db.session.query(Student.firstName, Student.lastName)
        .filter(Student.chattStateANumber == chattStateANumber)
        .first()
    )
    studentFirstName = studentTupleList[0]
    studentLastName = studentTupleList[1]
    return studentFirstName, studentLastName


def getStudents(exclude_graduates=True):
    base_query = (
        db.session.query(Student.chattStateANumber, Student.firstName, Student.lastName)
        .distinct()
        .order_by(Student.lastName)
    )
    if exclude_graduates:
        senior_year_of_graduation = getClassYearOfGraduation("Seniors")
        studentTupleList = base_query.filter(
            Student.yearOfGraduation >= senior_year_of_graduation
        ).all()
    else:
        studentTupleList = base_query.all()
    studentTupleList.insert(0, ("", "", ""))
    studentValueLabelTupleList = [
        (item[0], item[1] + " " + item[2]) for item in studentTupleList
    ]
    print(len(studentValueLabelTupleList))
    return studentValueLabelTupleList


def getStudentsById(exclude_graduates=True):
    base_query = (
        db.session.query(Student.id, Student.firstName, Student.lastName)
        .distinct()
        .order_by(Student.lastName)
    )
    if exclude_graduates:
        senior_year_of_graduation = getClassYearOfGraduation("Seniors")
        studentTupleList = base_query.filter(
            Student.yearOfGraduation >= senior_year_of_graduation
        ).all()
    else:
        studentTupleList = base_query.all()
    studentTupleList.insert(0, ("", "", ""))
    studentValueLabelTupleList = [
        (item[0], item[1] + " " + item[2]) for item in studentTupleList
    ]
    return studentValueLabelTupleList


def getStudentEmail(chattStateANumber):
    studentEmail = (
        db.session.query(Student.email)
        .filter(Student.chattStateANumber == chattStateANumber)
        .first()
    )
    return studentEmail[0]


def getStudentGoogleCalendar(chattStateANumber):
    studentGoogleCalendar = (
        db.session.query(Student.googleCalendarId)
        .filter(Student.chattStateANumber == chattStateANumber)
        .first()
    )
    return studentGoogleCalendar[0]


def getStudentScheduleLink(chattStateANumber):
    studentGoogleCalendar = getStudentGoogleCalendar(chattStateANumber)
    studentScheduleLink = (
        "https://calendar.google.com/calendar/embed?src=" + studentGoogleCalendar
    )
    return studentScheduleLink


def getParentEmails(chattStateANumber):
    parentEmails = (
        db.session.query(
            Parents.motherEmail, Parents.fatherEmail, Parents.guardianEmail
        )
        .filter(Parents.chattStateANumber == chattStateANumber)
        .first()
    )
    parentEmailList = []
    if parentEmails:
        for email in parentEmails:
            if len(email) == 0 or email == None:
                continue
            parentEmailList.append(email)
    return parentEmailList


def getSchoolYear():
    schoolYearValueLabelTupleList = (
        db.session.query(ClassSchedule.schoolYear, ClassSchedule.schoolYear)
        .distinct()
        .order_by(ClassSchedule.schoolYear.desc())
        .all()
    )
    return schoolYearValueLabelTupleList


def getYearOfGraduation():
    yearOfGraduationValueLabelTupleList = (
        db.session.query(Student.yearOfGraduation, Student.yearOfGraduation)
        .distinct()
        .order_by(Student.yearOfGraduation.desc())
        .all()
    )
    return yearOfGraduationValueLabelTupleList


def getSemester():
    semesterValueLabelTupleList = (
        db.session.query(ClassSchedule.semester, ClassSchedule.semester)
        .distinct()
        .order_by(ClassSchedule.semester.desc())
        .all()
    )
    return semesterValueLabelTupleList


def getSchoolYearChoices():
    schoolYearChoices = [
        (2020, 2020),
        (2021, 2021),
        (2022, 2022),
        (2023, 2023),
        (2024, 2024),
        (2025, 2025),
        (2026, 2026),
        (2027, 2027),
        (2028, 2028),
        (2029, 2029),
        (2030, 2030),
        (2031, 2031),
        (2032, 2032),
        (2033, 2033),
        (2034, 2034),
        (2035, 2035),
    ]
    return schoolYearChoices


def getAcademicYearChoices():
    academicYearChoices = [
        ("2020-2021", "2020-2021"),
        ("2021-2022", "2021-2022"),
        ("2022-2023", "2022-2023"),
        ("2023-2024", "2023-2024"),
        ("2024-2025", "2024-2025"),
        ("2025-2026", "2025-2026"),
        ("2026-2027", "2026-2027"),
        ("2027-2028", "2027-2028"),
        ("2028-2029", "2028-2029"),
        ("2029-2030", "2029-2030"),
        ("2030-2031", "2030-2031"),
        ("2031-2032", "2031-2032"),
        ("2032-2033", "2032-2033"),
        ("2033-2034", "2033-2034"),
        ("2034-2035", "2034-2035"),
    ]
    return academicYearChoices


def getSemesterChoices():
    semesterChoices = [
        ("Fall", "Fall"),
        ("Spring", "Spring"),
    ]
    return semesterChoices


def getQuarterChoices():
    quarterChoices = [
        (1, "1st Quarter"),
        (2, "2nd Quarter"),
        (3, "3rd Quarter"),
        (4, "4th Quarter"),
    ]
    return quarterChoices


def getQuarterOrdinal(quarter):
    if quarter == 1:
        quarterOrdinal = "1st"
    elif quarter == 2:
        quarterOrdinal = "2nd"
    elif quarter == 3:
        quarterOrdinal = "3rd"
    elif quarter == 4:
        quarterOrdinal = "4th"
    else:
        quarterOrdinal = "0th"
    return quarterOrdinal


def getSchoolYearAndSemester(academicYear, quarter):
    years = academicYear.split("-")
    if quarter == 1:
        schoolYear = years[0]
        semester = "Fall"
    elif quarter == 2:
        schoolYear = years[0]
        semester = "Fall"
    elif quarter == 3:
        schoolYear = years[1]
        semester = "Spring"
    elif quarter == 4:
        schoolYear = years[1]
        semester = "Spring"
    else:
        schoolYear = years[0]
        semester = "Fall"
    # print(academicYear, quarter, schoolYear, semester)
    return schoolYear, semester


def getPblOptionsTuple(academicYear, quarter):
    pblOptionsTuple = (
        db.session.query(Pbls.id, Pbls.pblName)
        .filter(Pbls.academicYear == academicYear, Pbls.quarter == quarter)
        .order_by(Pbls.pblName,)
        .distinct()
    )
    # pblOptions = [item[0] for item in pblOptions]
    # print(pblOptions)
    return pblOptionsTuple


def getPblOptions(quarter):
    pblOptions = (
        db.session.query(Pbls.pblName)
        # .filter(Pbls.quarter == quarter)
        .order_by(Pbls.pblName,).distinct()
    )
    pblOptions = [item[0] for item in pblOptions]
    # print(pblOptions)
    return pblOptions


def getPblEventCategoryChoices():
    pblEventCategoryChoices = [
        ("Kickoff", "Kickoff"),
        ("Final", "Final"),
        ("Design Review", "Design Review"),
        ("Sponsor Meeting", "Sponsor Meeting"),
    ]
    return pblEventCategoryChoices


def getPblEmailRecipientChoices(academicYear, quarter, className):
    pblEmailRecipientChoices = (
        db.session.query(Pbls.id, Pbls.pblName)
        .filter(
            Pbls.className == className,
            Pbls.academicYear == academicYear,
            Pbls.quarter == quarter,
        )
        .order_by(Pbls.pblName,)
        .distinct()
    )
    pblEmailRecipientChoices = list(pblEmailRecipientChoices)
    pblEmailRecipientChoices.insert(0, ("-5", "Students Without a Team"))
    pblEmailRecipientChoices.insert(0, ("-4", "Students With a Team"))
    pblEmailRecipientChoices.insert(0, ("-3", "Students Without a PBL"))
    pblEmailRecipientChoices.insert(0, ("-2", "Students With a PBL"))
    pblEmailRecipientChoices.insert(0, ("-1", "All Students"))
    pblEmailRecipientChoices.insert(0, ("-6", "Selected Students"))
    pblEmailRecipientChoices.insert(0, ("0", "Select Students..."))
    return tuple(pblEmailRecipientChoices)


def getPblEmailTemplates():
    pblEmailTemplatesTupleList = (
        db.session.query(p2mtTemplates.id, p2mtTemplates.templateTitle)
        .filter(p2mtTemplates.templateTitle.like("%PBL%"))
        .order_by(p2mtTemplates.templateTitle,)
        .all()
    )
    pblEmailTemplatesTupleList.insert(
        0, ("-2", "Add Final Presentation Note to Attendance Logs")
    )
    pblEmailTemplatesTupleList.insert(0, ("-1", "Add Kickoff Note to Attendance Logs"))
    pblEmailTemplatesTupleList.insert(0, ("0", "Select Action..."))
    return pblEmailTemplatesTupleList


def getClassDayChoices():
    classDayChoices = [
        ("M", "M"),
        ("T", "T"),
        ("W", "W"),
        ("R", "R"),
        ("F", "F"),
    ]
    return classDayChoices


def getStartTimeChoices():
    startTimeChoices = [
        ("09:30", "9:30"),
        ("10:00", "10:00"),
        ("10:30", "10:30"),
        ("11:00", "11:00"),
        ("11:30", "11:30"),
        ("12:00", "12:00"),
        ("12:30", "12:30"),
        ("13:00", "1:00"),
        ("13:30", "1:30"),
        ("14:00", "2:00"),
        ("14:30", "2:30"),
        ("15:00", "3:00"),
        ("15:30", "3:30"),
        ("16:00", "4:00"),
    ]
    return startTimeChoices


def getEndTimeChoices():
    endTimeChoices = [
        ("10:00", "10:00"),
        ("10:30", "10:30"),
        ("11:00", "11:00"),
        ("11:30", "11:30"),
        ("12:00", "12:00"),
        ("12:30", "12:30"),
        ("13:00", "1:00"),
        ("13:30", "1:30"),
        ("14:00", "2:00"),
        ("14:30", "2:30"),
        ("15:00", "3:00"),
        ("15:30", "3:30"),
        ("16:00", "4:00"),
        ("16:30", "4:30"),
    ]
    return endTimeChoices


def getHouseNames():
    houseValueLableTupleList = [
        ("", ""),
        ("TBD", "TBD"),
        ("Staupers", "Staupers"),
        ("Tesla", "Tesla"),
        ("Einstein", "Einstein"),
        ("Mirzakhani", "Mirzakhani"),
    ]
    return houseValueLableTupleList


def getGradeLevels():
    gradeLevelTupleList = [
        ("", ""),
        ("9", "9"),
        ("10", "10"),
        ("11", "11"),
        ("12", "12"),
    ]
    return gradeLevelTupleList


def getCurrentSchoolYear():
    # printLogEntry("getCurrentSchoolYear() function called")
    schoolYear = date.today().year
    # print("Current schoolYear =", schoolYear)
    return schoolYear


def getSchoolYearForFallSemester():
    currentSemester = getCurrentSemester()
    todaysYear = date.today().year
    if currentSemester == "Fall":
        schoolYearForFallSemester = todaysYear
    elif currentSemester == "Spring":
        schoolYearForFallSemester = todaysYear - 1
    return schoolYearForFallSemester


def getSchoolYearForSpringSemester():
    currentSemester = getCurrentSemester()
    todaysYear = date.today().year
    if currentSemester == "Fall":
        schoolYearForSpringSemester = todaysYear + 1
    elif currentSemester == "Spring":
        schoolYearForSpringSemester = todaysYear
    return schoolYearForSpringSemester


def getSchoolYearForQuarter(quarter):
    if quarter == 1 or quarter == 2:
        schoolYearForQuarter = getSchoolYearForFallSemester()
    elif quarter == 3 or quarter == 4:
        schoolYearForQuarter = getSchoolYearForSpringSemester()
    return schoolYearForQuarter


def get_start_of_current_school_year():
    """Reture the first day of August for the current school year."""
    start_of_current_school_year = date(getSchoolYearForFallSemester(), 8, 1)
    return start_of_current_school_year


def get_end_of_current_school_year():
    """Reture the last day of May for the current school year."""
    end_of_current_school_year = date(getSchoolYearForSpringSemester(), 5, 31)
    return end_of_current_school_year


def getCurrentSemester():
    # printLogEntry("getCurrentSemester() function called")
    if date.today().month < 6:
        semester = "Spring"
    else:
        semester = "Fall"
    # print("Current month =", date.today().month, "and semester =", semester)
    return semester


def getCurrentQuarter():
    # printLogEntry("getCurrentQuarter() function called")
    # This function returns the current quarter based on nominal quarter start and end dates
    # It should only be used to approximate the actual quarter since the start of the 2nd
    # and 4th quarters are estimates
    today = date.today()
    if getCurrentSemester() == "Fall":
        addYearForFall = 1
    else:
        addYearForFall = 0
    q1StartDate = date(date.today().year, 6, 1)
    q2StartDate = date(date.today().year, 10, 15)
    q3StartDate = date(date.today().year + addYearForFall, 1, 1)
    q4StartDate = date(date.today().year + addYearForFall, 3, 15)

    if today > q1StartDate and today < q2StartDate:
        currentQuarter = 1
    elif today > q2StartDate and today < q3StartDate:
        currentQuarter = 2
    elif today > q3StartDate and today < q4StartDate:
        currentQuarter = 3
    elif today > q4StartDate and today < q1StartDate:
        currentQuarter = 4
    else:
        # In case of logic error, set the default value to 1st quarter
        print("Review getCurrentQuarter() for logic error for date = ", today)
        currentQuarter = 1
    # print("Current quarter =", currentQuarter)
    return currentQuarter


def getCurrentAcademicYear():
    # printLogEntry("getCurrentAcademicYear() function called")
    schoolYear = date.today().year
    if date.today().month < 6:
        academicYear = f"{schoolYear-1}-{schoolYear}"
    else:
        academicYear = f"{schoolYear}-{schoolYear+1}"
    # print("Current academicYear =", academicYear)
    return academicYear


def getClassYearOfGraduation(ClassGroup):
    # Get year of graduation for class group for current school year and semester
    schoolYear = getCurrentSchoolYear()
    currentSemester = getCurrentSemester()
    if currentSemester == "Fall":
        addYearForCurrentSemester = 1
    else:
        addYearForCurrentSemester = 0
    if ClassGroup == "Seniors":
        yearOfGraduation = schoolYear + 0 + addYearForCurrentSemester
    elif ClassGroup == "Juniors":
        yearOfGraduation = schoolYear + 1 + addYearForCurrentSemester
    elif ClassGroup == "Sophomores":
        yearOfGraduation = schoolYear + 2 + addYearForCurrentSemester
    elif ClassGroup == "Freshmen":
        yearOfGraduation = schoolYear + 3 + addYearForCurrentSemester
    return yearOfGraduation


def getNextTmiDay():
    today = date.today()
    nextTmiDay = (
        db.session.query(SchoolCalendar.classDate)
        .filter(SchoolCalendar.classDate >= today, SchoolCalendar.tmiDay == True)
        .first()
    )
    print("Next TMI Day =", nextTmiDay[0])
    return nextTmiDay[0]


def getListOfStart_End_Tmi_Days():
    # Create a list of dates comprised of startTmiPeriod, endTmiPeriod, and tmiDay:
    # [startTmiPeriod 1, endTmiPeriod 1, tmi Day 1]
    # [startTmiPeriod 2, endTmiPeriod 2, tmi Day 3]
    # [startTmiPeriod 2, endTmiPeriod 2, tmi Day 3]
    # etc...
    tmiDays = (
        db.session.query(SchoolCalendar.classDate)
        .filter(SchoolCalendar.tmiDay == True)
        .all()
    )
    startTmiPeriodDates = (
        db.session.query(SchoolCalendar.classDate)
        .filter(SchoolCalendar.startTmiPeriod == True)
        .all()
    )
    tmiDaysList = createListOfDates(tmiDays)
    startTmiPeriodDateList = createListOfDates(startTmiPeriodDates)
    endTmiPeriodDateList = []
    # endTmiPeriod is computed by finding the day before the next startTmiPeriod
    # Hence, loop through the startTmiPeriodList beginning with the second element
    for date in startTmiPeriodDateList[1:]:
        endTmiPeriodDate = date - timedelta(days=1)
        endTmiPeriodDateList.append(endTmiPeriodDate)
    ListOfStart_End_Tmi_Days = list(
        zip(startTmiPeriodDateList, endTmiPeriodDateList, tmiDaysList)
    )
    return ListOfStart_End_Tmi_Days


def getCurrent_Start_End_Tmi_Dates():
    ListOfStart_End_Tmi_Days = getListOfStart_End_Tmi_Days()
    nextTmiDay = getNextTmiDay()
    for startTmiPeriod, endTmiPeriod, TmiDay in ListOfStart_End_Tmi_Days:
        if nextTmiDay == TmiDay:
            print(
                "startTmiPeriod =",
                startTmiPeriod,
                "endTmiPeriod =",
                endTmiPeriod,
                "TmiDay =",
                TmiDay,
            )
            break
    return startTmiPeriod, endTmiPeriod, nextTmiDay


def findEarliestPhaseIIDayNoEarlierThan(testDate, dayOfWeek):
    earliestSchoolDayMatch = False
    while not earliestSchoolDayMatch:
        schoolCalendar = (
            db.session.query(SchoolCalendar)
            .filter(
                SchoolCalendar.classDate == testDate,
                SchoolCalendar.phaseIISchoolDay == True,
            )
            .first()
        )
        if schoolCalendar != None:
            if schoolCalendar.day == dayOfWeek:
                earliestDate = schoolCalendar.classDate
                earliestSchoolDayMatch = True
            else:
                testDate = testDate + timedelta(days=1)
        else:
            testDate = testDate + timedelta(days=1)
    return testDate


def getP2mtTemplatesToEdit():
    p2mtTemplatesValueLabelTupleList = (
        db.session.query(p2mtTemplates.id, p2mtTemplates.templateTitle)
        .outerjoin(InterventionType)
        .order_by(
            InterventionType.interventionType,
            p2mtTemplates.interventionLevel,
            p2mtTemplates.templateTitle,
        )
        .all()
    )
    p2mtTemplatesValueLabelTupleList.insert(0, ("", ""))
    return p2mtTemplatesValueLabelTupleList


def getApiKey():
    apikey_json = db.session.query(apiKeys.apiKey).order_by(apiKeys.id.desc()).first()
    return apikey_json[0]


def get_protected_schedules():
    """Return a list of proteceted schedules which cannot be deleted."""
    printLogEntry("Running get_protected_schedules()")

    current_school_year = getCurrentSchoolYear()
    current_semester = getCurrentSemester()
    current_quarter = getCurrentQuarter()

    start_year = 2020
    year_list = [year for year in range(start_year, current_school_year + 1, 1)]
    protected_schedule_list = []
    for year in year_list:
        if year != current_school_year or (
            year == current_school_year and current_quarter != 3
        ):
            protected_schedule_list.append(" ".join([str(year), "Spring"]))
        if year != current_school_year or (
            year == current_school_year and current_quarter == 2
        ):
            protected_schedule_list.append(" ".join([str(year), "Fall"]))
    print(locals())

    return protected_schedule_list


def get_protected_pbl_semesters():
    """Return a list of proteceted semesters for which cannot PBLs be deleted."""
    printLogEntry("Running get_protected_pbl_semesters()")

    current_school_year = getCurrentSchoolYear()
    current_semester = getCurrentSemester()
    current_quarter = getCurrentQuarter()

    start_year = 2020
    year_list = [year for year in range(start_year, current_school_year + 1, 1)]
    protected_pbl_semesters_list = []
    for year in year_list:
        if year == current_school_year - 1 and current_semester == "Spring":
            protected_pbl_semesters_list.append(" ".join([str(year), "Spring"]))
        elif year < current_school_year:
            protected_pbl_semesters_list.append(" ".join([str(year), "Spring"]))
            protected_pbl_semesters_list.append(" ".join([str(year), "Fall"]))
        elif year == current_school_year and current_semester == "Fall":
            protected_pbl_semesters_list.append(" ".join([str(year), "Spring"]))
    print(locals())

    return protected_pbl_semesters_list
