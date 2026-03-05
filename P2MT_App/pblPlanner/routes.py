from flask import render_template, redirect, url_for, flash, request, Blueprint
from flask_login import login_required
from P2MT_App import db
from P2MT_App.main.referenceData import (
    getSchoolYearChoices,
    getSemesterChoices,
    getQuarterChoices,
    getPblEventCategoryChoices,
    getPblOptions,
    getPblOptionsTuple,
    getAcademicYearChoices,
    getSchoolYearAndSemester,
    getCurrentAcademicYear,
    getClassYearOfGraduation,
    getCurrentQuarter,
    getPblEmailRecipientChoices,
    getPblEmailTemplates,
    getQuarterOrdinal,
    get_protected_pbl_semesters,
)
from P2MT_App.main.utilityfunctions import printFormErrors, printLogEntry
from P2MT_App.pblPlanner.forms import pblEventEditorForm, pblEditorForm
from P2MT_App.pblPlanner.pblPlanner import (
    downloadPblEvents,
    downloadPblTeamsAndEventDetails,
    downloadPblFieldTripInfo,
    downloadPblTeams,
)
from P2MT_App.pblPlanner.pblEmailer import sendPblEmails
from P2MT_App.pblPlanner.pblCalendar import (
    addPblEventToCalendar,
    deletePblEventFromCalendar,
)
from P2MT_App.pblPlanner.pblAttendanceLog import updatePblEventCommentOnAttendanceLogs
from datetime import date, time
from flask_login import current_user, login_required

# STEM III Drag and Drop
from P2MT_App.models import Student, PblEvents, PblTeams, Pbls, p2mtTemplates
import json
from datetime import datetime

pblPlanner_bp = Blueprint("pblPlanner_bp", __name__)


@pblPlanner_bp.route("/stemiiipblplanner", methods=["GET", "POST"])
@login_required
def displayStemIIIPblPlanner():
    printLogEntry("Running displayStemIIIPblPlanner()")

    academicYearChoices = getAcademicYearChoices()
    quarterOptions = getQuarterChoices()

    # if request.method == "GET" and request.args.get("selectedQuarter"):
    #     quarter = request.args.get("selectedQuarter")
    #     print("get selected quarter")
    #     print("selectedQuarter =", quarter)
    #     quarter = int(quarter)
    # elif request.method == "GET" and request.args.get("selectedAcademicYear"):
    #     print("get selected academic year")
    #     academicYear = request.args.get("selectedAcademicYear")
    #     print("selectedAcademicYear =", academicYear)
    if request.method == "POST":
        try:
            quarter = request.form["selectedQuarter"]
            quarter = int(quarter)
        except:
            quarter = getCurrentQuarter()
        try:
            academicYear = request.form["selectedAcademicYear"]
        except:
            academicYear = getCurrentAcademicYear()
    else:
        quarter = getCurrentQuarter()
        academicYear = getCurrentAcademicYear()

    pbls = Pbls.query.filter(Pbls.academicYear == academicYear).order_by(
        Pbls.academicYear.desc(), Pbls.quarter.desc(), Pbls.pblName
    )

    pblEvents = (
        PblEvents.query.join(Pbls)
        .filter(Pbls.quarter >= 0)
        .order_by(
            Pbls.quarter.desc(), PblEvents.eventDate, PblEvents.startTime, Pbls.pblName,
        )
    )

    # Get list of kickoff and final PBL events for current year and selected quarter

    pblKickoffEvents = (
        PblEvents.query.join(Pbls)
        .filter(
            PblEvents.eventCategory == "Kickoff",
            Pbls.academicYear == academicYear,
            Pbls.quarter == quarter,
        )
        .order_by(PblEvents.eventDate, PblEvents.startTime, Pbls.pblName,)
    )

    pblFinalEvents = (
        PblEvents.query.join(Pbls)
        .filter(
            PblEvents.eventCategory == "Final",
            Pbls.academicYear == academicYear,
            Pbls.quarter == quarter,
        )
        .order_by(PblEvents.eventDate, PblEvents.startTime, Pbls.pblName,)
    )

    return render_template(
        "pblplanner.html",
        title="STEM III PBL Planner",
        pbls=pbls,
        pblEvents=pblEvents,
        academicYearChoices=academicYearChoices,
        quarterOptions=quarterOptions,
        displayAcademicYear=academicYear,
        displayQuarter=quarter,
        pblKickoffEvents=pblKickoffEvents,
        pblFinalEvents=pblFinalEvents,
    )


