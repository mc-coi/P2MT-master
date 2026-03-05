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
from P2MT_App.models import Student, FacultyAndStaff, Parents
from P2MT_App.p2mtAdmin.forms import (
    addStudentForm,
    updateStudentForm,
    selectStudentToEditForm,
    uploadStudentListForm,
    downloadStudentListForm,
    deleteStudentForm,
    addStaffForm,
    selectStaffToEditForm,
    downloadStaffListForm,
    updateStaffForm,
    uploadStaffListForm,
    deleteStaffForm,
    selectParentsToEditForm,
    uploadParentsListForm,
    updateParentsForm,
    downloadParentsListForm,
)
from P2MT_App.main.referenceData import (
    getStudents,
    getStudentsById,
    getStaffFromFacultyAndStaff,
    getStudentName,
    setEmailModeStatus,
    getEmailModeStatus,
)

from P2MT_App.main.setupFunctions import extendSchoolCalendarIfNecessary

from P2MT_App.p2mtAdmin.p2mtAdmin import (
    addStudentToDatabase,
    uploadStudentList,
    deleteStudent,
    downloadStudentList,
    addStaffToDatabase,
    downloadStaffList,
    uploadStaffList,
    deleteStaff,
    downloadParentsList,
    uploadParentsList,
    addParentsToDatabase,
)
from P2MT_App.main.utilityfunctions import (
    printLogEntry,
    printFormErrors,
    save_File,
    setToNoneIfEmptyString,
)

p2mtAdmin_bp = Blueprint("p2mtAdmin_bp", __name__)

# Route for direct download from templates folder
@p2mtAdmin_bp.route("/templates/student_list_template")
@login_required
def downloadStudentListTemplate():
    try:
        return send_file(
            "static/templates/student_list_template.csv",
            attachment_filename="student_list_template.csv",
            as_attachment=True,
            cache_timeout=0,
        )
    except Exception as e:
        return str(e)


@p2mtAdmin_bp.route("/templates/parent_list_template")
@login_required
def downloadParentListTemplate():
    try:
        return send_file(
            "static/templates/parent_list_template.csv",
            attachment_filename="parent_list_template.csv",
            as_attachment=True,
            cache_timeout=0,
        )
    except Exception as e:
        return str(e)


@p2mtAdmin_bp.route("/templates/staff_list_template")
@login_required
def downloadStaffListTemplate():
    try:
        return send_file(
            "static/templates/staff_list_template.csv",
            attachment_filename="staff_list_template.csv",
            as_attachment=True,
            cache_timeout=0,
        )
    except Exception as e:
        return str(e)


