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
from P2MT_App.classAttendance.forms import updateStudentAttendanceForm


class updateTmiTeacherReviewForm(FlaskForm):
    classMembers = FieldList(FormField(updateStudentAttendanceForm))
    teacherName = SelectField("Teacher", coerce=str)
    updateFiltersFlag = HiddenField()
