from flask_wtf import FlaskForm
from wtforms import SubmitField, StringField, SelectField, TextAreaField
from wtforms.fields.html5 import DateField
from wtforms.validators import DataRequired


class addInterventionLogForm(FlaskForm):
    studentID = StringField("Student ID")
    chattStateANumber = StringField("Chatt State A Number")
    interventionType = SelectField(
        "Intervention Type", coerce=int, validators=[DataRequired()]
    )
    interventionLevel = SelectField(
        "Intervention Level",
        coerce=int,
        choices=[(1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 6)],
        validators=[DataRequired()],
    )
    startDate = DateField("Start Date", validators=[DataRequired()])
    endDate = DateField("End Date", validators=[DataRequired()])
    comment = TextAreaField("Comment")
    submitIntervention = SubmitField("Submit New Intervention")