@p2mtAdmin_bp.route("/p2mtadmin", methods=["GET", "POST"])
@login_required
def displayP2MTAdmin():
    printLogEntry("Running displayP2MTAdmin()")
    extendSchoolCalendarIfNecessary()
    addStudentFormDetails = addStudentForm()
    selectStudentToEditFormDetails = selectStudentToEditForm()
    selectStudentToEditFormDetails.studentName.choices = getStudentsById()
    downloadStudentListFormDetails = downloadStudentListForm()
    uploadStudentListFormDetails = uploadStudentListForm()
    deleteStudentFormDetails = deleteStudentForm()
    deleteStudentFormDetails.studentName.choices = getStudents()
    selectParentsToEditFormDetails = selectParentsToEditForm()
    selectParentsToEditFormDetails.studentName.choices = getStudents()
    downloadParentsListFormDetails = downloadParentsListForm()
    uploadParentsListFormDetails = uploadParentsListForm()
    addStaffFormDetails = addStaffForm()
    selectStaffToEditFormDetails = selectStaffToEditForm()
    selectStaffToEditFormDetails.staffName.choices = getStaffFromFacultyAndStaff()
    downloadStaffListFormDetails = downloadStaffListForm()
    uploadStaffListFormDetails = uploadStaffListForm()
    deleteStaffFormDetails = deleteStaffForm()
    deleteStaffFormDetails.staffName.choices = getStaffFromFacultyAndStaff()

    # Retrieve staff info for display (except for system account)
    staffInfo = FacultyAndStaff.query.filter(
        FacultyAndStaff.lastName != "System"
    ).order_by(FacultyAndStaff.lastName.asc())

    # Retrieve current system mode
    SystemMode = getEmailModeStatus()

    if request.method == "POST":
        printLogEntry("form= " + str(request.form))
    if "submitAddStudent" in request.form:
        if addStudentFormDetails.validate_on_submit():
            printLogEntry("Add Student submitted")
            firstName = addStudentFormDetails.firstName.data
            lastName = addStudentFormDetails.lastName.data
            chattStateANumber = addStudentFormDetails.chattStateANumber.data
            email = addStudentFormDetails.email.data
            yearOfGraduation = int(addStudentFormDetails.yearOfGraduation.data)
            house = addStudentFormDetails.house.data
            googleCalendarId = addStudentFormDetails.googleCalendarId.data

            addStudentToDatabase(
                chattStateANumber,
                firstName,
                lastName,
                email,
                house,
                yearOfGraduation,
                googleCalendarId,
            )
            return redirect(url_for("p2mtAdmin_bp.displayP2MTAdmin"))
    printFormErrors(addStudentFormDetails)

    if "submitStudentToEdit" in request.form:
        if selectStudentToEditFormDetails.validate_on_submit:
            printLogEntry("Student to Edit Form Submitted")
            student_id = int(selectStudentToEditFormDetails.studentName.data)
            print("student_id = ", student_id)
            return redirect(
                url_for("p2mtAdmin_bp.updateStudent", student_id=student_id)
            )
    printFormErrors(selectStudentToEditFormDetails)

    if "submitDownloadStudentListForm" in request.form:
        if downloadStudentListFormDetails.validate_on_submit():
            printLogEntry("Download Student List Form Submitted")
            return downloadStudentList()

    if "submitUploadStudentList" in request.form:
        if uploadStudentListFormDetails.validate_on_submit():
            printLogEntry("Upload Student List Form Submitted")
            if uploadStudentListFormDetails.csvStudentListFile.data:
                uploadedStudentListFile = save_File(
                    uploadStudentListFormDetails.csvStudentListFile.data,
                    "Uploaded_StudentList_File.csv",
                )
                uploadStudentList(uploadedStudentListFile)
                return redirect(url_for("p2mtAdmin_bp.displayP2MTAdmin"))
    printFormErrors(uploadStudentListFormDetails)

    if "submitDeleteStudent" in request.form:
        if deleteStudentFormDetails.validate_on_submit():
            if deleteStudentFormDetails.confirmDeleteStudent.data == "DELETE":
                printLogEntry("Delete Student Form Submitted")
                # studentName returns chattStateANumber as its value
                chattStateANumber = deleteStudentFormDetails.studentName.data
                print("chattStateANumber =", chattStateANumber)
                deleteStudent(chattStateANumber)
                deleteStudentFormDetails.confirmDeleteStudent.data = ""
                # deleteClassScheduleFormDetails.process()
                return redirect(url_for("p2mtAdmin_bp.displayP2MTAdmin"))
            else:
                deleteStudentFormDetails.confirmDeleteStudent.data = ""
                printLogEntry("Type DELETE in the text box to confirm delete")
    printFormErrors(deleteStudentFormDetails)

    if "submitParentsToEdit" in request.form:
        if selectParentsToEditFormDetails.validate_on_submit:
            printLogEntry("Parents to Edit Form Submitted")
            chattStateANumber = selectParentsToEditFormDetails.studentName.data
            print("chattStateANumber = ", chattStateANumber)
            return redirect(
                url_for(
                    "p2mtAdmin_bp.updateParents", chattStateANumber=chattStateANumber
                )
            )
    printFormErrors(selectParentsToEditFormDetails)

    if "submitDownloadParentsListForm" in request.form:
        if downloadParentsListFormDetails.validate_on_submit():
            printLogEntry("Download Parent List Form Submitted")
            return downloadParentsList()

    if "submitUploadParentsList" in request.form:
        if uploadParentsListFormDetails.validate_on_submit():
            printLogEntry("Upload Parents List Form Submitted")
            if uploadParentsListFormDetails.csvParentsListFile.data:
                uploadedParentsListFile = save_File(
                    uploadParentsListFormDetails.csvParentsListFile.data,
                    "Uploaded_ParentsList_File.csv",
                )
                uploadParentsList(uploadedParentsListFile)
                return redirect(url_for("p2mtAdmin_bp.displayP2MTAdmin"))
    printFormErrors(uploadParentsListFormDetails)

    if "submitAddStaff" in request.form:
        if addStaffFormDetails.validate_on_submit():
            printLogEntry("Add Staff submitted")
            firstName = addStaffFormDetails.firstName.data
            lastName = addStaffFormDetails.lastName.data
            position = addStaffFormDetails.position.data
            email = addStaffFormDetails.email.data
            phoneNumber = addStaffFormDetails.phoneNumber.data
            chattStateANumber = addStaffFormDetails.chattStateANumber.data
            myersBriggs = addStaffFormDetails.myersBriggs.data
            house = addStaffFormDetails.house.data
            houseGrade = addStaffFormDetails.houseGrade.data
            twitterAccount = addStaffFormDetails.twitterAccount.data

            addStaffToDatabase(
                firstName,
                lastName,
                position,
                email,
                phoneNumber,
                chattStateANumber,
                myersBriggs,
                house,
                houseGrade,
                twitterAccount,
            )
            return redirect(url_for("p2mtAdmin_bp.displayP2MTAdmin"))
    printFormErrors(addStaffFormDetails)

    if "submitDownloadStaffListForm" in request.form:
        if downloadStaffListFormDetails.validate_on_submit():
            printLogEntry("Download Staff List Form Submitted")
            return downloadStaffList()

    if "submitStaffToEdit" in request.form:
        if selectStaffToEditFormDetails.validate_on_submit():
            printLogEntry("Staff to Edit Form Submitted")
            staff_id = int(selectStaffToEditFormDetails.staffName.data)
            print("staff_id = ", staff_id)
            return redirect(url_for("p2mtAdmin_bp.updateStaff", staff_id=staff_id))
    printFormErrors(selectStaffToEditFormDetails)

    if "submitUploadStaffList" in request.form:
        if uploadStaffListFormDetails.validate_on_submit():
            printLogEntry("Upload Staff List Form Submitted")
            if uploadStaffListFormDetails.csvStaffListFile.data:
                uploadedStaffListFile = save_File(
                    uploadStaffListFormDetails.csvStaffListFile.data,
                    "Uploaded_StaffList_File.csv",
                )
                uploadStaffList(uploadedStaffListFile)
                return redirect(url_for("p2mtAdmin_bp.displayP2MTAdmin"))
    printFormErrors(uploadStaffListFormDetails)

    if "submitDeleteStaff" in request.form:
        if deleteStaffFormDetails.validate_on_submit():
            if deleteStaffFormDetails.confirmDeleteStaff.data == "DELETE":
                printLogEntry("Delete Staff Form Submitted")
                # staffname returns log id as its value
                log_id = int(deleteStaffFormDetails.staffName.data)
                print("log_id =", log_id)
                deleteStaff(log_id)
                deleteStaffFormDetails.confirmDeleteStaff.data = ""
                # deleteClassScheduleFormDetails.process()
                return redirect(url_for("p2mtAdmin_bp.displayP2MTAdmin"))
            else:
                deleteStaffFormDetails.confirmDeleteStaff.data = ""
                printLogEntry("Type DELETE in the text box to confirm delete")
    printFormErrors(deleteStaffFormDetails)

    return render_template(
        "p2mtadmin.html",
        title="P2MT Admin",
        staffInfo=staffInfo,
        addStudentForm=addStudentFormDetails,
        selectStudentToEditForm=selectStudentToEditFormDetails,
        downloadStudentListForm=downloadStudentListFormDetails,
        uploadStudentListForm=uploadStudentListFormDetails,
        deleteStudentForm=deleteStudentFormDetails,
        selectParentsToEditForm=selectParentsToEditFormDetails,
        downloadParentsListForm=downloadParentsListFormDetails,
        uploadParentsListForm=uploadParentsListFormDetails,
        addStaffForm=addStaffFormDetails,
        selectStaffToEditForm=selectStaffToEditFormDetails,
        downloadStaffListForm=downloadStaffListFormDetails,
        uploadStaffListForm=uploadStaffListFormDetails,
        deleteStaffForm=deleteStaffFormDetails,
        SystemMode=SystemMode,
    )