@pblPlanner_bp.route("/stemiiipblreports")
@login_required
def download_PblReports():
    printLogEntry("Running download_PblReports()")
    quarterOptions = getQuarterChoices()
    currentQuarter = getCurrentQuarter()
    eventCategoryChoices = getPblEventCategoryChoices()
    return render_template(
        "pblreports.html",
        title="STEM III PBL Reports",
        quarterOptions=quarterOptions,
        displayQuarter=currentQuarter,
        eventCategoryChoices=eventCategoryChoices,
    )


@pblPlanner_bp.route("/stemiiipblplanner/downloadevents", methods=["GET", "POST"])
@login_required
def download_PblEvents():
    printLogEntry("Running download_PblEvents()")
    if request.method == "POST":
        quarter = request.form["selectedQuarter"]
        eventCategory = request.form["selectedEventCategory"]
        print("selectedQuarter =", quarter)
        quarter = int(quarter)
    else:
        quarter = getCurrentQuarter()
        eventCategory = "Kickoff"
    return downloadPblEvents(quarter, eventCategory)


@pblPlanner_bp.route("/stemiiipblplanner/downloadteams", methods=["GET", "POST"])
@login_required
def download_PblTeams():
    printLogEntry("Running download_PblTeams()")
    if request.method == "POST":
        quarter = request.form["selectedQuarter"]
        print("selectedQuarter =", quarter)
        quarter = int(quarter)
    else:
        quarter = getCurrentQuarter()
    return downloadPblTeams(quarter)


@pblPlanner_bp.route(
    "/stemiiipblplanner/downloadteamsandevents", methods=["GET", "POST"]
)
@login_required
def download_PblTeamsAndEvents():
    printLogEntry("Running download_PblTeamsAndEvents()")
    if request.method == "POST":
        quarter = request.form["selectedQuarter"]
        eventCategory = request.form["selectedEventCategory"]
        print("selectedQuarter =", quarter)
        quarter = int(quarter)
    else:
        quarter = getCurrentQuarter()
        eventCategory = "Kickoff"
    return downloadPblTeamsAndEventDetails(quarter, eventCategory)


@pblPlanner_bp.route(
    "/stemiiipblplanner/downloadfieldtripinfo", methods=["GET", "POST"]
)
@login_required
def download_PblFieldTripInfo():
    printLogEntry("Running download_PblEvents()")
    if request.method == "POST":
        quarter = request.form["selectedQuarter"]
        print("selectedQuarter =", quarter)
        quarter = int(quarter)
    else:
        quarter = getCurrentQuarter()
    return downloadPblFieldTripInfo(quarter)


