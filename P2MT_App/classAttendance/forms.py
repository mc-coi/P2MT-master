from flask_wtf import FlaskForm
from wtforms import (
    StringField,
    SelectField,
    RadioField,
    FormField,
    FieldList,
    HiddenField,
    BooleanField,
)
from wtforms.fields.html5 import DateField
from wtforms.validators import Optional


class updateStudentAttendanceForm(FlaskForm):
    # identifier = StringField()
    log_id = HiddenField()
    attendanceCode = RadioField(
        "Attendance Code",
        choices=[("P", "P"), ("T", "T"), ("E", "E"), ("U", "U"), ("Q", "?"),],
        validators=[Optional()],
    )
    comment = StringField("Comment")
    assignTmi = BooleanField()
    # className = HiddenField()
    # teacherName = HiddenField()
    # classDate = HiddenField()
    updateFlag = HiddenField()


class updateClassAttendanceForm(FlaskForm):
    # identifier = StringField()
    classMembers = FieldList(FormField(updateStudentAttendanceForm))
    teacherName = SelectField("Teacher", coerce=str)
    className = SelectField("Class", coerce=str)
    classDate = DateField("Class Date")
    updateFiltersFlag = HiddenField()
