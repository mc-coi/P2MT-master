from flask_wtf import FlaskForm
from wtforms import (
    SubmitField,
    StringField,
    SelectField,
    TimeField,
    BooleanField,
    SelectMultipleField,
    widgets,
)
from wtforms.fields.html5 import DateField
from wtforms.validators import DataRequired, Optional
from P2MT_App.main.referenceData import getStartTimeChoices, getEndTimeChoices


class MultiCheckboxField(SelectMultipleField):
    """
    A multiple-select, except displays a list of checkboxes.

    Iterating the field will produce subfields, allowing custom rendering of
    the enclosed checkbox fields.
    """

    widget = widgets.ListWidget(prefix_label=False)
    option_widget = widgets.CheckboxInput()


class addLearningLabToSchedule(FlaskForm):
    schoolYear = SelectField("Year", coerce=int, validators=[DataRequired()])
    semester = SelectField("Semester", validators=[DataRequired()])
    studentName = SelectField("Student Name", validators=[DataRequired()])
    campus = SelectField("Campus", validators=[DataRequired()])
    className = SelectField("Class Name", validators=[DataRequired()])
    teacherName = SelectField("Teacher", coerce=str, validators=[DataRequired()])

    addTimeAndDays = BooleanField("Add", default=True)
    classDays = MultiCheckboxField("Class Days")
    startTime = SelectField(
        "Start Time", validators=[Optional()], choices=getStartTimeChoices()
    )
    endTime = SelectField(
        "End Time", validators=[Optional()], choices=getEndTimeChoices()
    )
    # startTime = TimeField(
    #     "Start Time",
    #     validators=[DataRequired()],
    #     render_kw={"placeholder": "HH:MM 24-Hour Format"},
    # )
    # endTime = TimeField(
    #     "End Time",
    #     validators=[DataRequired()],
    #     render_kw={"placeholder": "HH:MM 24-Hour Format"},
    # )

    addTimeAndDays2 = BooleanField("Add", default=True)
    classDays2 = MultiCheckboxField("Class Days")
    startTime2 = SelectField(
        "Start Time", validators=[Optional()], choices=getStartTimeChoices()
    )
    endTime2 = SelectField(
        "End Time", validators=[Optional()], choices=getEndTimeChoices()
    )
    # startTime2 = TimeField(
    #     "Start Time",
    #     validators=[Optional()],
    #     render_kw={"placeholder": "HH:MM 24-Hour Format"},
    # )
    # endTime2 = TimeField(
    #     "End Time",
    #     validators=[Optional()],
    #     render_kw={"placeholder": "HH:MM 24-Hour Format"},
    # )

    addTimeAndDays3 = BooleanField("Add", default=True)
    classDays3 = MultiCheckboxField("Class Days")
    startTime3 = SelectField(
        "Start Time", validators=[Optional()], choices=getStartTimeChoices()
    )
    endTime3 = SelectField(
        "End Time", validators=[Optional()], choices=getEndTimeChoices()
    )
    # startTime3 = TimeField(
    #     "Start Time",
    #     validators=[Optional()],
    #     render_kw={"placeholder": "HH:MM 24-Hour Format"},
    # )
    # endTime3 = TimeField(
    #     "End Time",
    #     validators=[Optional()],
    #     render_kw={"placeholder": "HH:MM 24-Hour Format"},
    # )

    addTimeAndDays4 = BooleanField("Add", default=True)
    classDays4 = MultiCheckboxField("Class Days")
    startTime4 = SelectField(
        "Start Time", validators=[Optional()], choices=getStartTimeChoices()
    )
    endTime4 = SelectField(
        "End Time", validators=[Optional()], choices=getEndTimeChoices()
    )
    # startTime4 = TimeField(
    #     "Start Time",
    #     validators=[Optional()],
    #     render_kw={"placeholder": "HH:MM 24-Hour Format"},
    # )
    # endTime4 = TimeField(
    #     "End Time",
    #     validators=[Optional()],
    #     render_kw={"placeholder": "HH:MM 24-Hour Format"},
    # )

    addTimeAndDays5 = BooleanField("Add", default=True)
    classDays5 = MultiCheckboxField("Class Days")
    startTime5 = SelectField(
        "Start Time", validators=[Optional()], choices=getStartTimeChoices()
    )
    endTime5 = SelectField(
        "End Time", validators=[Optional()], choices=getEndTimeChoices()
    )
    # startTime5 = TimeField(
    #     "Start Time",
    #     validators=[Optional()],
    #     render_kw={"placeholder": "HH:MM 24-Hour Format"},
    # )
    # endTime5 = TimeField(
    #     "End Time",
    #     validators=[Optional()],
    #     render_kw={"placeholder": "HH:MM 24-Hour Format"},
    # )

    online = BooleanField("Online")
    indStudy = BooleanField("Independent Study")
    comment = StringField("Comment (Optional)")
    googleCalendarEventID = StringField("Google Calendar Event ID (Optional)")
    # Start and end dates used for learning lab and recorded in intervention log
    startDate = DateField("Start Date")
    endDate = DateField("End Date")
    submitAddSingleClassSchedule = SubmitField("Add Class Schedule for Single Student")