@pblPlanner_bp.route("/stemiiiteams/", methods=["GET", "POST"])
@login_required
def displayStemIIITeams():
    printLogEntry("Running displayStemIIITeams()")
    # Create list of students to include for PBL teams
    students = db.session.query(
        Student.firstName, Student.lastName, Student.chattStateANumber
    ).filter(Student.yearOfGraduation == getClassYearOfGraduation("Juniors"))

    # Create PblTeam for each student for each quarter
    className = "STEM III"
    academicYear = getCurrentAcademicYear()
    quarters = [1, 2, 3, 4]
    for student in students:
        for quarter in quarters:
            # Check whether PblTeam exists for student
            log = PblTeams.query.filter(
                PblTeams.className == className,
                PblTeams.academicYear == academicYear,
                PblTeams.quarter == quarter,
                PblTeams.chattStateANumber == student.chattStateANumber,
            ).first()
            # Skip the record if the student is already in the PblTeams table
            if log:
                pass
            # Add a new record if the student is not already in the PblTeams table
            else:
                schoolYear, semester = getSchoolYearAndSemester(academicYear, quarter)
                pblTeam = PblTeams(
                    className=className,
                    academicYear=academicYear,
                    schoolYear=schoolYear,
                    semester=semester,
                    quarter=quarter,
                    pblNumber=quarter,
                    pblTeamNumber=0,
                    chattStateANumber=student.chattStateANumber,
                    pbl_id=None,
                )
                db.session.add(pblTeam)
                db.session.commit()
                print(
                    "Adding new PBL Team for",
                    student.firstName,
                    student.lastName,
                    student.chattStateANumber,
                )
    # Check request.method for different scenarios:
    # Default: GET with no parameters will display PBL team based on computed current quarter
    # POST with request.form handles case when user changes quarter using dropdown menu
    # GET with selectedQuarter handles case when redirected from saving team in order to stay
    # on previous page
    # The team event list uses eventCategory so it must be set to a default value if not included
    if request.method == "GET" and request.args.get("selectedQuarter"):
        quarter = request.args.get("selectedQuarter")
        print("selectedQuarter =", quarter)
        quarter = int(quarter)
        if request.args.get("selectedEventCategory"):
            eventCategory = request.args.get("selectedEventCategory")
            print("selectedEventCategory =", eventCategory)
        else:
            eventCategory = "Kickoff"
    elif request.method == "POST":
        print(request.form)
        selectedQuarter = request.form["selectedQuarter"]
        print("selectedQuarter =", selectedQuarter)
        quarter = int(selectedQuarter)
        try:
            if request.form["selectedEventCategory"]:
                eventCategory = request.form["selectedEventCategory"]
        except:
            eventCategory = "Kickoff"
    else:
        quarter = getCurrentQuarter()
        eventCategory = "Kickoff"
    pblTeams = (
        PblTeams.query.outerjoin(Pbls)
        .join(Student)
        .filter(
            PblTeams.className == className,
            PblTeams.academicYear == academicYear,
            PblTeams.quarter == quarter,
        )
        .order_by(Pbls.pblName, PblTeams.pblTeamNumber, Student.lastName)
        .all()
    )

    # Create set of numbered teams to assign students
    teamNumbers = []
    for i in range(1, 31, 1):
        teamNumbers.append(f"{i}")

    # Create tuple of pblOptions and set default choice to None
    pblOptions = list(getPblOptionsTuple(academicYear, quarter))
    pblOptions.insert(0, ("", "Choose PBL..."))
    pblOptions = tuple(pblOptions)

    # Create choices for PBL Team Communications Center
    pblEmailRecipientChoices = getPblEmailRecipientChoices(
        academicYear, quarter, className
    )
    pblCommunicationsActions = getPblEmailTemplates()

    quarterOptions = getQuarterChoices()
    eventCategoryChoices = getPblEventCategoryChoices()

    # Get list of PBL students and event info to display for PBL Team Event List
    pblTeamsAndEvents = (
        db.session.query(PblTeams, PblEvents)
        .select_from(PblTeams)
        .outerjoin(Pbls)
        .outerjoin(Pbls.PblEvents)
        .join(Student)
        .filter(
            Pbls.academicYear == academicYear,
            Pbls.quarter == quarter,
            PblEvents.eventCategory == eventCategory,
        )
        .order_by(
            Pbls.quarter,
            PblEvents.eventDate,
            PblEvents.startTime,
            Pbls.pblName,
            PblTeams.pblTeamNumber,
            Student.lastName,
        )
    )

    return render_template(
        "pblteams.html",
        title="STEM III Team Manager",
        students=students,
        teamNumbers=teamNumbers,
        pblOptions=pblOptions,
        pblTeams=pblTeams,
        quarterOptions=quarterOptions,
        displayQuarter=quarter,
        pblEmailRecipientChoices=pblEmailRecipientChoices,
        pblEmailTemplates=pblCommunicationsActions,
        eventCategoryChoices=eventCategoryChoices,
        displayEventCategory=eventCategory,
        pblTeamsAndEvents=pblTeamsAndEvents,
    )


@pblPlanner_bp.route("/emailteams", methods=["GET", "POST"])
@login_required
def emailTeams():
    printLogEntry("Running emailTeams()")
    quarter = int(request.form["quarter"])
    emailRecipients = int(request.form["emailRecipients"])
    pblCommunicationsActions = int(request.form["emailTemplate"])
    selectedEmailRecipients = request.form.getlist("sendEmailCheckbox")
    # print("quarter =", quarter)
    # print("emailRecipients:", emailRecipients)
    # print("emailTemplate:", emailTemplate)
    academicYear = getCurrentAcademicYear()
    className = "STEM III"
    if pblCommunicationsActions > 0:
        try:
            sendPblEmails(
                className,
                academicYear,
                quarter,
                emailRecipients,
                selectedEmailRecipients,
                pblCommunicationsActions,
            )
        except:
            flash("Error sending email", "error")
    elif pblCommunicationsActions < 0:
        try:
            updatePblEventCommentOnAttendanceLogs(
                className,
                academicYear,
                quarter,
                emailRecipients,
                selectedEmailRecipients,
                pblCommunicationsActions,
            )
            db.session.commit()
            flash("Notes added to attendance logs!", "success")
        except:
            flash("Error adding note to attendance logs", "error")

    return redirect(
        url_for("pblPlanner_bp.displayStemIIITeams", selectedQuarter=quarter)
    )


