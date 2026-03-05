from P2MT_App import db
from P2MT_App.models import (
    Student,
    ClassSchedule,
    DailyAttendanceLog,
    FacultyAndStaff,
    ClassAttendanceLog,
)

print("\n=========", __file__, "=========\n")


def outputDatabaseContents(dbTable):
    for entry in dbTable.query.all():
        print(entry)
    print("\n")


# outputDatabaseContents(Student)
# outputDatabaseContents(ClassSchedule)
# outputDatabaseContents(FacultyAndStaff)
# outputDatabaseContents(DailyAttendanceLog)
outputDatabaseContents(ClassAttendanceLog)
