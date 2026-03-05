from flask_wtf import FlaskForm
from wtforms import SubmitField, StringField, SelectField, TextAreaField
from wtforms.fields.html5 import DateField
from wtforms.validators import DataRequired, Optional


class addDailyAttendanceForm(FlaskForm):
    studentID = StringField("Student ID")
    chattStateANumber = StringField("Chatt State A Number")
    attendanceCode = SelectField(
        "Attendance Code",
        choices=[
            ("DL (Distance Learning)", "DL (Distance Learner)"),
            ("Missed Swipe", "Missed Swipe"),
            ("W/D Use Only", "W/D Use Only"),
            ("P (Present)", "P (Present)"),
            ("UNX (Unexcused)", "UNX (Unexcused)"),
            ("EXC (Excused)", "EXC (Excused)"),
            ("UTY (Unexcused Tardy)", "UTY (Unexcused Tardy)"),
            ("TDY (Tardy)", "TDY (Tardy)"),
            ("ACT (Activity)", "ACT (Activity)"),
            ("ALT (Alt_Remanded)", "ALT (Alt_Remanded)"),
            ("DTH (Death in Family)", "DTH (Death in Family)"),
            ("CRT (Court)", "CRT (Court)"),
            ("EVS (Evening School)", "EVS (Evening School)"),
            ("FLU (Flu)", "FLU (Flu)"),
            ("HBD (Homebound)", "HBD (Homebound)"),
            ("ISS (In-School Suspension)", "ISS (In-School Suspension)"),
            ("MED (Medical)", "MED (Medical)"),
            ("PEX (Parent Excuse)", "PEX (Parent Excuse)"),
            ("REL (Religious)", "REL (Religious)"),
            ("SUS (Suspended)", "SUS (Suspended)"),
            ("TNT (Unexcused Trans)", "TNT (Unexcused Trans)"),
            ("TXT (Excused Trans)", "TXT (Excused Trans)"),
            ("Z (Expelled)", "Z (Expelled)"),
        ],
        validators=[DataRequired()],
    )
    absenceDateStart = DateField("Absence Date Start", validators=[DataRequired()])
    absenceDateEnd = DateField("Absence Date End (Optional)", validators=[Optional()])
    comment = TextAreaField("Comment")
    submitDailyAttendance = SubmitField("Submit New Daily Attendance")