@p2mtAdmin_bp.route("/p2mtadmin/setsystemmode", methods=["POST"])
@login_required
def setSystemMode():
    printLogEntry("Running setSystemMode()")
    if request.method == "POST":
        if request.form["submit_button"] == "Set to Test Mode":
            setEmailModeStatus(False)
            db.session.commit()
            print("Enable Live Email =", getEmailModeStatus())
        elif request.form["submit_button"] == "Set to Live Mode":
            setEmailModeStatus(True)
            db.session.commit()
            print("Enable Live Email =", getEmailModeStatus())
    return redirect(url_for("p2mtAdmin_bp.displayP2MTAdmin"))


@p2mtAdmin_bp.route("/p2mtadmin/<int:student_id>/update", methods=["GET", "POST"])
@login_required
def updateStudent(student_id):
    printLogEntry("Running updateStudent()")
    student = Student.query.get_or_404(student_id)
    updateStudentFormDetails = updateStudentForm()
    if "submitUpdateStudent" in request.form:
        if updateStudentFormDetails.validate_on_submit():
            student.firstName = updateStudentFormDetails.firstName.data
            student.lastName = updateStudentFormDetails.lastName.data
            student.email = updateStudentFormDetails.email.data
            student.chattStateANumber = updateStudentFormDetails.chattStateANumber.data
            student.yearOfGraduation = int(
                updateStudentFormDetails.yearOfGraduation.data
            )
            student.house = updateStudentFormDetails.house.data
            student.googleCalendarId = updateStudentFormDetails.googleCalendarId.data
            db.session.commit()
            studentUpdateString = (
                student.firstName
                + " "
                + student.lastName
                + " "
                + student.chattStateANumber
            )
            printLogEntry("Student info updated for " + studentUpdateString)
            flash("Student details for " + studentUpdateString + " updated!", "success")
            return redirect(url_for("p2mtAdmin_bp.displayP2MTAdmin"))
    elif request.method == "GET":
        updateStudentFormDetails.student_id.data = student.id
        updateStudentFormDetails.firstName.data = student.firstName
        updateStudentFormDetails.lastName.data = student.lastName
        updateStudentFormDetails.email.data = student.email
        updateStudentFormDetails.chattStateANumber.data = student.chattStateANumber
        updateStudentFormDetails.yearOfGraduation.data = student.yearOfGraduation
        updateStudentFormDetails.house.data = student.house
        updateStudentFormDetails.googleCalendarId.data = student.googleCalendarId
    return render_template(
        "updatestudent.html",
        title="Update Student",
        updateStudentForm=updateStudentFormDetails,
    )


