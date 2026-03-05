from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileAllowed, FileRequired
from wtforms import (
    HiddenField,
    SubmitField,
    StringField,
    SelectField,
    TimeField,
    BooleanField,
    SelectMultipleField,
    widgets,
)
from wtforms.fields.html5 import DateField
from wtforms.validators import DataRequired


class MultiCheckboxField(SelectMultipleField):
    """
    A multiple-select, except displays a list of checkboxes.

    Iterating the field will produce subfields, allowing custom rendering of
    the enclosed checkbox fields.
    """

    widget = widgets.ListWidget(prefix_label=False)
    option_widget = widgets.CheckboxInput()


class selectSingleClassScheduleToEditForm(FlaskForm):
    logId = HiddenField("log_id")
    submitSingleClassScheduleToEdit = SubmitField("Edit")


class editSingleClassSchedule(FlaskForm):
    log_id = HiddenField()
    schoolYear = SelectField("Year", coerce=int, validators=[DataRequired()])
    semester = SelectField("Semester", validators=[DataRequired()])
    # studentName = SelectField("Student Name", validators=[DataRequired()])
    campus = SelectField("Campus", validators=[DataRequired()])
    className = SelectField("Class Name", validators=[DataRequired()])
    teacherName = SelectField("Teacher", coerce=str)
    classDays = MultiCheckboxField("Class Days", validators=[DataRequired()])
    startTime = TimeField(
        "Start Time",
        validators=[DataRequired()],
        render_kw={"placeholder": "HH:MM 24-Hour Format"},
    )
    endTime = TimeField(
        "End Time",
        validators=[DataRequired()],
        render_kw={"placeholder": "HH:MM 24-Hour Format"},
    )
    online = BooleanField("Online")
    indStudy = BooleanField("Independent Study")
    comment = StringField("Comment (Optional)")
    googleCalendarEventID = StringField("Google Calendar Event ID (Optional)")
    submitEditSingleClassSchedule = SubmitField(
        "Update Class Schedule for Single Student"
    )
