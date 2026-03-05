from flask_wtf import FlaskForm
from wtforms import SubmitField, BooleanField, HiddenField, FieldList, FormField
from wtforms.fields.html5 import DateField
from wtforms.validators import DataRequired


class updateSchoolCalendarFieldListForm(FlaskForm):
    log_id = HiddenField()
    classDate = DateField("Calendar Date")
    stemSchoolDay = BooleanField("STEM School Day")
    phaseIISchoolDay = BooleanField("Phase II Day")
    chattStateSchoolDay = BooleanField("Chatt State School Day")
    seniorErDay = BooleanField("Senior ER Day")
    juniorErDay = BooleanField("Junior ER Day")
    seniorUpDay = BooleanField("Senior UP Day")
    juniorUpDay = BooleanField("Junior UP Day")
    startTmiPeriod = BooleanField("Start TMI Period")
    tmiDay = BooleanField("TMI Day")
    updateFlag = HiddenField()


class updateSchoolCalendarContainerForm(FlaskForm):
    schoolCalendarDays = FieldList(FormField(updateSchoolCalendarFieldListForm))
    calendarDate = DateField("Calendar Date")
    startCalendarDate = DateField("Start Date")
    endCalendarDate = DateField("End Date")
    # updateFiltersFlag = HiddenField()