@p2mtAdmin_bp.route(
    "/p2mtadmin/<string:chattStateANumber>/parentupdate", methods=["GET", "POST"]
)
@login_required
def updateParents(chattStateANumber):
    printLogEntry("Running updateParents()")
    parents = Parents.query.filter(
        Parents.chattStateANumber == chattStateANumber
    ).first()
    # If no parents found, create a blank parents record in the Parents table
    if parents is None:
        addParentsToDatabase(
            chattStateANumber,
            guardianship=None,
            motherName=None,
            motherEmail=None,
            motherHomePhone=None,
            motherDayPhone=None,
            fatherName=None,
            fatherEmail=None,
            fatherHomePhone=None,
            fatherDayPhone=None,
            guardianEmail=None,
            comment=None,
        )
        parents = Parents.query.filter(
            Parents.chattStateANumber == chattStateANumber
        ).first()
    studentName = getStudentName(chattStateANumber)
    updateParentsFormDetails = updateParentsForm()
    if "submitUpdateParents" in request.form:
        if updateParentsFormDetails.validate_on_submit():
            parents.guardianship = updateParentsFormDetails.guardianship.data
            parents.motherName = updateParentsFormDetails.motherName.data
            parents.motherEmail = updateParentsFormDetails.motherEmail.data
            parents.motherHomePhone = updateParentsFormDetails.motherHomePhone.data
            parents.motherDayPhone = updateParentsFormDetails.motherDayPhone.data
            parents.fatherName = updateParentsFormDetails.fatherName.data
            parents.fatherEmail = updateParentsFormDetails.fatherEmail.data
            parents.fatherHomePhone = updateParentsFormDetails.fatherHomePhone.data
            parents.fatherDayPhone = updateParentsFormDetails.fatherDayPhone.data
            parents.guardianEmail = updateParentsFormDetails.guardianEmail.data
            parents.comment = updateParentsFormDetails.comment.data
            db.session.commit()
            parentsUpdateString = (
                parents.chattStateANumber
                + " "
                + parents.motherName
                + " "
                + parents.fatherName
            )
            printLogEntry("Parent info updated for " + parentsUpdateString)
            flash("Parents details for " + parentsUpdateString + " updated!", "success")
            return redirect(url_for("p2mtAdmin_bp.displayP2MTAdmin"))
    elif request.method == "GET":
        updateParentsFormDetails.chattStateANumber.data = parents.chattStateANumber
        updateParentsFormDetails.guardianship.data = parents.guardianship
        updateParentsFormDetails.motherName.data = parents.motherName
        updateParentsFormDetails.motherEmail.data = parents.motherEmail
        updateParentsFormDetails.motherHomePhone.data = parents.motherHomePhone
        updateParentsFormDetails.motherDayPhone.data = parents.motherDayPhone
        updateParentsFormDetails.fatherName.data = parents.fatherName
        updateParentsFormDetails.fatherEmail.data = parents.fatherEmail
        updateParentsFormDetails.fatherHomePhone.data = parents.fatherHomePhone
        updateParentsFormDetails.fatherDayPhone.data = parents.fatherDayPhone
        updateParentsFormDetails.guardianEmail.data = parents.guardianEmail
        updateParentsFormDetails.comment.data = parents.comment
    return render_template(
        "updateparents.html",
        title="Update Parents",
        updateParentsForm=updateParentsFormDetails,
        studentName=studentName,
    )


