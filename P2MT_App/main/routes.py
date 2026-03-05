from flask import render_template, redirect, url_for, flash, request, Blueprint
from flask_login import login_required
from P2MT_App import db
from P2MT_App.models import SurveyResponse
from P2MT_App.main.setupFunctions import (
    initializeInterventionTypes,
    addSchoolCalendarDays,
)
from .utilityfunctions import printLogEntry
from P2MT_App.main.testFunctions import setAttendanceForTmiTesting
from datetime import date
from flask_login import current_user, login_required

main_bp = Blueprint("main_bp", __name__)


@main_bp.route("/")
def home():
    return render_template("home.html", title="Home")


@main_bp.route("/about")
def displayAbout():
    return render_template("about.html", title="About")


@main_bp.route("/survey", methods=["GET", "POST"])
@login_required
def displaySurvey():
    printLogEntry("Running displaySurvey()")
    responses = SurveyResponse.query.order_by(SurveyResponse.timestamp.desc())

    if request.method == "POST":
        print(request.form["comment"])
        new_response = SurveyResponse(
            staffID=current_user.id, comment=request.form["comment"]
        )
        db.session.add(new_response)
        db.session.commit()
        return redirect(url_for("main_bp.displaySurvey"))

    return render_template("survey.html", title="P2MT User Survey", responses=responses)


@main_bp.route("/setupP2mt")
@login_required
def setupP2mt():
    # Create all the database tables if not already created
    db.create_all()
    initializeInterventionTypes()
    addSchoolCalendarDays(date(2020, 8, 3), date(2021, 6, 4))
    db.session.commit()
    return redirect(url_for("p2mtAdmin_bp.displayP2MTAdmin"))


@main_bp.route("/testP2mt")
@login_required
def testP2mt():
    initializeInterventionTypes()
    setAttendanceForTmiTesting(date(2020, 8, 3), date(2020, 8, 18))
    db.session.commit()
    return redirect(url_for("p2mtAdmin_bp.displayP2MTAdmin"))


# Temporary routes for testing new features


@main_bp.route("/analytics")
def displayAnalyticsTest():
    return render_template("analytics.html")


@main_bp.route("/sandbox")
def displaySandbox():
    return render_template("sandbox.html")

