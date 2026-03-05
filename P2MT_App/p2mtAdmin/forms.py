from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileAllowed, FileRequired
from wtforms import SubmitField, StringField, SelectField, HiddenField
from wtforms.fields.html5 import DateField, EmailField
from wtforms.validators import DataRequired
from P2MT_App.main.referenceData import getHouseNames, getGradeLevels


# ###################
#    Student Info   #
# ###################


class addStudentForm(FlaskForm):
    firstName = StringField("First Name", validators=[DataRequired()])
    lastName = StringField("Last Name", validators=[DataRequired()])
    email = EmailField("Email", validators=[DataRequired()])
    chattStateANumber = StringField("Chatt State A Number", validators=[DataRequired()])
    yearOfGraduation = StringField(
        "Year of Graduation (YYYY)", validators=[DataRequired()]
    )
    house = SelectField("House", validators=[DataRequired()], choices=getHouseNames())
    googleCalendarId = StringField(
        "Google Calendar ID (Use TBD if unknown)", validators=[DataRequired()]
    )
    submitAddStudent = SubmitField("Add Student")


class selectStudentToEditForm(FlaskForm):
    studentName = SelectField("Student Name", validators=[DataRequired()])
    submitStudentToEdit = SubmitField("Edit Student")


class updateStudentForm(FlaskForm):
    student_id = HiddenField()
    firstName = StringField("First Name", validators=[DataRequired()])
    lastName = StringField("Last Name", validators=[DataRequired()])
    email = EmailField("Email", validators=[DataRequired()])
    chattStateANumber = StringField("Chatt State A Number", validators=[DataRequired()])
    yearOfGraduation = StringField(
        "Year of Graduation (YYYY)", validators=[DataRequired()]
    )
    house = SelectField("House", validators=[DataRequired()], choices=getHouseNames())
    googleCalendarId = StringField(
        "Google Calendar ID (Use TBD if unknown)", validators=[DataRequired()]
    )
    submitUpdateStudent = SubmitField("Update Student Info")


class downloadStudentListForm(FlaskForm):
    submitDownloadStudentListForm = SubmitField("Download Student List")


class uploadStudentListForm(FlaskForm):
    csvStudentListFile = FileField(
        "Student List (*.csv format)",
        validators=[FileAllowed(["csv"]), FileRequired()],
    )
    submitUploadStudentList = SubmitField("Upload Student List")


class deleteStudentForm(FlaskForm):
    studentName = SelectField("Student Name", validators=[DataRequired()])
    confirmDeleteStudent = StringField(
        "Type DELETE to confirm", validators=[DataRequired()]
    )
    submitDeleteStudent = SubmitField("Delete Student")


# #################
#   Parents Info  #
# #################
class uploadParentsListForm(FlaskForm):
    csvParentsListFile = FileField(
        "Parents List (*.csv format)",
        validators=[FileAllowed(["csv"]), FileRequired()],
    )
    submitUploadParentsList = SubmitField("Upload Parents List")


class selectParentsToEditForm(FlaskForm):
    studentName = SelectField("Student Name", validators=[DataRequired()])
    submitParentsToEdit = SubmitField("Edit Parents")


class updateParentsForm(FlaskForm):
    chattStateANumber = HiddenField()
    guardianship = StringField(
        "Guardianship (e.g., Both Parents, Mother, Father, Grandmother)"
    )
    motherName = StringField("Mother's Name (last, first)")
    motherEmail = StringField("Mother's Email (separate by commas if more than one)")
    motherHomePhone = StringField("Mother's Home Phone")
    motherDayPhone = StringField("Mother's Day Phone")
    fatherName = StringField("Father's Name (last, first")
    fatherEmail = StringField("Father's Email (separate by commas if more than one)")
    fatherHomePhone = StringField("Father's Home Phone")
    fatherDayPhone = StringField("Father's Day Phone")
    guardianEmail = StringField("Guardian Email (separate by commas if more than one)")
    comment = StringField("Comments (Optional)")
    submitUpdateParents = SubmitField("Update Parents Info")


class downloadParentsListForm(FlaskForm):
    submitDownloadParentsListForm = SubmitField("Download Parents List")


# #################
#   Staff Info    #
# #################


class addStaffForm(FlaskForm):
    firstName = StringField("First Name", validators=[DataRequired()])
    lastName = StringField("Last Name", validators=[DataRequired()])
    position = StringField("Position", validators=[DataRequired()])
    email = EmailField("Email", validators=[DataRequired()])
    phoneNumber = StringField("Phone Number (Optional)")
    chattStateANumber = StringField("Chatt State A Number (Optional)")
    myersBriggs = StringField("Myers Briggs Personality Type (Optional)")
    house = SelectField("House (Optional)", choices=getHouseNames())
    houseGrade = SelectField(
        "House Grade (for House Teachers) (Optional)", choices=getGradeLevels(),
    )
    twitterAccount = StringField(
        "Twitter Account (Optional)", render_kw={"placeholder": "@"}
    )
    submitAddStaff = SubmitField("Add Staff")


class selectStaffToEditForm(FlaskForm):
    staffName = SelectField("Staff Member Name", validators=[DataRequired()])
    submitStaffToEdit = SubmitField("Edit Staff Member")


class updateStaffForm(FlaskForm):
    staff_id = HiddenField()
    firstName = StringField("First Name", validators=[DataRequired()])
    lastName = StringField("Last Name", validators=[DataRequired()])
    position = StringField("Position", validators=[DataRequired()])
    email = EmailField("Email", validators=[DataRequired()])
    phoneNumber = StringField("Phone Number (Optional)")
    chattStateANumber = StringField("Chatt State A Number (Optional)")
    myersBriggs = StringField("Myers Briggs Personality Type (Optional)")
    house = SelectField("House (Optional)", choices=getHouseNames())
    houseGrade = SelectField(
        "House Grade (for House Teachers) (Optional)", choices=getGradeLevels(),
    )
    twitterAccount = StringField(
        "Twitter Account (Optional)", render_kw={"placeholder": "@"}
    )
    submitUpdateStaff = SubmitField("Update Staff Member Info")


class downloadStaffListForm(FlaskForm):
    submitDownloadStaffListForm = SubmitField("Download Staff List")


class uploadStaffListForm(FlaskForm):
    csvStaffListFile = FileField(
        "Staff List (*.csv format)", validators=[FileAllowed(["csv"]), FileRequired()],
    )
    submitUploadStaffList = SubmitField("Upload Staff List")


class deleteStaffForm(FlaskForm):
    staffName = SelectField("Staff Name", coerce=int, validators=[DataRequired()])
    confirmDeleteStaff = StringField(
        "Type DELETE to confirm", validators=[DataRequired()]
    )
    submitDeleteStaff = SubmitField("Delete Staff Member")