@pblPlanner_bp.route("/saveteams", methods=["GET", "POST"])
@login_required
def saveTeams():
    printLogEntry("Running saveTeams()")
    teamListjson = request.form["teamList"]
    teamList = json.loads(teamListjson)
    quarter = int(request.form["quarter"])

    className = "STEM III"
    academicYear = getCurrentAcademicYear()
    schoolYear, semester = getSchoolYearAndSemester(academicYear, quarter)
    pblNumber = quarter

    for team, teamInfo in teamList.items():
        print(team, teamInfo["teamMemberList"], teamInfo["pblChoice"])
        # Get the team number from team name (e.g. extract '1' from 'Team 1')
        pblTeamNumber = int(team.split()[1].strip())
        # Set the pblChoice to None if student not in team or if team's pblChoice is not set
        if pblTeamNumber == 0:
            pblChoice = None
        elif teamInfo["pblChoice"] == "":
            pblChoice = None
        else:
            pblChoice = int(teamInfo["pblChoice"])
        for chattStateANumber in teamInfo["teamMemberList"]:
            # Update database with PblTeam info
            # Get PblTeam log for student if it exists
            log = PblTeams.query.filter(
                PblTeams.className == className,
                PblTeams.academicYear == academicYear,
                PblTeams.quarter == quarter,
                PblTeams.chattStateANumber == chattStateANumber,
            ).first()
            # Update the record if the student is already in the PblTeams table
            if log:
                log.pblTeamNumber = pblTeamNumber
                log.pbl_id = pblChoice
            # Add a new record if the student is not already in the PblTeams table
            else:
                pblTeam = PblTeams(
                    className=className,
                    academicYear=academicYear,
                    schoolYear=schoolYear,
                    semester=semester,
                    quarter=quarter,
                    pblNumber=pblNumber,
                    pblTeamNumber=pblTeamNumber,
                    chattStateANumber=chattStateANumber,
                    pbl_id=pblChoice,
                )
                db.session.add(pblTeam)
            db.session.commit()
    flash("Teams have been saved!", "success")
    return redirect(
        url_for("pblPlanner_bp.displayStemIIITeams", selectedQuarter=quarter)
    )


