from P2MT_App import db
from P2MT_App.models import Student, ClassSchedule, DailyAttendanceLog, FacultyAndStaff
from datetime import datetime

print("\n=========", __file__, "=========\n")

print(DailyAttendanceLog.query.all())
list = DailyAttendanceLog.query.all()
for log in DailyAttendanceLog:
    print(DailyAttendanceLogs.staffID)