@p2mtAdmin_bp.route("/p2mtadmin/<int:staff_id>/staffupdate", methods=["GET", "POST"])
@login_required
def updateStaff(staff_id):
    printLogEntry("Running updateStaff()")
    staff = FacultyAndStaff.query.get_or_404(staff_id)
    updateStaffFormDetails = updateStaffForm()
    if "submitUpdateStaff" in request.form:
        if updateStaffFormDetails.validate_on_submit():
            staff.firstName = updateStaffFormDetails.firstName.data
            staff.lastName = updateStaffFormDetails.lastName.data
            staff.email = updateStaffFormDetails.email.data
            staff.position = updateStaffFormDetails.position.data
            staff.chattStateANumber = setToNoneIfEmptyString(
                updateStaffFormDetails.chattStateANumber.data
            )
            staff.phoneNumber = setToNoneIfEmptyString(
                updateStaffFormDetails.phoneNumber.data
            )
            staff.house = setToNoneIfEmptyString(updateStaffFormDetails.house.data)
            staff.houseGrade = setToNoneIfEmptyString(
                updateStaffFormDetails.houseGrade.data
            )
            staff.myersBrigg = setToNoneIfEmptyString(
                updateStaffFormDetails.myersBriggs.data
            )
            staff.twitterAccount = setToNoneIfEmptyString(
                updateStaffFormDetails.twitterAccount.data
            )
            db.session.commit()
            staffUpdateString = staff.firstName + " " + staff.lastName
            printLogEntry("Staff info updated for " + staffUpdateString)
            flash("Staff details for " + staffUpdateString + " updated!", "success")
            return redirect(url_for("p2mtAdmin_bp.displayP2MTAdmin"))
    elif request.method == "GET":
        updateStaffFormDetails.staff_id.data = staff.id
        updateStaffFormDetails.firstName.data = staff.firstName
        updateStaffFormDetails.lastName.data = staff.lastName
        updateStaffFormDetails.position.data = staff.position
        updateStaffFormDetails.email.data = staff.email
        updateStaffFormDetails.chattStateANumber.data = staff.chattStateANumber
        updateStaffFormDetails.phoneNumber.data = staff.phoneNumber
        updateStaffFormDetails.house.data = staff.house
        updateStaffFormDetails.houseGrade.data = str(staff.houseGrade)
        updateStaffFormDetails.myersBriggs.data = staff.myersBrigg
        updateStaffFormDetails.twitterAccount.data = staff.twitterAccount
    return render_template(
        "updatestaff.html",
        title="Update Staff Member",
        updateStaffForm=updateStaffFormDetails,
    )