@pblPlanner_bp.route("/stemiiipblplanner/newpbl", methods=["POST"])
@login_required
def new_Pbl():
    printLogEntry("Running new_Pbl()")
    pblEditorFormDetails = pblEditorForm(academicYear=getCurrentAcademicYear())
    pblEditorFormDetails.className.choices = [("STEM III", "STEM III")]
    pblEditorFormDetails.schoolYear.choices = getSchoolYearChoices()
    pblEditorFormDetails.academicYear.choices = getAcademicYearChoices()
    pblEditorFormDetails.semester.choices = getSemesterChoices()
    quarterChoices = list(getQuarterChoices())
    quarterChoices.insert(0, (0, "TBD"))
    quarterChoices = tuple(quarterChoices)
    pblEditorFormDetails.quarter.choices = quarterChoices
    pblEditorFormDetails.log_id.data = 0

    if "submitEditPbl" in request.form:
        print("request.form", request.form)
        if not pblEditorFormDetails.validate_on_submit():
            print("Edit PBL Form errors")
            printFormErrors(pblEditorFormDetails)
        if pblEditorFormDetails.validate_on_submit():
            print("submitEditPbl submitted")

            # Update the database with the values submitted in the form
            className = pblEditorFormDetails.className.data
            academicYear = pblEditorFormDetails.academicYear.data
            schoolYear = pblEditorFormDetails.schoolYear.data
            semester = pblEditorFormDetails.semester.data
            quarter = pblEditorFormDetails.quarter.data
            schoolYear, semester = getSchoolYearAndSemester(academicYear, quarter)
            pblName = pblEditorFormDetails.pblName.data
            pblSponsor = pblEditorFormDetails.pblSponsor.data
            pblSponsorPersonName = pblEditorFormDetails.pblSponsorPersonName.data
            pblSponsorEmail = pblEditorFormDetails.pblSponsorEmail.data
            pblSponsorPhone = pblEditorFormDetails.pblSponsorPhone.data
            pblComments = pblEditorFormDetails.pblComments.data

            pblLog = Pbls(
                className=className,
                schoolYear=schoolYear,
                academicYear=academicYear,
                semester=semester,
                quarter=quarter,
                pblNumber=quarter,
                pblName=pblName,
                pblSponsor=pblSponsor,
                pblSponsorPersonName=pblSponsorPersonName,
                pblSponsorEmail=pblSponsorEmail,
                pblSponsorPhone=pblSponsorPhone,
                pblComments=pblComments,
            )
            db.session.add(pblLog)
            db.session.commit()

            # Use id for PBL record to create placeholder kickoff and final events
            pblEventLog = PblEvents(
                pbl_id=pblLog.id,
                eventCategory="Kickoff",
                confirmed=0,
                startTime=time(hour=9, minute=30, second=0),
                endTime=time(hour=10, minute=30, second=0),
                eventCity="Chattanooga",
                eventState="TN",
            )
            db.session.add(pblEventLog)
            db.session.commit()
            pblEventLog = PblEvents(
                pbl_id=pblLog.id,
                eventCategory="Final",
                confirmed=0,
                startTime=time(hour=9, minute=30, second=0),
                endTime=time(hour=10, minute=30, second=0),
                eventCity="Chattanooga",
                eventState="TN",
            )
            db.session.add(pblEventLog)
            db.session.commit()
            flash("New PBL created!", "success")
            return redirect(url_for("pblPlanner_bp.displayStemIIIPblPlanner"))

    return render_template(
        "pbleditor.html",
        title="New PBL Editor",
        pblEditorForm=pblEditorFormDetails,
        pblName=None,
    )


