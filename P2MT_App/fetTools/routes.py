import os
from datetime import datetime
from flask import (
    render_template,
    url_for,
    flash,
    redirect,
    request,
    Blueprint,
    current_app,
    send_file,
)
from flask_login import login_required
from P2MT_App.fetTools.forms import UploadFetDataForm
from P2MT_App.fetTools.generateFetOutputFiles import ripFetFiles
from P2MT_App.main.utilityfunctions import printLogEntry

fetTools_bp = Blueprint("fetTools_bp", __name__)


def save_csvFile(form_csvFetFile, filename):
    output_file_path = "/tmp"
    file_path = os.path.join(output_file_path, filename)
    # file_path = os.path.join(current_app.root_path, "static/fet_data_files", filename)
    form_csvFetFile.save(file_path)
    # file1 = open(file_path, "w")
    # file1.write(form_csvFetFile.data)
    # file1.close()
    return file_path


@fetTools_bp.route("/fettools", methods=["GET", "POST"])
@login_required
def displayFetTools():
    form = UploadFetDataForm()
    if form.validate_on_submit():
        if form.csvFetStudentInputFile.data:
            FetStudentInputFile = save_csvFile(
                form.csvFetStudentInputFile.data, "FET_Student_Input_File.csv"
            )
        if form.csvFetClassTeacherInputFile.data:
            FetClassTeacherInputFile = save_csvFile(
                form.csvFetClassTeacherInputFile.data,
                "FET_Class_Teacher_Input_File.csv",
            )
        if form.csvFetTimetableInputFile.data:
            FetTimeTableFile = save_csvFile(
                form.csvFetTimetableInputFile.data, "FET_Timetable_File.csv"
            )
        flash("Your account has been updated!", "success")
        # output_file_path = os.path.join(current_app.root_path, "static/fet_data_files")
        output_file_path = "/tmp"
        ripFetFiles(
            form.yearOfGraduation.data,
            form.schoolYear.data,
            form.semester.data,
            FetStudentInputFile,
            FetClassTeacherInputFile,
            FetTimeTableFile,
            output_file_path,
        )
        print(
            "===   Completed ripFetFiles.  Redirecting to fetOutputFiles   ===",
            datetime.now(),
            "   ===",
        )
        return redirect(url_for("fetTools_bp.fetOutputFiles"))
    elif request.method == "GET":
        return render_template(
            "fettools.html", title="FET Tools", UploadFetDataForm=form
        )
    print(form.errors)


@fetTools_bp.route("/fetoutputfiles", methods=["GET"])
@login_required
def fetOutputFiles():
    print("===  Arriving at fetOutputFiles   ===", datetime.now(), "   ===")
    return render_template("fetoutputfiles.html", title="FET Output Files")


@fetTools_bp.route("/fetoutputfiles/downloadcsv")
@login_required
def download_FetCsvFile():
    printLogEntry("download_FetCsvFile() function called")
    csvFilename = "/tmp/FetOutputFile.csv"
    return send_file(csvFilename, as_attachment=True, cache_timeout=0)


@fetTools_bp.route("/fetoutputfiles/downloadjson")
@login_required
def download_FetJsonFile():
    printLogEntry("download_FetJsonFile() function called")
    csvFilename = "/tmp/FetOutputFile.json"
    return send_file(csvFilename, as_attachment=True, cache_timeout=0)
