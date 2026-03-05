from P2MT_App import db, login_manager
from datetime import datetime
from flask_login import UserMixin

# Flask-Login helper to retrieve a user from our db
@login_manager.user_loader
def load_user(user_id):
    user = FacultyAndStaff.query.filter(FacultyAndStaff.id == user_id).first()
    print(
        f"Running load_user() with user id: {user_id}, name: {user.firstName} {user.lastName}"
    )
    return user


class Student(db.Model):
    __tablename__ = "Student"
    id = db.Column(db.Integer, primary_key=True)
    chattStateANumber = db.Column(db.String(20), unique=True, nullable=False)
    firstName = db.Column(db.String(50), nullable=False)
    lastName = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    yearOfGraduation = db.Column(db.Integer, nullable=False)
    house = db.Column(db.String(20), nullable=False)
    googleCalendarId = db.Column(db.String(100), nullable=True)
    classSchedule = db.relationship(
        "ClassSchedule", backref="Student", passive_deletes=True, lazy=True,
    )
    dailyAttendance = db.relationship(
        "DailyAttendanceLog", backref="Student", passive_deletes=True, lazy=True,
    )
    interventionLog = db.relationship(
        "InterventionLog", backref="Student", passive_deletes=True, lazy=True,
    )
    parentInfo = db.relationship(
        "Parents", backref="Student", passive_deletes=True, lazy=True,
    )
    pblTeams = db.relationship(
        "PblTeams", backref="Student", passive_deletes=True, lazy=True,
    )

    def __repr__(self):
        return (
            f"Students('{self.chattStateANumber}','{self.firstName}','{self.lastName}')"
        )


class Parents(db.Model):
    __tablename__ = "Parents"
    id = db.Column(db.Integer, primary_key=True)
    chattStateANumber = db.Column(
        db.String(20),
        db.ForeignKey("Student.chattStateANumber", ondelete="CASCADE"),
        nullable=False,
    )
    guardianship = db.Column(db.String(50), nullable=True)
    motherName = db.Column(db.String(50), nullable=True)
    motherEmail = db.Column(db.String(50), nullable=True)
    motherHomePhone = db.Column(db.String(50), nullable=True)
    motherDayPhone = db.Column(db.String(50), nullable=True)
    fatherName = db.Column(db.String(50), nullable=True)
    fatherEmail = db.Column(db.String(50), nullable=True)
    fatherHomePhone = db.Column(db.String(50), nullable=True)
    fatherDayPhone = db.Column(db.String(50), nullable=True)
    guardianEmail = db.Column(db.String(50), nullable=True)
    comment = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return f"Parents('{self.chattStateANumber}','{self.guardianship}','{self.motherName}','{self.fatherName}')"


class ClassSchedule(db.Model):
    __tablename__ = "ClassSchedule"
    id = db.Column(db.Integer, primary_key=True)
    schoolYear = db.Column(db.Integer, nullable=False)
    semester = db.Column(db.String(20), nullable=False)
    chattStateANumber = db.Column(
        db.String(20),
        db.ForeignKey("Student.chattStateANumber", ondelete="CASCADE"),
        nullable=False,
    )
    campus = db.Column(db.String(50), nullable=False)
    className = db.Column(db.String(50), nullable=False)
    teacherLastName = db.Column(db.String(50), nullable=False)
    staffID = db.Column(db.Integer, db.ForeignKey("FacultyAndStaff.id"), nullable=True)
    online = db.Column(db.Boolean, nullable=False, default=False)
    indStudy = db.Column(db.Boolean, nullable=False, default=False)
    classDays = db.Column(db.String(10), nullable=False)
    startTime = db.Column(db.Time, nullable=True)
    endTime = db.Column(db.Time, nullable=True)
    comment = db.Column(db.String(250), nullable=True)
    googleCalendarEventID = db.Column(db.String(250), nullable=True)
    interventionLog_id = db.Column(
        db.Integer,
        db.ForeignKey("InterventionLog.id", ondelete="CASCADE"),
        nullable=True,
    )
    learningLab = db.Column(db.Boolean, nullable=False, default=False)
    ClassAttendanceLog = db.relationship(
        "ClassAttendanceLog", backref="ClassSchedule", passive_deletes=True, lazy=True,
    )

    def __repr__(self):
        return f"ClassSchedule('{self.className}','{self.startTime}','{self.endTime}','{self.classDays}')"