@pblPlanner_bp.route("/stemiiipblplanner/<int:log_id>/editpbl", methods=["POST"])
@login_required
def edit_Pbl(log_id):
    printLogEntry("Running edit_Pbl()")
    pblEditorFormDetails = pblEditorForm()
    pblEditorFormDetails.className.choices = [("STEM III", "STEM III")]
    pblEditorFormDetails.schoolYear.choices = getSchoolYearChoices()
    pblEditorFormDetails.academicYear.choices = getAcademicYearChoices()
    pblEditorFormDetails.semester.choices = getSemesterChoices()
    quarterChoices = list(getQuarterChoices())
    quarterChoices.insert(0, (0, "TBD"))
    quarterChoices = tuple(quarterChoices)
    pblEditorFormDetails.quarter.choices = quarterChoices
    # pblEditorFormDetails.pblName.choices = getPblOptionsTuple(2)

    log = Pbls.query.get_or_404(log_id)
    LogDetails = f"{(log_id)} {log.pblName}"
    printLogEntry("Running edit_Pbl(" + LogDetails + ")")

    if "submitEditPbl" in request.form:
        print("request.form", request.form)
        if not pblEditorFormDetails.validate_on_submit():
            print("Edit PBL Form errors")
            printFormErrors(pblEditorFormDetails)
        if pblEditorFormDetails.validate_on_submit():
            print("submitEditPbl submitted")

            # Update the database with the values submitted in the form
            log.className = pblEditorFormDetails.className.data
            # Check whether the PBL academic year has changed
            newAcademicYear = False
            if log.academicYear != pblEditorFormDetails.academicYear.data:
                newAcademicYear = True
            log.academicYear = pblEditorFormDetails.academicYear.data
            # Check whether the PBL quarter has changed
            newQuarter = False
            if log.quarter != pblEditorFormDetails.quarter.data:
                newQuarter = True
            log.quarter = pblEditorFormDetails.quarter.data
            log.schoolYear, log.semester = getSchoolYearAndSemester(
                log.academicYear, log.quarter
            )
            log.pblNumber = log.quarter
            log.pblName = pblEditorFormDetails.pblName.data
            log.pblSponsor = pblEditorFormDetails.pblSponsor.data
            log.pblSponsorPersonName = pblEditorFormDetails.pblSponsorPersonName.data
            log.pblSponsorPhone = pblEditorFormDetails.pblSponsorPhone.data
            log.pblSponsorEmail = pblEditorFormDetails.pblSponsorEmail.data
            log.pblComments = pblEditorFormDetails.pblComments.data
            # If the PBL year or quarter has been updated, check whether
            # the change impacts any PBL teams and remove the PBL from
            # impacted teams if necessary
            if newAcademicYear or newQuarter:
                impactedPblTeams = PblTeams.query.filter(PblTeams.pbl_id == log_id)
                for pblTeam in impactedPblTeams:
                    pblTeam.pbl_id = None
                    print(
                        f"PBL year or quarter has changed.  Removing PBL {log_id} from PBL Team {pblTeam.id}"
                    )
            db.session.commit()
            return redirect(url_for("pblPlanner_bp.displayStemIIIPblPlanner"))

    pblName = log.pblName
    print("pblName =", pblName)
    if log:
        pblEditorFormDetails.log_id.data = log.id
        pblEditorFormDetails.className.data = log.className
        pblEditorFormDetails.schoolYear.data = log.schoolYear
        pblEditorFormDetails.academicYear.data = log.academicYear
        pblEditorFormDetails.semester.data = log.semester
        pblEditorFormDetails.quarter.data = log.quarter
        pblEditorFormDetails.pblName.data = log.pblName
        pblEditorFormDetails.pblSponsor.data = log.pblSponsor
        pblEditorFormDetails.pblSponsorPersonName.data = log.pblSponsorPersonName
        pblEditorFormDetails.pblSponsorPhone.data = log.pblSponsorPhone
        pblEditorFormDetails.pblSponsorEmail.data = log.pblSponsorEmail
        pblEditorFormDetails.pblComments.data = log.pblComments
        print(
            "editPblDetails=",
            pblEditorFormDetails.log_id.data,
            pblEditorFormDetails.pblName.data,
        )
    return render_template(
        "pbleditor.html",
        title="PBL Editor",
        pblEditorForm=pblEditorFormDetails,
        pblName=pblName,
    )


@pblPlanner_bp.route("/stemiiipblplanner/<int:pbl_id>/newevent", methods=["POST"])
@login_required
def new_PblEvent(pbl_id):
    pblEventEditorFormDetails = pblEventEditorForm()
    pblLog = Pbls.query.get_or_404(pbl_id)
    pblName = pblLog.pblName
    event_quarter = pblLog.quarter
    pblEventEditorFormDetails.eventCategory.choices = getPblEventCategoryChoices()
    pblEventEditorFormDetails.log_id.data = 0

    printLogEntry("Running new_PblEvent()")

    if "submitEditPblEvent" in request.form:
        print("request.form", request.form)
        if not pblEventEditorFormDetails.validate_on_submit():
            print("Edit PBL Event Form errors")
            printFormErrors(pblEventEditorFormDetails)
        if pblEventEditorFormDetails.validate_on_submit():
            print("submitEditPblEvent submitted")

            # Update the database with the values submitted in the form
            eventCategory = pblEventEditorFormDetails.eventCategory.data
            confirmed = pblEventEditorFormDetails.confirmed.data
            eventDate = pblEventEditorFormDetails.eventDate.data

            # Format time values from string objects to time objects
            startTime = datetime.strptime(
                pblEventEditorFormDetails.startTime.data, "%H:%M"
            ).time()
            endTime = datetime.strptime(
                pblEventEditorFormDetails.endTime.data, "%H:%M"
            ).time()

            eventLocation = pblEventEditorFormDetails.eventLocation.data
            eventStreetAddress1 = pblEventEditorFormDetails.eventStreetAddress1.data
            eventCity = pblEventEditorFormDetails.eventCity.data
            eventState = pblEventEditorFormDetails.eventState.data
            eventZip = pblEventEditorFormDetails.eventZip.data
            eventComments = pblEventEditorFormDetails.eventComments.data
            googleCalendarEventID = None

            # Add event to GoogleCalendar if it has date and times
            if eventDate and startTime and endTime:
                googleCalendarEventID = addPblEventToCalendar(
                    googleCalendarEventID,
                    eventCategory,
                    pblName,
                    eventDate,
                    eventLocation,
                    eventStreetAddress1,
                    eventCity,
                    eventState,
                    eventZip,
                    startTime,
                    endTime,
                    pblLog.pblSponsorPersonName,
                )
                googleCalendarEventID = googleCalendarEventID

            pblEventLog = PblEvents(
                pbl_id=pbl_id,
                eventCategory=eventCategory,
                confirmed=confirmed,
                eventDate=eventDate,
                startTime=startTime,
                endTime=endTime,
                eventLocation=eventLocation,
                eventStreetAddress1=eventStreetAddress1,
                eventCity=eventCity,
                eventState=eventState,
                eventZip=eventZip,
                eventComments=eventComments,
                googleCalendarEventID=googleCalendarEventID,
            )
            db.session.add(pblEventLog)
            db.session.commit()
            return redirect(url_for("pblPlanner_bp.displayStemIIIPblPlanner"))

    return render_template(
        "pbleventeditor.html",
        title="New PBL Event Editor",
        pblEventEditorForm=pblEventEditorFormDetails,
        pblName=pblName,
        event_quarter=event_quarter,
    )


