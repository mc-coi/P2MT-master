# Python standard libraries
import json
import os
import sqlite3

# Third-party libraries
from flask import (
    Flask,
    url_for,
    redirect,
    render_template,
    redirect,
    Blueprint,
    session,
)
from flask_login import (
    current_user,
    login_required,
    login_user,
    logout_user,
)
import requests

# P2MT imports
from P2MT_App import db, oauth
from P2MT_App.models import FacultyAndStaff
from P2MT_App.googleAPI.googleLogin import get_google_provider_cfg
from P2MT_App.main.utilityfunctions import printLogEntry
from P2MT_App.googleAPI.googleLogin import updateProfilePic, updateGoogleSub

googleAPI_bp = Blueprint("googleAPI_bp", __name__)


@googleAPI_bp.route("/homepage")
def homepage():
    if current_user.is_authenticated:
        return render_template("login.html", title="Login", user=current_user)
    else:
        print("current_user.is_authenticated =", current_user.is_authenticated)
        session["username"] = "Log In"
        return render_template("login.html", title="Login", user=None)


@googleAPI_bp.route("/login")
def login():
    printLogEntry("Running login()")
    redirect_uri = url_for("googleAPI_bp.auth", _external=True)
    return oauth.google.authorize_redirect(redirect_uri)


@googleAPI_bp.route("/login/callback")
def auth():
    printLogEntry("Running auth()")
    get_google_provider_cfg()
    token = oauth.google.authorize_access_token()
    userinfo_response = oauth.google.parse_id_token(token)
    if userinfo_response:
        if userinfo_response["email_verified"]:
            unique_id = userinfo_response["sub"]
            users_email = userinfo_response["email"]
            picture = userinfo_response["picture"]
            users_name = userinfo_response["given_name"]
            print("unique_id:", unique_id)
            print("users_email:", users_email)
            print("picture:", picture)
            print("users_name:", users_name)
            # Create a user in your db with the information provided
            # by Google
            # user = User(
            #     id_=unique_id, name=users_name, email=users_email, profile_pic=picture
            # )

            # Verify user is approved to access the apps
            user = FacultyAndStaff.query.filter(
                FacultyAndStaff.email == users_email
            ).first()
            print("User query result =", user)
            print("User type =", type(user))

            if user:
                printLogEntry("This is a valid user")
                # Begin user session by logging the user in
                try:
                    updateProfilePic(user.id, picture)
                    updateGoogleSub(user.id, unique_id)
                    db.session.commit()
                    printLogEntry("Updated Google profile pic and unique id")
                except:
                    printLogEntry("Unable to update Google profile pic or unique id")
                    pass
                login_user(user)
                session["username"] = f"{user.firstName} {user.lastName}"

    # if False:
    #     # Doesn't exist? Add it to the database.
    #     if not User.get(unique_id):
    #         User.create(unique_id, users_name, users_email, picture)

    return redirect("/logininfo")


@googleAPI_bp.route("/logininfo")
def logininfo():
    print("current_user =", current_user)
    if current_user.is_authenticated:
        return render_template("logininfo.html", title="Login Page", user=current_user)
    else:
        return render_template("logininfo.html", title="Login Page", user=None)


@googleAPI_bp.route("/logout")
@login_required
def logout():
    session["username"] = "Logged Out"
    logout_user()
    return redirect("/")

