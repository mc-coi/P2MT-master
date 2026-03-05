from P2MT_App.models import ClassAttendanceLog


def setAttendanceForTmiTesting(startDate, endDate):
    logs = ClassAttendanceLog.query.filter(
        ClassAttendanceLog.classDate >= startDate,
        ClassAttendanceLog.classDate <= endDate,
    )
    for log in logs:
        if log.attendanceCode == None:
            log.attendanceCode = "P"
            print(log)
    return