class ClassAttendanceLog(db.Model):
    __tablename__ = "ClassAttendanceLog"
    id = db.Column(db.Integer, primary_key=True)
    classSchedule_id = db.Column(
        db.Integer,
        db.ForeignKey("ClassSchedule.id", ondelete="CASCADE"),
        nullable=False,
    )
    # classDate = db.Column(db.DateTime, nullable=False)
    classDate = db.Column(db.Date, nullable=False)
    attendanceCode = db.Column(db.String(2), nullable=True)
    comment = db.Column(db.Text, nullable=True)
    assignTmi = db.Column(db.Boolean, nullable=False, default=False)
    interventionLog_id = db.Column(
        db.Integer, db.ForeignKey("InterventionLog.id"), nullable=True,
    )

    def __repr__(self):
        return f"ClassAttendanceLog('{self.id}','{self.classSchedule_id}','{self.classDate}','{self.attendanceCode}','{self.assignTmi}')"


class DailyAttendanceLog(db.Model):
    __tablename__ = "DailyAttendanceLog"
    id = db.Column(db.Integer, primary_key=True)
    chattStateANumber = db.Column(
        db.String(20),
        db.ForeignKey("Student.chattStateANumber", ondelete="CASCADE"),
        nullable=False,
    )
    absenceDate = db.Column(db.Date, nullable=False)
    createDate = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    attendanceCode = db.Column(db.String(50), nullable=False, default="P")
    comment = db.Column(db.Text, nullable=False)
    staffID = db.Column(db.Integer, db.ForeignKey("FacultyAndStaff.id"), nullable=False)
    assignTmi = db.Column(db.Boolean, nullable=False, default=False)

    def __repr__(self):
        return f"DailyAttendanceLog('{self.absenceDate}','{self.attendanceCode}','{self.comment}')"


class InterventionType(db.Model):
    __tablename__ = "InterventionType"
    id = db.Column(db.Integer, primary_key=True)
    interventionType = db.Column(db.String(30), nullable=False)
    maxLevel = db.Column(db.Integer, nullable=False)
    interventionLog = db.relationship(
        "InterventionLog", backref="InterventionType", lazy=True
    )
    p2mtTemplates = db.relationship(
        "p2mtTemplates", backref="InterventionType", lazy=True
    )

    def __repr__(self):
        return (
            f"InterventionType('{self.id}','{self.interventionType}','{self.maxLevel}')"
        )


class InterventionLog(db.Model):
    __tablename__ = "InterventionLog"
    id = db.Column(db.Integer, primary_key=True)
    chattStateANumber = db.Column(
        db.String(20),
        db.ForeignKey("Student.chattStateANumber", ondelete="CASCADE"),
        nullable=False,
    )
    intervention_id = db.Column(
        db.Integer, db.ForeignKey("InterventionType.id"), nullable=False
    )
    interventionLevel = db.Column(db.Integer, nullable=False)
    createDate = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    startDate = db.Column(db.Date, nullable=False)
    endDate = db.Column(db.Date, nullable=False)
    staffID = db.Column(db.Integer, db.ForeignKey("FacultyAndStaff.id"), nullable=False)
    comment = db.Column(db.Text, nullable=True)
    tmiMinutes = db.Column(db.Integer, nullable=True)
    tmiMinutesServed = db.Column(db.Integer, nullable=True)
    tmiMinutesRemaining = db.Column(db.Integer, nullable=True)
    inTmiNow = db.Column(db.Boolean, nullable=True, default=False)
    # learningLabClass_id = db.Column(db.Integer, db.ForeignKey("Classes.id"), nullable=False)
    erSession = db.Column(db.String(50), nullable=True)
    erSession = db.Column(db.String(50), nullable=True)
    interventionStatus = db.Column(db.String(50), nullable=True)
    studentNotification = db.Column(db.DateTime, nullable=True)
    parentNotification = db.Column(db.DateTime, nullable=True)
    classAttendanceLog_id = db.relationship(
        "ClassAttendanceLog", backref="InterventionLog", lazy=True
    )
    classSchedule_id = db.relationship(
        "ClassSchedule", backref="InterventionLog", passive_deletes=True, lazy=True
    )

    def __repr__(self):
        return f"InterventionLog('{self.id}','{self.intervention_id}','{self.startDate}','{self.endDate}')"