@pblPlanner_bp.route("/stemiiipblplanner/<int:log_id>/editpblevent", methods=["POST"])
@login_required
def edit_PblEvent(log_id):
    pblEventEditorFormDetails = pblEventEditorForm()
    pblEventEditorFormDetails.eventCategory.choices = getPblEventCategoryChoices()

    log = PblEvents.query.get_or_404(log_id)
    LogDetails = f"{(log_id)} {log.Pbls.pblName} {log.eventCategory}"
    event_quarter = log.Pbls.quarter
    printLogEntry("Running edit_PblEvent(" + LogDetails + ")")

    if "submitEditPblEvent" in request.form:
        print("request.form", request.form)
        if not pblEventEditorFormDetails.validate_on_submit():
            print("Edit PBL Event Form errors")
            printFormErrors(pblEventEditorFormDetails)
        if pblEventEditorFormDetails.validate_on_submit():
            print("submitEditPblEvent submitted")

            # Update the database with the values submitted in the form
            log.eventCategory = pblEventEditorFormDetails.eventCategory.data
            log.confirmed = pblEventEditorFormDetails.confirmed.data
            log.eventDate = pblEventEditorFormDetails.eventDate.data

            # Format time values from string objects to time objects
            startTime = datetime.strptime(
                pblEventEditorFormDetails.startTime.data, "%H:%M"
            ).time()
            endTime = datetime.strptime(
                pblEventEditorFormDetails.endTime.data, "%H:%M"
            ).time()

            log.startTime = startTime
            log.endTime = endTime
            log.eventLocation = pblEventEditorFormDetails.eventLocation.data
            log.eventStreetAddress1 = pblEventEditorFormDetails.eventStreetAddress1.data
            log.eventCity = pblEventEditorFormDetails.eventCity.data
            log.eventState = pblEventEditorFormDetails.eventState.data
            log.eventZip = pblEventEditorFormDetails.eventZip.data
            log.eventComments = pblEventEditorFormDetails.eventComments.data

            # Add event to GoogleCalendar if it has date and times
            if log.eventDate and startTime and endTime:
                googleCalendarEventID = addPblEventToCalendar(
                    log.googleCalendarEventID,
                    log.eventCategory,
                    log.Pbls.pblName,
                    log.eventDate,
                    log.eventLocation,
                    log.eventStreetAddress1,
                    log.eventCity,
                    log.eventState,
                    log.eventZip,
                    startTime,
                    endTime,
                    log.Pbls.pblSponsorPersonName,
                )
                log.googleCalendarEventID = googleCalendarEventID
            # If the eventDate has been cleared, delete the event from Google Calendar
            if log.eventDate == None and log.googleCalendarEventID:
                deletePblEventFromCalendar(log.googleCalendarEventID)
                log.googleCalendarEventID = None

            db.session.commit()
            return redirect(
                url_for(
                    "pblPlanner_bp.displayStemIIIPblPlanner",
                    selectedQuarter=event_quarter,
                )
            )

    pblName = log.Pbls.pblName
    print("pblName =", pblName)
    if log:
        pblEventEditorFormDetails.log_id.data = log.id
        pblEventEditorFormDetails.eventCategory.data = log.eventCategory
        pblEventEditorFormDetails.confirmed.data = log.confirmed
        pblEventEditorFormDetails.eventDate.data = log.eventDate
        pblEventEditorFormDetails.startTime.data = log.startTime.strftime("%H:%M")
        pblEventEditorFormDetails.endTime.data = log.endTime.strftime("%H:%M")
        pblEventEditorFormDetails.eventLocation.data = log.eventLocation
        pblEventEditorFormDetails.eventStreetAddress1.data = log.eventStreetAddress1
        pblEventEditorFormDetails.eventCity.data = log.eventCity
        pblEventEditorFormDetails.eventState.data = log.eventState
        pblEventEditorFormDetails.eventZip.data = log.eventZip
        pblEventEditorFormDetails.eventComments.data = log.eventComments
        print(
            "editPblEventDetails=",
            pblEventEditorFormDetails.log_id.data,
            pblEventEditorFormDetails.eventCategory.data,
        )
    return render_template(
        "pbleventeditor.html",
        title="PBL Event Editor",
        pblEventEditorForm=pblEventEditorFormDetails,
        pblName=pblName,
        event_quarter=event_quarter,
    )


