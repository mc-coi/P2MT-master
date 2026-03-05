from flask import (
    render_template,
    request,
    redirect,
    url_for,
    flash,
    Blueprint,
    make_response,
    jsonify,
)
from flask_login import login_required
from P2MT_App import db
from datetime import date, datetime
from P2MT_App.main.setupFunctions import extendSchoolCalendarIfNecessary
from P2MT_App.main.utilityfunctions import printLogEntry
from P2MT_App.models import SchoolCalendar
from P2MT_App.schoolCalendar.forms import (
    updateSchoolCalendarFieldListForm,
    updateSchoolCalendarContainerForm,
)
from P2MT_App.main.referenceData import getCurrent_Start_End_Tmi_Dates
from icecream import ic

schoolCalendar_bp = Blueprint("schoolCalendar_bp", __name__)


@schoolCalendar_bp.route("/schoolcalendar", methods=["GET"])
@login_required
def displaySchoolCalendar():
    extendSchoolCalendarIfNecessary()
    # Create top level form for school calendar
    updateSchoolCalendarContainerFormDetails = updateSchoolCalendarContainerForm()

    printLogEntry("Running displaySchoolCalendar()")
    startTmiPeriod, endTmiPeriod, tmiDay = getCurrent_Start_End_Tmi_Dates()
    # Set default value to prevent error of NoneType values before initialization
    if startTmiPeriod == None or endTmiPeriod == None or tmiDay == None:
        startTmiPeriod = date(1970, 1, 1)
        endTmiPeriod = date(1970, 1, 1)
        tmiDay = date(1970, 1, 1)

    # if updateSchoolCalendarContainerFormDetails.validate_on_submit():
    #     print("Form submitted!")
    #     if updateSchoolCalendarContainerFormDetails.schoolCalendarDays:
    #         print("School days update submitted")
    #         print(len(updateSchoolCalendarContainerFormDetails.schoolCalendarDays.data))
    #         for (
    #             schoolCalendarDay
    #         ) in updateSchoolCalendarContainerFormDetails.schoolCalendarDays.data:
    #             if schoolCalendarDay["updateFlag"] == "updated":
    #                 log_id = schoolCalendarDay["log_id"]
    #                 print("log_id = ", log_id)
    #                 schoolCalendar = SchoolCalendar.query.get_or_404(log_id)
    #                 schoolCalendar.stemSchoolDay = schoolCalendarDay["stemSchoolDay"]
    #                 schoolCalendar.phaseIISchoolDay = schoolCalendarDay[
    #                     "phaseIISchoolDay"
    #                 ]
    #                 schoolCalendar.chattStateSchoolDay = schoolCalendarDay[
    #                     "chattStateSchoolDay"
    #                 ]
    #                 schoolCalendar.seniorErDay = schoolCalendarDay["seniorErDay"]
    #                 schoolCalendar.juniorErDay = schoolCalendarDay["juniorErDay"]
    #                 schoolCalendar.seniorUpDay = schoolCalendarDay["seniorUpDay"]
    #                 schoolCalendar.juniorUpDay = schoolCalendarDay["juniorUpDay"]
    #                 schoolCalendar.startTmiPeriod = schoolCalendarDay["startTmiPeriod"]
    #                 schoolCalendar.tmiDay = schoolCalendarDay["tmiDay"]
    #                 db.session.commit()

    # print(updateSchoolCalendarContainerFormDetails.errors)

    # Query database for school calendar day info
    # startCalendarDate must correspond to a Monday for correct display on School Calendar
    # if date is between June 1, 2020 and May 30, 2021 --> start = first Monday after July 31, 2020
    # if date is between June 1, 2021 and May 30, 2022 --> start = first Monday after July 31, 2021
    # if date is between June 1, 2022 and May 30, 2023 --> start = first Monday after July 31, 2022

    # use last day of July as search criteria to find the first Monday in August
    if date.today().month > 5:
        last_day_of_July = date(date.today().year, 7, 31)
    else:
        last_day_of_July = date(date.today().year - 1, 7, 31)

    startCalendarDate = (
        SchoolCalendar.query.filter(
            SchoolCalendar.day == "M", SchoolCalendar.classDate > last_day_of_July
        )
        .order_by(SchoolCalendar.classDate)
        .first()
    ).classDate
    ic(startCalendarDate)

    schoolCalendarDays = SchoolCalendar.query.filter(
        SchoolCalendar.day != "S", SchoolCalendar.classDate >= startCalendarDate
    ).all()

    # Populate form info with database values
    for schoolCalendarDay in schoolCalendarDays:
        # Create sub-form for school calendar day details
        updateSchoolCalendarFieldListFormDetails = updateSchoolCalendarFieldListForm()
        updateSchoolCalendarFieldListFormDetails.log_id = schoolCalendarDay.id
        updateSchoolCalendarFieldListFormDetails.classDate = schoolCalendarDay.classDate
        updateSchoolCalendarFieldListFormDetails.stemSchoolDay = (
            schoolCalendarDay.stemSchoolDay
        )
        updateSchoolCalendarFieldListFormDetails.phaseIISchoolDay = (
            schoolCalendarDay.phaseIISchoolDay
        )
        updateSchoolCalendarFieldListFormDetails.chattStateSchoolDay = (
            schoolCalendarDay.chattStateSchoolDay
        )
        updateSchoolCalendarFieldListFormDetails.seniorErDay = (
            schoolCalendarDay.seniorErDay
        )
        updateSchoolCalendarFieldListFormDetails.juniorErDay = (
            schoolCalendarDay.juniorErDay
        )
        updateSchoolCalendarFieldListFormDetails.seniorUpDay = (
            schoolCalendarDay.seniorUpDay
        )
        updateSchoolCalendarFieldListFormDetails.juniorUpDay = (
            schoolCalendarDay.juniorUpDay
        )
        updateSchoolCalendarFieldListFormDetails.startTmiPeriod = (
            schoolCalendarDay.startTmiPeriod
        )
        updateSchoolCalendarFieldListFormDetails.tmiDay = schoolCalendarDay.tmiDay
        updateSchoolCalendarFieldListFormDetails.updateFlag = ""
        # Append school day details to top level form
        updateSchoolCalendarContainerFormDetails.schoolCalendarDays.append_entry(
            updateSchoolCalendarFieldListFormDetails
        )

    return render_template(
        "schoolcalendar.html",
        title="School Calendar",
        schoolCalendarForm=updateSchoolCalendarContainerFormDetails,
        schoolCalendarDates=schoolCalendarDays,
        startTmiPeriod=startTmiPeriod,
        endTmiPeriod=endTmiPeriod,
        tmiDay=tmiDay,
    )


@schoolCalendar_bp.route("/schoolcalendar/update-field", methods=["GET", "POST"])
@login_required
def updateSchoolCalendar():
    """Process updated setting for school calendar day."""
    req = request.get_json()
    log_id = req["log_id"]
    schoolCalendar = SchoolCalendar.query.get_or_404(log_id)
    setattr(schoolCalendar, req["field"], req["value"])
    db.session.commit()
    res = make_response(jsonify({"result": "success"}), 200)
    return res