class FacultyAndStaff(db.Model, UserMixin):
    __tablename__ = "FacultyAndStaff"
    id = db.Column(db.Integer, primary_key=True)
    firstName = db.Column(db.String(50), nullable=False)
    lastName = db.Column(db.String(50), nullable=False)
    position = db.Column(db.String(50), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    phoneNumber = db.Column(db.String(20), nullable=True)
    chattStateANumber = db.Column(db.String(20), nullable=True)
    myersBrigg = db.Column(db.Integer, nullable=True)
    house = db.Column(db.String(20), nullable=True)
    houseGrade = db.Column(db.Integer, nullable=True)
    twitterAccount = db.Column(db.String(50), nullable=True)
    status = db.Column(db.String(20), nullable=True)
    DailyAttendanceLog = db.relationship(
        "DailyAttendanceLog", backref="FacultyAndStaff", lazy=True
    )
    InterventionLog = db.relationship(
        "InterventionLog", backref="FacultyAndStaff", lazy=True
    )
    ClassSchedule = db.relationship(
        "ClassSchedule", backref="FacultyAndStaff", lazy=True
    )
    SurveyResponse = db.relationship(
        "SurveyResponse", backref="FacultyAndStaff", lazy=True
    )
    google_sub = db.Column(db.String(256), nullable=True)
    google_picture = db.Column(db.String(256), nullable=True)

    def __repr__(self):
        return (
            f"FacultyAndStaff('{self.firstName}','{self.lastName}','{self.position}')"
        )


class SchoolCalendar(db.Model):
    __tablename__ = "SchoolCalendar"
    id = db.Column(db.Integer, primary_key=True)
    classDate = db.Column(db.Date, nullable=False)
    day = db.Column(db.String(1), nullable=False)
    dayNumber = db.Column(db.Integer, nullable=False)
    stemSchoolDay = db.Column(db.Boolean, nullable=True)
    phaseIISchoolDay = db.Column(db.Boolean, nullable=True)
    chattStateSchoolDay = db.Column(db.Boolean, nullable=True)
    seniorErDay = db.Column(db.Boolean, nullable=True)
    seniorUpDay = db.Column(db.Boolean, nullable=True)
    juniorErDay = db.Column(db.Boolean, nullable=True)
    juniorUpDay = db.Column(db.Boolean, nullable=True)
    startTmiPeriod = db.Column(db.Boolean, nullable=True)
    tmiDay = db.Column(db.Boolean, nullable=True)


class p2mtTemplates(db.Model):
    __tablename__ = "p2mtTemplates"
    id = db.Column(db.Integer, primary_key=True)
    templateTitle = db.Column(db.String(255), nullable=True)
    emailSubject = db.Column(db.String(255), nullable=True)
    templateContent = db.Column(db.Text, nullable=True)
    sendToStudent = db.Column(db.Boolean, nullable=True)
    sendToParent = db.Column(db.Boolean, nullable=True)
    sendToTeacher = db.Column(db.Boolean, nullable=True)
    intervention_id = db.Column(
        db.Integer, db.ForeignKey("InterventionType.id"), nullable=True
    )
    interventionLevel = db.Column(db.Integer, nullable=True)


class adminSettings(db.Model):
    __tablename__ = "adminSettings"
    id = db.Column(db.Integer, primary_key=True)
    enableLiveEmail = db.Column(db.Boolean, nullable=False, default=False)
    timestamp = db.Column(db.TIMESTAMP, nullable=False, default=datetime.now())


class apiKeys(db.Model):
    __tablename__ = "apiKeys"
    id = db.Column(db.Integer, primary_key=True)
    apiKey = db.Column(db.Text, nullable=True)
    timestamp = db.Column(db.TIMESTAMP, nullable=False, default=datetime.now())


# class LearningLabLog(db.Model):
#     __tablename__ = "LearningLabLog"
#     id = db.Column(db.Integer, primary_key=True)
#     interventionLog_id = db.Column(
#         db.Integer, db.ForeignKey("InterventionLog.id"), nullable=True,
#     )
#     chattStateANumber = db.Column(
#         db.String(20),
#         db.ForeignKey("Student.chattStateANumber", ondelete="CASCADE"),
#         nullable=False,
#     )
#     className = db.Column(db.String(50), nullable=False)
#     staffID = db.Column(db.Integer, db.ForeignKey("FacultyAndStaff.id"), nullable=True)
#     classDays = db.Column(db.String(10), nullable=False)
#     startTime = db.Column(db.Time, nullable=True)
#     endTime = db.Column(db.Time, nullable=True)
#     comment = db.Column(db.String(250), nullable=True)
#     googleCalendarEventID = db.Column(db.String(250), nullable=True)
#     LearningLabAttendanceLog = db.relationship(
#         "LearningLabAttendanceLog",
#         backref="LearningLabLog",
#         passive_deletes=True,
#         lazy=True,
#     )

#     def __repr__(self):
#         return f"LearningLabLog('{self.className}','{self.startDate}','{self.endDate}','{self.startTime}','{self.endTime}','{self.classDays}')"


# class LearningLabAttendanceLog(db.Model):
#     __tablename__ = "LearningLabAttendanceLog"
#     id = db.Column(db.Integer, primary_key=True)
#     learningLabLog_id = db.Column(
#         db.Integer,
#         db.ForeignKey("LearningLabLog.id", ondelete="CASCADE"),
#         nullable=False,
#     )
#     # classDate = db.Column(db.DateTime, nullable=False)
#     classDate = db.Column(db.Date, nullable=False)
#     attendanceCode = db.Column(db.String(2), nullable=True)
#     comment = db.Column(db.Text, nullable=True)
#     assignTmi = db.Column(db.Boolean, nullable=False, default=False)
#     interventionLog_id = db.Column(
#         db.Integer, db.ForeignKey("InterventionLog.id"), nullable=True,
#     )

#     def __repr__(self):
#         return f"LearningLabAttendanceLog('{self.id}','{self.classSchedule_id}','{self.classDate}','{self.attendanceCode}','{self.assignTmi}')"


class PblEvents(db.Model):
    __tablename__ = "PblEvents"
    id = db.Column(db.Integer, primary_key=True)
    pbl_id = db.Column(
        db.Integer, db.ForeignKey("Pbls.id", ondelete="CASCADE"), nullable=False,
    )
    # pblName = db.Column(db.String(100), nullable=True)
    eventCategory = db.Column(db.String(100), nullable=True)
    confirmed = db.Column(db.Boolean, nullable=True, default=False)
    eventDate = db.Column(db.Date, nullable=True)
    startTime = db.Column(db.Time, nullable=True)
    endTime = db.Column(db.Time, nullable=True)
    eventLocation = db.Column(db.String(100), nullable=True)
    eventStreetAddress1 = db.Column(db.String(100), nullable=True)
    eventStreetAddress2 = db.Column(db.String(100), nullable=True)
    eventCity = db.Column(db.String(100), nullable=True)
    eventState = db.Column(db.String(100), nullable=True)
    eventZip = db.Column(db.String(10), nullable=True)
    eventComments = db.Column(db.Text, nullable=True)
    googleCalendarEventID = db.Column(db.String(250), nullable=True)

    def __repr__(self):
        return f"pblEvent('{self.id}','{self.pbl_id}','{self.eventCategory}','{self.eventDate}','{self.startTime}','{self.endTime}')"


class PblTeams(db.Model):
    __tablename__ = "PblTeams"
    id = db.Column(db.Integer, primary_key=True)
    className = db.Column(db.String(50), nullable=True)
    schoolYear = db.Column(db.Integer, nullable=True)
    academicYear = db.Column(db.String(20), nullable=True)
    semester = db.Column(db.String(20), nullable=True)
    quarter = db.Column(db.Integer, nullable=True)
    pblNumber = db.Column(db.Integer, nullable=True)
    pblTeamNumber = db.Column(db.Integer, nullable=True)
    chattStateANumber = db.Column(
        db.String(20),
        db.ForeignKey("Student.chattStateANumber", ondelete="CASCADE"),
        nullable=False,
    )
    pbl_id = db.Column(
        db.Integer, db.ForeignKey("Pbls.id", ondelete="SET NULL"), nullable=True,
    )
    # pblName = db.Column(db.String(100), nullable=True)

    def __repr__(self):
        return f"pblTeam('{self.className}','{self.pblNumber}','{self.pblTeamNumber}','{self.pbl_id}','{self.chattStateANumber}')"


class Pbls(db.Model):
    __tablename__ = "Pbls"
    id = db.Column(db.Integer, primary_key=True)
    className = db.Column(db.String(50), nullable=True)
    schoolYear = db.Column(db.Integer, nullable=True)
    academicYear = db.Column(db.String(20), nullable=True)
    semester = db.Column(db.String(20), nullable=True)
    quarter = db.Column(db.Integer, nullable=True)
    pblNumber = db.Column(db.Integer, nullable=True)
    pblName = db.Column(db.String(100), nullable=True)
    pblSponsor = db.Column(db.String(100), nullable=True)
    pblSponsorPersonName = db.Column(db.String(100), nullable=True)
    pblSponsorPhone = db.Column(db.String(100), nullable=True)
    pblSponsorEmail = db.Column(db.String(100), nullable=True)
    pblComments = db.Column(db.Text, nullable=True)
    PblEvents = db.relationship(
        "PblEvents", backref="Pbls", passive_deletes=True, lazy=True,
    )
    PblTeams = db.relationship(
        "PblTeams", backref="Pbls", passive_deletes=True, lazy=True,
    )

    def __repr__(self):
        return f"pbl('{self.id}', '{self.pblName}','{self.className}','{self.schoolYear}','{self.semester}','{self.quarter}')"


class SurveyResponse(db.Model):
    __tablename__ = "SurveyResponse"
    id = db.Column(db.Integer, primary_key=True)
    staffID = db.Column(db.Integer, db.ForeignKey("FacultyAndStaff.id"), nullable=False)
    comment = db.Column(db.String(50000), nullable=True)
    timestamp = db.Column(db.TIMESTAMP, nullable=False, default=datetime.now())