@pblPlanner_bp.route("/stemiiipblplanner/<int:log_id>/deletepbl", methods=["POST"])
@login_required
def delete_Pbl(log_id):
    log = Pbls.query.get_or_404(log_id)
    pblYear = log.schoolYear
    pblSemester = log.semester
    pbl_year_semester = str(pblYear) + " " + pblSemester
    LogDetails = f"id: {log_id} pblName: {log.pblName} pblYear: {pblYear} pblSemester: {pblSemester}"
    printLogEntry("Running delete_Pbl(" + LogDetails + ")")
    protected_pbl_semesters_list = get_protected_pbl_semesters()
    if pbl_year_semester in protected_pbl_semesters_list:
        print("Unable to delete PBLs from previous years")
        print(f"Protected PBL Semesters: {protected_pbl_semesters_list}")
        flash("Unable to delete PBLs from previous years", "error")
        return redirect(url_for("pblPlanner_bp.displayStemIIIPblPlanner"))
    # Check whether there are any events associated with the PBL
    events = PblEvents.query.filter(PblEvents.pbl_id == log.id)
    for event in events:
        # Delete any Google Calendar events associated with the event
        if event.googleCalendarEventID:
            deletePblEventFromCalendar(event.googleCalendarEventID)
            print("Deleted PBL event from Google Calendar")
            event.googleCalendarEventID = None
    db.session.delete(log)
    db.session.commit()
    flash("PBL has been deleted!", "success")
    return redirect(url_for("pblPlanner_bp.displayStemIIIPblPlanner"))


@pblPlanner_bp.route("/stemiiipblplanner/<int:log_id>/delete", methods=["POST"])
@login_required
def delete_PblEvent(log_id):
    log = PblEvents.query.get_or_404(log_id)
    LogDetails = f"{(log_id)} {log.Pbls.pblName} {log.eventCategory}"
    pblYear = log.Pbls.schoolYear
    pblSemester = log.Pbls.semester
    pbl_year_semester = str(pblYear) + " " + pblSemester
    LogDetails = f"{(log_id)} {log.Pbls.pblName} {log.eventCategory} pblYear: {(pblYear)} pblSemester: {pblSemester}"
    printLogEntry("Running delete_PblEvent(" + LogDetails + ")")
    protected_pbl_semesters_list = get_protected_pbl_semesters()
    if pbl_year_semester in protected_pbl_semesters_list:
        print("Unable to delete PBLs from previous years")
        print(f"Protected PBL Semesters: {protected_pbl_semesters_list}")
        flash("Unable to delete PBL events from previous years", "error")
        return redirect(url_for("pblPlanner_bp.displayStemIIIPblPlanner"))
    # Delete any Google Calendar events associated with the event
    if log.googleCalendarEventID:
        deletePblEventFromCalendar(log.googleCalendarEventID)
        print("Deleted PBL event from Google Calendar")
        log.googleCalendarEventID = None
    db.session.delete(log)
    db.session.commit()
    flash("PBL Event has been deleted!", "success")
    return redirect(url_for("pblPlanner_bp.displayStemIIIPblPlanner"))
